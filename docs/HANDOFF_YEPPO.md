# Yeppo — ishni davom ettiruvchi dasturchi uchun hisobot

Holat sanasi: 2026-11-15. Oxirgi commit: `0624581` (`master`, GitHub'ga push qilingan). Ishchi papka toza.

Repo: `Elmun-Technologies/original-agents` (private). Unda ikkita alohida loyiha bor:

| Papka | Nima | Holat |
|---|---|---|
| `web/` | **Yeppo** — koreys kosmetikasi internet-do'koni (Next.js 16 + Payload 3 + Postgres) | Serverda Coolify'da ishlayapti, oxirgi deploy `0624581` |
| `app/`, `config/settings.yaml`, `docker-compose.yml` (root) | **Poizon** krossovka boti (eski loyiha) | Serverda ishlaydi, bot **pauzada**. **Egasining ruxsatisiz tegilmaydi.** |
| `yeppo_agents/`, `config/yeppo.yaml` | **Yeppo marketing agentlari** (Python): tovar topish, narx, Instagram paketlari, Telegram | Serverga hali qo'yilmagan |

Asosiy qoidalar (egasining talablari, buzilmaydi):

- Soxta sharh, reyting yoki "faqat 2 ta qoldi" yozilmaydi. Eski narx faqat oxirgi 30 kundagi haqiqiy narx bo'lishi mumkin.
- Mahsulot rasmlari AI bilan o'zgartirilmaydi.
- Sirlar (token, parol, kalit) chatga, logga yoki git'ga chiqmaydi — faqat `.env` / Coolify Environment Variables.
- Pul bilan bog'liq qarorlar faqat admin qo'lida. To'lovlar hozircha soxta (mock) rejimda.
- Yeppo'dan tashqaridagi narsalar (Poizon, serverdagi boshqa loyihalar) egasidan so'ramasdan o'zgarmaydi.

---

## 1. Sayt (`web/`)

### Ishga tushirish (lokal)

```bash
cd web
pnpm install
# Postgres: docker konteyner "yeppo-pg", 127.0.0.1:5434, baza "yeppo" (web/.env da)
pnpm dev                      # http://localhost:3000
pnpm seed --demo              # namuna ma'lumot (12 tovar + sertifikat, 1-marta)
```

`web/.env` git'da yo'q. Kalitlar ro'yxati `web/.env.example` da. Lokalda `SMS_MODE=mock` va `PAYMENTS_MODE=mock`.

### Sifat tekshiruvi (buguni bajarildi, hamma o'tdi)

```bash
pnpm -s tsc --noEmit          # exit 0
pnpm run lint                 # 0 xato (oldindan bor 107 ogohlantirish, yangilanmagan)
pnpm run test:int             # 72/72 test o'tdi (6 ta fayl)
pnpm run build                # exit 0, production build muvaffaqiyatli
```

E2E (Playwright) alohida server bilan: `E2E_BASE=http://localhost:3100 pnpm run test:e2e`

### Nimalar qurilgan

- **Sahifalar (uz/ru):** bosh sahifa, katalog, mahsulot; savat, rasmiylashtirish, buyurtma sahifasi; yuz parvarishi, aksiyalar, brendlar, brend; kim uchun, qidiruv; jurnal va maqola, yordam (5 bo'lim + oferta/maxfiylik), sovg'alar va sertifikatlar; rutina konstruktori, sevimlilar; kirish (SMS kod), kabinet, bonus dasturi, AI maslahatchi; 404.
- **Telefon versiyalari:** MobileHome, MobileCatalog, MobileProduct, MobileCart, MobileCheckout, MobileSearch, MobileAccount, MobileAI. MegaMenu bor.
- **To'lov:** Click va Payme (`src/lib/payments/`). `PAYMENTS_MODE=mock` — haqiqiy pul qabul qilinmaydi.
- **Narx hisobi:** faqat serverda (`src/lib/pricing.ts`).
- **SEO:** har sahifada canonical/hreflang/OG, sitemap, robots, llms.txt, schema.

### Hozirgi rejimlar

- Sayt **parol bilan yopiq** (Basic auth, foydalanuvchi `yeppo`), `noindex` + `robots.txt` `Disallow: /`.
- `PAYMENTS_MODE=mock`, `SMS_MODE=mock` (kirish kodi ekranda ko'rinadi).
- Selfie/biometrik tekshiruv **o'chiq** (yuridik tekshiruvgacha).

### Deploy (server)

Coolify → Docker Compose build pack, repo `original-agents`, branch `master`, base directory `/web`.  
`master` ga push → Coolify'da **Redeploy** (Auto Deploy yoqilsa avtomatik).

Coolify Environment Variables (haqiqiy qiymatlar git/chatga chiqmaydi):

- `SERVICE_PASSWORD_POSTGRES`, `SERVICE_BASE64_64_PAYLOAD` — Coolify avtomatik generatsiya qiladi.
- `SERVICE_PASSWORD_SITE` — sayt paroli (egasi Coolify'da ko'radi).
- `SITE_URL=${SERVICE_URL_WEB}` — Coolify bergan manzil.

Migratsiyalari server ishga tushganda avtomatik bajariladi.

### Backup

- Har kuni 03:00 (Toshkent) `pg_dump`, serverda 7 kun saqlanadi.
- Off-site zaxira (`OFFSITE_*`) hali sozlanmagan.

---

## 2. Bugungi tuzatishlar (commitlar)

- `db5d9ee` — `SITE_URL` endi `SERVICE_URL_WEB` dan olinadi; `SITE_URL` da sxema bo'lmasa `https://` qo'shiladi. `TypeError: Invalid URL` (`generateMetadata`) xatosi tuzatildi. `web/docker-compose.yml` + `web/src/lib/site.ts`.
- `0624581` — variantsiz mahsulotlar katalog va bosh sahifadan chiqariladi ("Cannot read properties of undefined (reading 'sku')" xatosi tuzatildi). `web/src/lib/catalog.ts`. Yangi test: `web/tests/int/catalog.int.spec.ts`.

## 3. Serverga chiqarilgan holat

- Coolify'da Yeppo sayti ishlayapti, oxirgi deploy `0624581` (Success).
- Serverdagi DB konteyneri `db-k0dffhjims7lucm6ytxly88v-*`, media volume `k0dffhjims7lucm6ytxly88v_media`.
- Demo ma'lumotlar serverga to'liq tiklandi: products 13, products_variants 21, products_rels 19, media 38, customers 2, categories 10 (lokal `yeppo_mig` bilan bir xil).
- Sayt tekshirildi: `/uz` → HTTP 200, `/uz/katalog/yuz-parvarishi` → HTTP 200 (sayt ochilmoqda, crash yo'q).
- **Poizon botiga touch qilinmadi.**

---

## 4. Ochiq ishlar

- Domen (`yeppo.uz`) va nom bo'yicha yakuniy qaror (Yeppo / Yeppy).
- Off-site backup tanlovi (Hetzner Storage Box yoki Object Storage) va restore testi.
- Haqiqiy to'lov (Click/Payme) va SMS provayder akkauntlari — hozir mock.
- Telegram bot va kanal.
- Lighthouse tekshiruvi 360/834/1440 kengliklarda.
- Serverdagi xotira tekshiruvi (`free -m`, `docker stats`).
- Serverdagi 2 ta mijoz yozuvi test ma'lumotimi — tasdiqlash kerak.
- Shaxsiy ma'lumotlarni Hetzner'da saqlash bo'yicha yurist fikri.

## 5. Ma'lum muammolar

- ESLint'da 107 ta ogohlantirish bor (asosan `any`), xato yo'q.
- Bonus ballarning muddati o'tishi qoida sifatida ko'rsatiladi, lekin hali amalda ishlamaydi.
- Poizon loyiha `tests/test_llm.py::test_alert_when_a_call_crosses_the_budget` tuzilishi — Yeppo bilan bog'liq emas, egasining ruxsatisiz tuzilmaydi.

## 6. Ustuvor keyingi 3 qadam

1. Domenni aniqlash va DNS/Coolify'da sozlash; `SITE_PASSWORD` va `SITE_NOINDEX` ni olib tashlab saytni ochish.
2. Off-site backup sozlash va restore ni sinash.
3. Haqiqiy to'lov (Click/Payme) va SMS provayderini ulash.
