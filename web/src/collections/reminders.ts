import type { CollectionConfig, GlobalConfig } from 'payload'

// Admin → Sozlamalar → Avtomatik eslatmalar: two automatic messages, both off until the owner switches them on.
//  1) "Toʻlanmay qolgan buyurtma": the customer filled in the checkout but did not pay — one reminder with the pay link.
//  2) "Qaytmagan mijoz": bought before, quiet for N days, and ticked "Aksiyalar va eslatmalar" at checkout — one reminder.
// Telegram when the customer joined the shop's bot, else SMS (Eskiz; the text must be approved by Eskiz first).
// Every message (sent, failed or skipped) is written to "Eslatmalar jurnali", so nobody gets the same reminder twice.
const admin = ({ req }: { req: { user?: unknown } }) => !!req.user

const CHANNEL = [
  { value: 'telegram_sms', label: 'Telegram, boʻlmasa SMS' },
  { value: 'telegram', label: 'Faqat Telegram (bepul)' },
  { value: 'sms', label: 'Faqat SMS' },
]

export const REMINDER_DEFAULTS = {
  abandoned: {
    uz: 'Assalomu alaykum, {ism}! Yeppo’dagi buyurtmangiz №{buyurtma} toʻlanmay qoldi. Toʻlash uchun: {havola}',
    ru: 'Здравствуйте, {ism}! Ваш заказ №{buyurtma} в Yeppo не оплачен. Оплатить: {havola}',
  },
  lapsed: {
    uz: 'Assalomu alaykum, {ism}! Yeppo’da sizni sogʻindik. Sevimli parvarishingiz tugayotgan boʻlsa, yangilarini koʻring: {sayt}',
    ru: 'Здравствуйте, {ism}! Мы скучаем по вам в Yeppo. Если любимый уход заканчивается, загляните: {sayt}',
  },
}

export const ReminderSettings: GlobalConfig = {
  slug: 'reminders',
  label: 'Avtomatik eslatmalar',
  admin: { group: 'Sozlamalar', description: 'Ikkalasi ham oʻchiq turadi, siz yoqmaguningizcha hech kimga xabar ketmaydi. Xabarlar faqat 10:00–20:00 (Toshkent) oraligʻida yuboriladi. Natija: Admin → Marketing → Eslatmalar.' },
  access: { read: admin, update: admin },
  fields: [
    { type: 'collapsible', label: 'Toʻlanmay qolgan buyurtma', fields: [
      { name: 'abandonedOn', label: 'Yoqilgan', type: 'checkbox', defaultValue: false },
      { name: 'abandonedAfterMin', label: 'Necha daqiqadan keyin', type: 'number', defaultValue: 60, min: 15, max: 600,
        admin: { description: 'Buyurtma berilgandan keyin. Toʻlov havolasi 12 soat ishlaydi, shuning uchun 15–600 daqiqa.' } },
      { name: 'abandonedChannel', label: 'Qayerga', type: 'select', defaultValue: 'telegram_sms', options: CHANNEL },
      { name: 'abandonedText', label: 'Xabar matni', type: 'textarea', localized: true,
        admin: { description: `Boʻsh = standart matn. Oʻrniga qoʻyiladi: {ism}, {buyurtma}, {havola}. Standart: «${REMINDER_DEFAULTS.abandoned.uz}»` } },
    ] },
    { type: 'collapsible', label: 'Qaytmagan mijoz', fields: [
      { name: 'lapsedOn', label: 'Yoqilgan', type: 'checkbox', defaultValue: false },
      { name: 'lapsedDays', label: 'Oxirgi xariddan necha kun oʻtgach', type: 'number', defaultValue: 45, min: 14, max: 365 },
      { name: 'lapsedChannel', label: 'Qayerga', type: 'select', defaultValue: 'telegram', options: CHANNEL },
      { name: 'lapsedPromo', label: 'Promokod (ixtiyoriy)', type: 'text', admin: { description: 'Matnda {promokod} oʻrniga qoʻyiladi. Avval Promokodlar boʻlimida yarating.' } },
      { name: 'lapsedText', label: 'Xabar matni', type: 'textarea', localized: true,
        admin: { description: `Boʻsh = standart matn. Oʻrniga qoʻyiladi: {ism}, {sayt}, {promokod}. Standart: «${REMINDER_DEFAULTS.lapsed.uz}»` } },
    ] },
  ],
}

export const ReminderLog: CollectionConfig = {
  slug: 'reminder-log',
  labels: { singular: 'Eslatma', plural: 'Eslatmalar jurnali' },
  admin: { group: 'Savdo', useAsTitle: 'phone', defaultColumns: ['kind', 'phone', 'channel', 'status', 'createdAt'] },
  access: { read: admin, create: () => false, update: () => false, delete: admin },
  fields: [
    { name: 'kind', label: 'Turi', type: 'select', required: true, index: true, options: [{ value: 'abandoned', label: 'Toʻlanmagan buyurtma' }, { value: 'lapsed', label: 'Qaytmagan mijoz' }] },
    { name: 'key', label: 'Kalit', type: 'text', required: true, unique: true, admin: { description: 'Bir xil eslatma ikki marta ketmasligi uchun' } },
    { name: 'phone', label: 'Telefon', type: 'text', required: true, index: true },
    { name: 'orderNumber', label: 'Buyurtma', type: 'text' },
    { name: 'channel', label: 'Kanal', type: 'select', options: [{ value: 'telegram', label: 'Telegram' }, { value: 'sms', label: 'SMS' }, { value: 'none', label: '—' }] },
    { name: 'status', label: 'Natija', type: 'select', required: true, index: true, options: [{ value: 'sent', label: 'Yuborildi' }, { value: 'failed', label: 'Yuborilmadi' }, { value: 'skipped', label: 'Oʻtkazib yuborildi' }] },
    { name: 'note', label: 'Izoh', type: 'text' },
  ],
}
