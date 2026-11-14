# CLAUDE.md — Poizon → O'zbekiston savdo agentlari tizimi

## 1. Loyiha nima

Biz O'zbekistonda **faqat original** brend krossovka va kiyimlarni sotamiz. Manba: **Poizon** (poizon.com, xalqaro versiya; xarid Xitoydagi vositachi orqali Dewu/得物 dan bo'ladi). Tizim har kuni:

1. O'zbekistonda talab bor tovarlarni aniqlaydi (Talab agenti).
2. Shu tovarlarni poizon.com'dan topadi, narx va rasmlarini oladi (Manba agenti).
3. Tannarxni hisoblab, ustamamizni qo'shadi (Narx moduli — bu LLM emas, oddiy kod).
4. Sotuvga tayyor post (rasm + matn) yasaydi (Kontent agenti).
5. Postni Telegram bot orqali adminga yuboradi; admin tasdiqlasa — Telegram kanalga chiqadi va Instagram uchun tayyor paket yuboriladi (Nashr agenti).
6. Mijozlar bilan Chatplace orqali gaplashib, buyurtma qabul qiladi (Sotuv agenti).

Ish tili: **o'zbek (lotin)**, ikkinchi til rus. Kod, o'zgaruvchi nomlari va kommentlar — ingliz tilida.

---

## 2. O'zgarmas qoidalar (hech qachon buzilmaydi)

- **Faqat original.** Manba faqat Poizon/Dewu. Replika, "A-kopiya", "1:1", "lyuks kopiya", "公司级", "纯原", "原单", "复刻" kabi so'zlar uchragan har qanday manba yoki tovar avtomatik rad etiladi. 共享货源 / gxhyapp.com va shunga o'xshash replika manbalari ishlatilmaydi. Ro'yxat: `config/blocklist.yaml`.
  - **Istisno — 复刻:** Poizon/Dewu'ning o'z mahsulot nomi va rasmiy tavsifida (`products.origin` = `dewu` / `poizon_com`; manual_sheet'da har qatorning `origin` ustuni, default `other`) 复刻 rasmiy "retro" relizni bildiradi va rad etish sababi emas. Sotuvchi izohi va boshqa manbalarda rad etiladi. 复刻 boshqa replika so'zi bilan birga kelsa (masalan "复刻 1:1", "复刻 纯原") — har qanday manbada rad etiladi.
  - **Oʻxshatma:** nomida mashhur model nomi (Air Force, Jordan, Dunk, Yeezy, Samba, Nuptse, 530, 9060 …; roʻyxat `blocklist.yaml: famous_models`) bor, lekin brend boshqa yoki koʻrinmasa — "brendsiz oʻxshatma — qoʻshilmadi". Eng arzon oʻlcham narxi chegaradan past boʻlsa — ogohlantirish bilan rad etiladi. Chegara brend+toifa boʻyicha (`categories.yaml: min_price_by_brand`, masalan Nike/Jordan/Adidas/New Balance krossovka ¥300, Asics/Puma/Converse/Vans ¥200, TNF/Canada Goose/Moncler puxovik ¥700), boshqa brendlarga toifa chegarasi (`min_price`); hammasi TODO(admin). Faqat narx sababli rad etilganda admin "➕ Baribir qoʻshish" (yoki `/allow <SKU>`) bilan qoʻsha oladi; oʻxshatma va replika uchun bu imkoniyat yoʻq. Qabul qilingan har bir tovarning brendi, modeli va eng arzon narxi `price_observations` jadvaliga yoziladi; `/prices [kun]` brend boʻyicha eng arzon/oʻrtacha narxni koʻrsatadi.
- **Biz rasmiy diler emasmiz.** Postlarda "Nike rasmiy do'koni" kabi da'volar yo'q. To'g'ri ibora: "Poizon orqali, haqiqiyligi tekshirilgan original".
- **Rasmni AI bilan o'zgartirmaymiz.** Tovarning rangi, shakli, logotipi AI bilan "chiroyli" qilinmaydi. AI faqat fon, ramka, narx yozuvi, kompozitsiya uchun. Mijoz rasmda ko'rgan narsani oladi.
- **Halol shartlar.** Yetkazish muddati, "qaytarish yo'q" sharti, narxning amal qilish muddati har bir postda va har bir suhbatda aniq aytiladi. Soxta "faqat 2 ta qoldi", soxta sharhlar yo'q.
- **Saytlarga hurmat.** poizon.com'ning `robots.txt` qoidalariga to'liq amal qilinadi (pastda). Kirish tezligi cheklangan. Login, captcha yoki himoyani chetlab o'tish **taqiqlangan**. Sayt bloklasa — to'xtab, adminga xabar beriladi.
- **Pul va buyurtma — inson qo'lida.** To'lovni tasdiqlash, Poizon'da buyurtma berish, qaytarish/kompensatsiya qarorlari faqat admin tomonidan. Agentlar faqat tayyorlaydi va eslatadi.
- **Shaxsiy ma'lumot.** Mijoz telefoni, manzili faqat buyurtma uchun saqlanadi, loglarga ochiq yozilmaydi, uchinchi tomonga berilmaydi.

---

## 3. Texnologiyalar

- Python 3.12, `uv` bilan paketlar
- PostgreSQL (MVP uchun SQLite ham bo'ladi, lekin sxema Postgres'ga mos yozilsin) + SQLAlchemy 2 + Alembic
- Playwright (poizon.com sahifalari uchun) + `httpx` (sitemap, API'lar)
- `anthropic` SDK — barcha LLM agentlar uchun (model nomi `.env` da sozlanadi)
- `aiogram` 3 — Telegram admin bot va kanalga nashr
- `Pillow` — post rasm shablonlari (1080×1350 va 1080×1920)
- APScheduler — kunlik/haftalik vazifalar
- FastAPI — ichki API (Chatplace sotuv agenti katalog va narxni shu yerdan oladi)
- Docker + docker-compose; deploy: Hetzner server, Coolify
- Testlar: `pytest`

Barcha sirlar `.env` da: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_IDS`, `TELEGRAM_CHANNEL_ID`, `DATABASE_URL`, `CHATPLACE_*`. `.env.example` yarating, `.env` git'ga tushmasin.

---

## 4. Papka tuzilmasi

```
app/
  agents/
    demand.py        # Talab agenti
    sourcing.py      # Manba agenti (poizon.com)
    content.py       # Kontent agenti
    publisher.py     # Nashr (Telegram kanal + Instagram paket)
    sales_api.py     # Chatplace uchun katalog/narx/buyurtma endpointlari
  pricing/
    calculator.py    # Narx formulasi (sof kod, LLM yo'q)
    rates.py         # CBU kurslari
  scraping/
    poizon_client.py # robots.txt, rate limit, kesh, parser
    blocklist.py     # replika so'zlari filtri
  media/
    templates/       # Pillow shablonlari, shriftlar
    render.py
  bot/
    admin_bot.py     # aiogram: tasdiqlash, buyurtmalar, hisobot
  db/
    models.py
    migrations/
  reports/
    weekly.py        # haftalik tushum/xarajat hisoboti
  scheduler.py
  config.py
config/
  settings.yaml      # barcha raqamlar (ustama, kg narxi, og'irliklar...)
  seasons.yaml       # mavsum kalendari
  categories.yaml    # kategoriyalar va o'rtacha og'irliklar
prompts/
  demand.md
  content_uz.md
  sales_agent.md     # Chatplace agentiga beriladigan asosiy prompt
tests/
```

---

## 5. Ma'lumotlar bazasi (asosiy jadvallar)

- `products` — id, source (`poizon_com`), source_url, brand, model_name, style_code (SKU), category, gender, colorway, images (json, URL'lar), first_seen_at, last_checked_at, is_active, rejected_reason
- `product_sizes` — product_id, size_eu, size_us, price_usd (manbadagi narx), available, checked_at
- `demand_briefs` — id, created_at, period, items (json: kategoriya/model/sabab/prioritet), source_notes
- `quotes` — product_id, size, landed_cost_usd, sell_price_uzs, usd_rate, valid_until, breakdown (json)
- `posts` — id, product_id, status (`draft` → `approved` → `published` / `rejected`), caption_uz, caption_ru, image_paths, telegram_message_id, created_at, approved_by
- `leads` — chatplace_contact_id, channel (instagram/telegram), product_id, size, status, created_at
- `orders` — id, lead_id, product_id, size, sell_price_uzs, quote_id, prepayment_status, admin_confirmed_at, buyout_status, shipping_status, delivered_at, problem (masalan o'lcham), notes
- `expenses` — date, type (reklama/AI/server/menejer/boshqa), amount_uzs, note
- `settings_history` — sozlamalar o'zgarishi tarixi

---

## 6. Agentlar — batafsil

### 6.1 Talab agenti (`agents/demand.py`)
**Vazifa:** haftasiga 1 marta (dushanba 08:00) "talab brifi" tuzish: qaysi kategoriya va modellarni qidirish kerak.

**Kirish ma'lumotlari:**
- `config/seasons.yaml` — mavsum kalendari (noyabr–fevral: qishki kurtka, puxovik, yopiq krossovka; mart–may: yengil krossovka, vetrovka; iyun–avgust: yozgi krossovka, futbolka; avgust oxiri: maktab/talaba mavsumi).
- O'zimizning ma'lumot: oxirgi 30 kunda qaysi postlar ko'p so'rov/buyurtma olgan (`leads`, `orders`).
- Admin Telegram bot orqali yuboradigan qo'lda kuzatuvlar (`/trend New Balance 530 ko'p so'ralyapti`).
- Ixtiyoriy: ochiq manbalar (Google Trends va h.k.) — faqat rasmiy/ruxsat etilgan usulda; qoidasi noaniq saytlarni scraping qilmang.

**Chiqish:** `demand_briefs` yozuvi: 10–30 ta element, har biri: kategoriya, aniq model yoki qidiruv iborasi, narx diapazoni (so'mda), prioritet (1–3), sabab (1 gap). Adminga botda qisqa xulosa yuboriladi.

**Prompt:** `prompts/demand.md`. Agent o'ylab topilgan statistikani yozmasin — har bir sabab yuqoridagi ma'lumotlarga asoslansin.

### 6.2 Manba agenti (`agents/sourcing.py` + `scraping/poizon_client.py`)
**Vazifa:** talab brifidagi har bir element uchun poizon.com'da mos mahsulotlarni topish va narxlarni yangilash.

**poizon.com qoidalari (robots.txt bo'yicha, 2026-11 holatiga):**
- **Kirmang:** `/search`, `/_next/data/`, `/user/`, `/wish-list`, `/risk`, `/refund/`, `/authentication/myList`, `/authentication/submitResult`, `/goods/success-cancel-subscribe`, `/goods/cancel-subscribe`.
- **Ruxsat:** ochiq mahsulot, brend va `/trends/...` sahifalari. Mahsulot topish uchun `https://www.poizon.com/sitemap/sitemap-index.xml` va brend/trend sahifalaridan foydalaning (`/search` emas!).
- Ishga tushganda `robots.txt` ni har safar qayta o'qing va qoidalar o'zgargan bo'lsa unga moslashing (`urllib.robotparser`).
- Tezlik: bitta oqim, so'rovlar orasida 5–10 soniya tasodifiy pauza, kuniga ko'pi bilan ~500 sahifa. Javoblar 12 soat keshlanadi.
- Aniq User-Agent qo'ying (loyiha nomi + aloqa email `.env` dan).
- 403/429/captcha → darhol to'xtash, adminga xabar. Chetlab o'tishga urinmang (proxy aylantirish, captcha yechish va h.k. — **yo'q**).
- **Egasining qarori (2026-11-14):** tovar va rasmlar to'g'ridan-to'g'ri poizon.com'dan olinadi (vositachi va Google Sheet yo'q). Poizon Terms of Use 20.1 (o, p, r) robot va ruxsatsiz dasturlarni taqiqlaydi; bundan kelib chiqadigan xavfni (IP blok, rasmlar bo'yicha shikoyat) do'kon egasi biladi va o'z zimmasiga oladi. `settings.yaml`: `poizon_scraping_enabled: true`. Yuqoridagi robots.txt / tezlik / to'xtash qoidalari o'zgarmaydi.
- **Texnik holat (2026-11-14 tekshiruvi):** aniq User-Agent bilan (oddiy so'rov ham, Playwright brauzer ham) poizon.com mahsulot ro'yxatini bermaydi: brend, `/trends`, kategoriya sahifalarida va ularning ichki API'sida `spuList` bo'sh ("No results", total 1200). Sitemap faqat maqolalarni beradi. Ma'lumot olish uchun o'zini oddiy brauzer qilib ko'rsatish (soxta UA, headless'ni yashirish) kerak bo'lardi — bu himoyani chetlab o'tish, taqiqlangan. Shuning uchun `poizon_client.py` qurilmagan; `sourcing_mode: poizon_com` kod tomonidan shu sabab bilan rad etiladi. Hozirgi manba — `manual_sheet` (CSV / Sheet, zaxira rejim). Poizon rasmiy API/hamkorlik dasturi yoki sayt bot'ga ma'lumot bera boshlasa — qayta ko'riladi.

- **Asosiy manba (2026-11-14 dan): ilova skrinshotlari** (`agents/screens.py`). Mahsulot sahifasi to'g'ridan-to'g'ri havola bilan ham bot'ga nom/SKU/narx/o'lcham bermaydi (sahifa umumiy sarlavha bilan keladi; `get-index-spu-detail` API bo'sh javob qaytaradi), shuning uchun havola o'qilmaydi. Admin ilovadan 1–3 ta skrinshot yuboradi (izohsiz yoki havola bilan) → Claude vision nom, SKU, narx (yuan), o'lchamlar, sotuv sonini o'qiydi → bot ko'rsatadi, admin **✅ To'g'ri / ✏️ Tuzatish** qiladi → sheet bilan bir xil tekshiruv + blocklist → `products` (`source: poizon_app`, `origin: poizon_com`). Mahsulot rasmi skrinshotdan qirqib olinadi (faqat qirqish) yoki admin SKU izohi bilan rasm yuboradi. SKU ko'rinmasa — nom+rangdan barqaror `PZ-xxxxxxxx` kod. Bir xil tovarning skrinshoti qayta yuborilsa narx yangilanadi.
- **Skrinshot rasmlari:** bir albomda skrinshot + ilovadan «Save image» qilingan rasm kelsa, kartochkaga oddiy rasm ishlatiladi, skrinshot faqat maʼlumot uchun. Har rasmdan faqat mahsulot surati qismi qirqiladi (posterdagi QR-kod va pastki reklama tushmaydi). Rasm shundayligicha: 得物 suv belgisi oʻchirilmaydi va yashirilmaydi, fon olib tashlanmaydi. Uzun tomoni 1080px dan kichik rasmga bot "rasm sifati past" deb ogohlantiradi. Oʻlchamlar oʻqilmasa bot oʻlcham tanlash oynasining skrinshotini soʻraydi va uni shu tovarga qoʻshadi. Vision izohlari adminga faqat oʻzbekcha.
- **Narx eskirishi:** manba narxi `max_price_age_days` (3) kundan eski bo'lsa post nashr qilinmaydi va draft bo'lmaydi; kunlik xulosada "Narxni yangilang: …" ro'yxati.

**Har bir mahsulotdan oladigan narsalar:** nom, brend, style code (SKU), rang, kategoriya, har bir o'lcham bo'yicha narx (USD) va mavjudligi, rasm URL'lari, sahifa URL'i.

**Filtrlar:**
- `blocklist.py` — replika so'zlari bo'lsa rad etish.
- Narx diapazoni brifga mos bo'lsin.
- Eng ko'p sotiladigan o'lchamlar (erkak EU 40–45, ayol EU 36–40) mavjud bo'lmasa — o'tkazib yuborish.

**Muqobil rejim:** `settings.yaml` da `sourcing_mode: manual_sheet` bo'lsa, agent saytga kirmaydi; admin yoki xitoydagi vositachi narxlarni CSV/Google Sheet orqali yuklaydi, qolgan zanjir bir xil ishlaydi. Bu rejim albatta ishlashi kerak (zaxira yo'l).

### 6.3 Narx moduli (`pricing/calculator.py`) — LLM ishlatilmaydi
Barcha raqamlar `config/settings.yaml` dan olinadi, kodga yozilmaydi.

```
source_price_usd        # tanlangan o'lcham narxi
buyout_fee              = max(source_price_usd * buyout_fee_pct, buyout_fee_min_usd)   # default 5%, min $3
shipping                = weight_kg[category] * ship_rate_per_kg + local_delivery_usd  # default $5.5/kg avto, $9.2/kg avia; Toshkent $2
customs                 = 0, agar source_price_usd <= duty_free_limit_usd ($200)
                          aks holda max(customs_rate * (source_price_usd - limit), customs_min_per_kg * weight_kg)
                          customs_rate: 0.30 (2026-12-31 gacha), 0.20 (2027-01-01 dan)
                          customs_min_per_kg: $3 (2026-12-31 gacha), $2 (2027-01-01 dan)
landed_cost_usd         = source_price_usd + buyout_fee + shipping + customs
sell_price_uzs          = ceil_to(landed_cost_usd * (1 + markup[category]) * usd_rate, 10_000)
```

- `markup` default: krossovka 0.23, kurtka 0.25 (sozlanadi).
- `usd_rate` — O'zbekiston Markaziy banki kursi, kuniga 1 marta olinadi (cbu.uz JSON arxivi), keshlanadi; xavfsizlik uchun `usd_rate_buffer_pct` (default 1.5%) qo'shiladi.
- Har bir narx `quotes` jadvalida `valid_until = now + 24h` bilan saqlanadi. Muddati o'tgan narx bilan buyurtma qabul qilinmaydi — qayta hisoblanadi.
- Shipping rejimi (avto/avia) kategoriya va mavsumga bog'liq: qishki kiyim noyabr–yanvarda avia.
- `pytest` bilan to'liq testlar: chegaraviy holatlar ($200 dan past/yuqori, 2027-yil o'zgarishi, yaxlitlash).
- **Muhim:** $200 limit shaxsiy ehtiyoj uchun. Tizim "mijoz nomiga vositachilik" modeli bilan ishlaydi. Bu yuridik masala — kodda faqat sozlama sifatida, qaror admin va buxgalter tomonidan.

### 6.4 Kontent agenti (`agents/content.py` + `media/render.py`)
**Har bir tasdiqlashga tayyor mahsulot uchun:**
- 3–5 ta rasm kartochka (1080×1350): mahsulot rasmi + toza fon + brend/model nomi + narx (so'mda) + "Original · Poizon tekshiruvi" belgisi + o'lchamlar.
- Story formati (1080×1920) — 1 ta.
- Post matni (o'zbekcha, lotin; ixtiyoriy ruscha): model nomi, nimasi bilan yaxshi (2–3 fakt — faqat manbadan olingan ma'lumot), mavjud o'lchamlar, narx, yetkazish muddati (avto 20–30 kun / avia 7–12 kun — sozlamadan), "buyurtma qilingan tovar o'lcham sababli qaytarilmaydi — o'lchamni yozing, yordam beramiz", buyurtma uchun chaqiriq (Instagram DM / Telegram bot).
- Hashtaglar: 5–8 ta, o'zbekcha va brend.

**Qoidalar:** `prompts/content_uz.md`. Uydirma fakt yo'q. Rasm ustida tovarni o'zgartiruvchi AI tahrir yo'q (2-bo'lim). Rasm huquqlari: `settings.yaml` dagi `image_source_policy` (`source_images` / `own_photos_only`). **Egasining qarori (2026-11-14): `source_images`** — mahsulotning `image_urls` dagi rasmlari (Poizon/Dewu CDN ham) avtomatik yuklab olinadi va tovarni o'zgartirmasdan kartochkaga qo'yiladi. Rasm huquqi bo'yicha xavfni do'kon egasi o'z zimmasiga oladi. `own_photos_only` holatida kontent agenti adminga "rasm kerak" deb so'raydi.

### 6.5 Nashr agenti (`agents/publisher.py` + `bot/admin_bot.py`)
- Har kuni 10:00 da 3–8 ta yangi `draft` post adminga Telegram botda yuboriladi: rasmlar + matn + narx tafsiloti (tannarx, ustama, foyda) + tugmalar: **✅ Tasdiqlash / ✏️ Tahrirlash / ❌ Rad etish / 🔄 Narxni yangilash**.
- Tasdiqlangan post belgilangan vaqtlarda (12:00, 19:00, 21:00 — sozlanadi) Telegram kanalga chiqadi.
- Instagram uchun: tasdiqlangan post rasmlari va matni adminga alohida "Instagram paket" sifatida yuboriladi (admin qo'lda joylaydi). Keyingi bosqichda Meta Graph API orqali avtomatik nashr — faqat admin buni yoqsa.
- Admin bot buyruqlari: `/today`, `/orders`, `/trend <matn>`, `/rate`, `/pause`, `/resume`, `/report`, `/expense <summa> <turi> <izoh>`, `/drafts` (hozir draft), `/neworder <post_id> <oʻlcham> <ism> <telefon|@username> [ext=<USD>] [novac]`, `/lead <post_id> [oʻlcham]`, `/stockcost <SKU> <summa> [oʻlcham]`, `/buyprice <order_id> <yuan>` (haqiqiy xarid narxi → tannarx va foyda qayta hisoblanadi), `/summary`.
- Suratlar: admin botga SKU izohi bilan yuboradi (fayl sifatida — sifat saqlanadi), bir SKUga 10 tagacha; suratsiz post tasdiqlanmaydi.
- Draft tartibi: ombordagi tovar → `/trend`ga mos → posti yoʻq eng yangi; kuniga bir brenddan ≤2, bir modeldan ≤1.
- Ombor: qoldiq va tannarx **oʻlcham boʻyicha** (`product_sizes.stock_qty`, `stock_cost_uzs`); narx = tannarx × (1 + `stock.markup`); postda "Mavjud · 1 kunda yetkazamiz". Tannarx buyurtma "📦 Omborga" qilinganda uning landed cost'idan olinadi (oʻrtacha), `/stockcost` bilan tuzatiladi.
- Tasdiqlashdan oldin narx qayta tekshiriladi: manbadagi narx 5% dan ko'p o'zgargan bo'lsa — post qayta hisoblanadi va admin ogohlantiriladi.

**Avtomatik rejim (`auto_publish: true`, egasining qarori 2026-11-14):** admin har bir postni tasdiqlamaydi. Jadval (Asia/Tashkent, `settings.yaml: schedule`): 05:00 mahsulot yuklash (`sheet_url`, manual_sheet), 09:00 saralash (Solishtiruvchi: sotuv soni, narx diapazoni, ommabop o'lchamlar, mavsum, /trend) + narx + rasm yuklash + draft + avto-tekshiruv, 12:00/19:00/21:00 nashr, 21:30 adminga bitta kunlik xulosa. Tekshiruvdan o'tgan post (rasm bor, narx yangi, matn filtrdan o'tgan, narx o'zgarishi ≤5%) o'zi tasdiqlanadi; o'tmagani chiqmaydi va xulosada "chiqmadi, sababi: …" bo'ladi, ertasi kuni qayta tekshiriladi. /pause hammasini to'xtatadi (xulosa keladi). Qo'lda qoladi: to'lovni tasdiqlash va xarid. Avto rejimda Instagram paket alohida yuborilmaydi.

### 6.6 Sotuv agenti — Chatplace (`agents/sales_api.py` + `prompts/sales_agent.md`)
Chatplace Instagram/Telegram DM'larni boshqaradi; bizning backend unga ma'lumot beradi.

**Backend endpointlari (FastAPI, token bilan himoyalangan):**
- `GET /catalog?query=&category=&size=` — faol mahsulotlar (nashr qilinganlar)
- `GET /quote?product_id=&size=` — joriy narx, amal qilish muddati, yetkazish muddati
- `POST /leads` — qiziqish bildirgan mijoz
- `POST /orders` — buyurtma yaratish (status: `awaiting_prepayment`); adminga darhol Telegram xabar
- `GET /orders/{id}` — mijozga holatini aytish uchun

Chatplace'ning hujjatlarini o'qing va integratsiyani uning rasmiy usulida qiling (webhook / tashqi so'rov). Hujjatda topilmagan narsani taxmin qilmang — adminga savol qoldiring.

**`prompts/sales_agent.md` mazmuni (shu asosda yozing):**
- Rol: do'kon sotuvchi-maslahatchisi, xushmuomala, qisqa, o'zbekcha (mijoz ruscha yozsa — ruscha).
- Har doim: tovarning originalligi (Poizon tekshiruvi, QR sertifikat), yetkazish muddati, narx 24 soat amal qilishi, oldindan to'lov sharti, **o'lcham sababli qaytarish yo'qligi** — buyurtmadan oldin aniq aytiladi va mijoz "roziman" deb tasdiqlaydi.
- O'lcham yordami: mijozdan oyoq uzunligini sm da so'rash, brendning o'lcham jadvaliga solishtirish; ishonch past bo'lsa — inson menejerga o'tkazish.
- Narxni faqat `/quote` dan oladi; o'zi chegirma o'ylab topmaydi.
- To'lov rekvizitlarini o'zi yubormaydi — buyurtma yaratadi, admin rekvizitlarni beradi va to'lovni tasdiqlaydi.
- Insonga o'tkazish holatlari: shikoyat, qaytarish so'rovi, 2 marta tushunmovchilik, katta buyurtma (3+ dona), mijoz so'rasa.
- Taqiqlar: replika/kopiya taklif qilish, "rasmiy diler" deyish, yolg'on muddat yoki "oxirgisi" deyish, mijozga bosim o'tkazish.

---

## 7. Buyurtma jarayoni (inson nazorati bilan)

1. Sotuv agenti → `orders` (awaiting_prepayment) → adminga xabar.
2. Admin to'lovni tekshiradi → botda "To'lov keldi" → `prepayment_status=paid`.
3. Bot eslatadi: "Xariddan oldin ilovada joriy narxni tekshiring". Admin/vositachi Dewu'da xarid qiladi, `/buyprice` bilan haqiqiy narxni kiritadi → botda "Sotib olindi" → `buyout_status=bought`.
4. Kargo bosqichlari qo'lda yangilanadi (`in_china_warehouse` → `shipped` → `in_tashkent` → `delivered`).
5. Har bir status o'zgarishida mijozga Chatplace orqali avtomatik xabar.
6. Muammo (o'lcham, kechikish, nuqson) → `problem` maydoni + admin qarori.

---

## 8. Haftalik hisobot (`reports/weekly.py`)
Har dushanba 09:00 da adminga (o'tgan hafta; `/report` — shu hafta, `/report otgan` — o'tgan hafta), matn + Excel (mijoz ismi/telefonisiz), oddiy tilda, atamalarsiz:
- **Tushum** (so'm), **xarajatlar** turlari bo'yicha (tovar+yetkazish+bojxona, reklama, AI, server, menejer, boshqa), **sof qoldiq**.
- Buyurtmalar soni, bekor qilinganlar, o'lcham muammolari soni.
- Eng ko'p so'ralgan 5 ta model.
- ROAS va shunga o'xshash koeffitsientlar ishlatilmaydi — faqat "qancha sarfladik / qancha pul tushdi" formatida.

---

## 9. Bosqichlar

**Bosqich 0 — Sinov (MVP, 1–2 hafta qurish, 4–6 hafta sinov):**
- Narx moduli + testlar
- Manba: `manual_sheet` rejimi (hozirgi yagona ishlaydigan manba); poizon.com klienti — 6.2 "Texnik holat"ga qarang
- Kontent (rasm shablon + matn)
- Admin bot + Telegram kanalga nashr
- Buyurtmalar botda qo'lda
- Haftalik hisobot

Sinovdan o'tish mezonlari (settings.yaml da, hisobotda ko'rinsin): 1-oyda ≥30 to'langan buyurtma; bitta buyurtmaga reklama ≤150 000 so'm; o'lcham muammolari <5%.

**Bosqich 1:** Chatplace sotuv agenti + backend endpointlari.
**Bosqich 2:** Talab agentini to'liq avtomatlashtirish, Instagram avto-nashr (Graph API), Reels shablonlari.

Har bosqich oxirida: testlar o'tadi, `README.md` yangilanadi, `docker compose up` bilan noldan ishga tushadi.

---

## 10. Ishlash tartibi (Claude Code uchun)

- Har katta o'zgarishdan oldin qisqa reja yozing va tasdiq kuting.
- Raqamlarni kodga yozmang — `settings.yaml`.
- LLM chaqiruvlarini bitta `llm.py` orqali qiling (retry, token loglari, xarajatni `expenses` ga kunlik yig'ish).
- `DRY_RUN=true` rejimi: hech narsa nashr qilinmaydi, xabarlar faqat adminga.
- Har bir tashqi saytga so'rov loglanadi (URL, status, vaqt), shaxsiy ma'lumotsiz.
- Noaniqlik bo'lsa (yuridik, to'lov, sayt qoidalari) — taxmin qilmang, `TODO(admin):` deb belgilang va adminga yozing.