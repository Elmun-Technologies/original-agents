import 'server-only'

import type { Order } from '@/payload-types'
import { payload } from '@/lib/catalog'
import { getOrder } from '@/lib/orders'
import { sendTelegram, type Sent } from '@/lib/telegram'
import { siteUrl } from '@/lib/site'

// The customer side of the Telegram bot. Everything the site promises there is done here and nowhere else:
//   /start o_<number>_<token>  connect an order: its status changes are sent to this chat
//   /start notify_<sku>        tell me when this size is back in stock
//   /start buy_<sku> | account links to the product page / the cabinet (an order is placed on the site, not in the chat)
//   /stop                      forget this chat everywhere
// A chat id is stored only after the customer pressed the button themselves. Texts are in the customer's language.

type Lang = 'uz' | 'ru'
export type Update = { message?: { text?: string; chat?: { id?: number; type?: string }; from?: { language_code?: string } } }
export type Send = (chat: string, text: string) => Promise<Sent>

const T = {
  hello: { uz: 'Salom! Bu Yeppo boti. Buyurtmangiz holatini va kutgan mahsulotingiz kelganini shu yerga yozaman. Ulanish uchun buyurtma sahifasidagi «Telegramda kuzatish» yoki mahsulot sahifasidagi «Kelganda xabar berish» tugmasini bosing.\nXabarlarni toʻxtatish: /stop', ru: 'Здравствуйте! Это бот Yeppo. Я пишу сюда о статусе вашего заказа и когда нужный товар снова в наличии. Чтобы подключиться, нажмите «Следить в Telegram» на странице заказа или «Сообщить о поступлении» на странице товара.\nОстановить сообщения: /stop' },
  badLink: { uz: 'Havola eskirgan yoki notoʻgʻri. Buyurtma sahifasidan «Telegramda kuzatish» tugmasini qaytadan bosing.', ru: 'Ссылка устарела или неверна. Нажмите «Следить в Telegram» на странице заказа ещё раз.' },
  noUpdates: { uz: 'Bu buyurtmada Telegram xabarlari oʻchirilgan edi, shuning uchun ulamadim.', ru: 'В этом заказе уведомления в Telegram были отключены, поэтому я не подключил чат.' },
  connected: { uz: 'Buyurtma №{n} ulandi. Holati oʻzgarganda shu yerga yozaman.\nHozir: {s}.\nToʻxtatish: /stop', ru: 'Заказ №{n} подключён. Когда статус изменится, я напишу сюда.\nСейчас: {s}.\nОстановить: /stop' },
  waiting: { uz: '«{p}» qaytib kelganda xabar beraman. Toʻxtatish: /stop', ru: 'Сообщу, когда «{p}» снова появится в наличии. Остановить: /stop' },
  inStock: { uz: '«{p}» hozir omborda bor: {u}', ru: '«{p}» сейчас в наличии: {u}' },
  noProduct: { uz: 'Bu mahsulotni topa olmadim. Saytdan qaytadan urinib koʻring.', ru: 'Не нашёл этот товар. Попробуйте ещё раз с сайта.' },
  product: { uz: '«{p}» sahifasi: {u}\nSavatga qoʻshib, saytda buyurtma bering. Savolingiz boʻlsa, yozing: {c}', ru: 'Страница «{p}»: {u}\nДобавьте в корзину и оформите заказ на сайте. Если есть вопросы, пишите: {c}' },
  account: { uz: 'Shaxsiy kabinet: {u}', ru: 'Личный кабинет: {u}' },
  stopped: { uz: 'Boʻldi, bu chatga boshqa xabar yubormayman.', ru: 'Готово, больше не буду писать в этот чат.' },
  other: { uz: 'Savolingiz boʻlsa, doʻkon bilan bogʻlaning: {c}', ru: 'Если есть вопрос, свяжитесь с магазином: {c}' },
  back: { uz: '«{p}» qaytib keldi! {u}', ru: '«{p}» снова в наличии! {u}' },
}
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '')

const STATUS: Record<string, { uz: string; ru: string }> = {
  new: { uz: 'Toʻlov kutilmoqda', ru: 'Ожидает оплаты' }, accepted: { uz: 'Qabul qilindi', ru: 'Принят' }, assembling: { uz: 'Yigʻilmoqda', ru: 'Собирается' },
  shipping: { uz: 'Yoʻlda', ru: 'В пути' }, delivered: { uz: 'Yetkazildi', ru: 'Доставлен' }, cancelled: { uz: 'Bekor qilindi', ru: 'Отменён' },
}
const MORE: Record<string, { uz: string; ru: string }> = {
  accepted: { uz: 'Toʻlov qabul qilindi, buyurtmani yigʻishni boshlaymiz.', ru: 'Оплата получена, начинаем собирать заказ.' },
  assembling: { uz: 'Mahsulotlarni tekshirib, qadoqlayapmiz.', ru: 'Проверяем товары и упаковываем.' },
  shipping: { uz: 'Kuryer yoʻlda. U sizga 30 daqiqa oldin qoʻngʻiroq qiladi.', ru: 'Курьер в пути. Он позвонит за 30 минут.' },
  delivered: { uz: 'Topshirildi. Mahsulot yoqdimi? Saytdagi sharh maydonida fikringizni yozsangiz, boshqalarga yordam boʻladi.', ru: 'Заказ передан. Понравился товар? Оставьте отзыв на сайте — это поможет другим.' },
  cancelled: { uz: 'Savolingiz boʻlsa, doʻkon bilan bogʻlaning.', ru: 'Если есть вопросы, свяжитесь с магазином.' },
}

export const statusText = (status: string, lang: Lang) => STATUS[status]?.[lang] ?? status

/** the message sent to the customer when the order reaches this status (null = nothing to say) */
export function orderStatusMessage(o: Pick<Order, 'number' | 'status' | 'lang' | 'pointsEarned'>): string | null {
  const lang: Lang = o.lang === 'ru' ? 'ru' : 'uz'
  const more = MORE[o.status]
  if (!more) return null
  const pts = o.status === 'delivered' && (o.pointsEarned ?? 0) > 0 ? (lang === 'ru' ? `\nНачислено бонусов: ${o.pointsEarned}.` : `\nBonus ball: +${o.pointsEarned}.`) : ''
  return `№${o.number} — ${statusText(o.status, lang)}.\n${more[lang]}${pts}`
}

async function contact(lang: Lang) {
  const s = await (await payload()).findGlobal({ slug: 'store', depth: 0, overrideAccess: true })
  return s.telegramHandle?.trim() || `${siteUrl()}/${lang}/yordam/aloqa`
}

const START = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?\s*$/
const STOP = /^\/stop(?:@\w+)?\s*$/

export async function handleUpdate(u: Update, send: Send = sendTelegram): Promise<string> {
  const m = u.message
  const chatId = m?.chat?.id
  if (!m || typeof chatId !== 'number' || m.chat?.type !== 'private' || typeof m.text !== 'string' || m.text.length > 200) return 'ignored'
  const chat = String(chatId)
  const lang: Lang = m.from?.language_code?.startsWith('ru') ? 'ru' : 'uz'
  const p = await payload()
  const site = siteUrl()
  const say = async (key: keyof typeof T, l: Lang, v: Record<string, string> = {}) => { await send(chat, fill(T[key][l], v)) }

  if (STOP.test(m.text)) {
    const pool = (p.db as unknown as { pool: { query: (s: string, v: unknown[]) => Promise<unknown> } }).pool
    await pool.query('UPDATE orders SET telegram_chat = NULL WHERE telegram_chat = $1', [chat])
    await pool.query('DELETE FROM waitlist WHERE chat = $1', [chat])
    await say('stopped', lang)
    return 'stopped'
  }
  const start = START.exec(m.text)
  if (!start) { await say('other', lang, { c: await contact(lang) }); return 'other' }
  const arg = start[1] ?? ''

  const order = /^o_(\d{1,9})_([a-f0-9]{32})$/.exec(arg)
  if (order) {
    const o = await getOrder(order[1], order[2])
    const l: Lang = o?.lang === 'ru' ? 'ru' : 'uz'
    if (!o) { await say('badLink', lang); return 'bad-link' }
    if (o.telegramUpdates === false) { await say('noUpdates', l); return 'no-updates' }
    await p.update({ collection: 'orders', id: o.id, data: { telegramChat: chat }, overrideAccess: true })
    await say('connected', l, { n: o.number, s: statusText(o.status, l) })
    return 'order'
  }
  const sku = /^(notify|buy)_([A-Za-z0-9_-]{1,40})$/.exec(arg)
  if (sku) {
    // the site writes the sku with every character that is not a letter, digit, _ or - replaced by "_"
    const found = (await p.find({ collection: 'products', depth: 0, limit: 500, pagination: false, overrideAccess: true, locale: lang })).docs
      .flatMap((pr) => pr.variants.map((v) => ({ pr, v }))).find(({ v }) => v.sku.replace(/[^\w-]/g, '_') === sku[2])
    if (!found) { await say('noProduct', lang); return 'no-product' }
    const url = `${site}/${lang}/mahsulot/${found.pr.slug}`
    if (sku[1] === 'buy') { await say('product', lang, { p: found.pr.name, u: url, c: await contact(lang) }); return 'buy' }
    if ((found.v.stock ?? 0) > 0) { await say('inStock', lang, { p: found.pr.name, u: url }); return 'in-stock' }
    const pool = (p.db as unknown as { pool: { query: (s: string, v: unknown[]) => Promise<unknown> } }).pool
    await pool.query('INSERT INTO waitlist (sku, chat, lang, updated_at, created_at) VALUES ($1, $2, $3, now(), now()) ON CONFLICT (sku, chat) DO NOTHING', [found.v.sku, chat, lang])
    await say('waiting', lang, { p: found.pr.name })
    return 'waiting'
  }
  if (arg === 'account') { await say('account', lang, { u: `${site}/${lang}/kabinet` }); return 'account' }
  await say('hello', lang)
  return 'hello'
}

/** sends the status message of an order to the chat the customer connected (called from the order's change hook) */
export async function notifyOrderStatus(o: Order, send: Send = sendTelegram) {
  if (!o.telegramChat || o.telegramUpdates === false) return false
  const text = orderStatusMessage(o)
  if (!text) return false
  const r = await send(o.telegramChat, text)
  if (r.blocked) await (await payload()).update({ collection: 'orders', id: o.id, data: { telegramChat: null }, overrideAccess: true })
  return r.ok
}

/** one message to everyone waiting for this size, then they are removed from the list */
export async function notifyBackInStock(sku: string, name: string, slug: string, send: Send = sendTelegram) {
  const p = await payload()
  const pool = (p.db as unknown as { pool: { query: (s: string, v: unknown[]) => Promise<{ rows: { chat: string; lang: string }[] }> } }).pool
  const { rows } = await pool.query('DELETE FROM waitlist WHERE sku = $1 RETURNING chat, lang', [sku])
  for (const r of rows) {
    const l: Lang = r.lang === 'ru' ? 'ru' : 'uz'
    await send(r.chat, fill(T.back[l], { p: name, u: `${siteUrl()}/${l}/mahsulot/${slug}` }))
  }
  return rows.length
}
