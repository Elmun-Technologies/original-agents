# Yeppo — ishni davom ettiruvchi dasturchi uchun hisobot

Holat sanasi: 2026-11-25. Kod `master`'da (PR #1 qoʻshilgan). Egasi bajaradigan ishlar alohida: [EGASI_UCHUN.md](EGASI_UCHUN.md).

## 0. Hozirgi holat va BIRINCHI vazifa (2026-11-25)

**Kod:** PR #1 `master`'ga qoʻshilgan (merge commit `6e03401`). Tekshiruvlar yashil: integratsiya 173, e2e 135, agentlar 74, `tsc` va `lint` xatosiz.

**Server: yangi versiya hali serverga chiqmagan va Coolify’da Yeppo resursi bilan muammo bor.** Quyidagilar egasining brauzer yordamchisi hisobotidan olingan; men (Claude) sandbox’dan `2.29.137.243` ga ulana olmadim, shuning uchun oʻzim tekshirmaganman:

- Coolify: `http://2.29.137.243:8000` (v4.7.6), jamoa «Root Team», bitta loyiha `original-agents`, `production` muhitida **faqat bitta resurs**: eski **Poizon boti** (UUID `akbhpw6zbnceaqr…`, holati «Running»).
- Yeppo resursi (UUID `k0dffhjims7lucm6ytxly88v`, hujjatlarda eski HANDOFF’da shunday yozilgan) **bu Coolify’da yoʻq**: `/application/<uuid>` va `/service/<uuid>` ikkalasi 404.
- Lekin `https://web-k0dffhjims7lucm6ytxly88v.2.29.137.243.sslip.io/uz` 2026-11-25 05:46 (Toshkent) da egasida Basic-auth soʻradi, yaʼni Yeppo konteynerlari serverda **ishlayapti** (yoki ishlagan). Taxmin (tekshirilmagan): Coolify bazasi qayta oʻrnatilgan/tozalangan, konteynerlar boshqaruvsiz (yetim) qolgan.
- 2026-11-25 ~06:03 (Toshkent) egasi adashib **Poizon resursini** Redeploy qildi: commit `6e03401`, «Manual», 2 daq 1 s, «Finished». Poizon kodi (`app/`, root `Dockerfile`, root `docker-compose.yml`) men tomondan oʻzgartirilmagan, shuning uchun xatti-harakati oʻzgarmasligi kerak. Baribir tekshiring: u resursning Environment Variables’ida `BOT_HOLD=true` boʻlishi kerak (bot «pauzada» degani shu, konteyner oʻchirilgani emas).

### Birinchi vazifalar (ketma-ket)

1. **Faqat oʻqish diagnostikasi** (Coolify → Servers → localhost → Terminal, yoki Hetzner Console, yoki `ssh root@2.29.137.243`). Hech narsa oʻzgartirilmaydi:
   ```bash
   docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | head -40
   docker volume ls | grep -i -E 'k0dff|pg_data|media|backup'
   free -m && df -h /
   ```
   Savol: nomida `k0dffhjims7lucm6ytxly88v` boʻlgan konteyner (web/db/backup) bormi va ishlayaptimi? Natijani shu boʻlimga yozib qoʻying.
2. Poizon resursida `BOT_HOLD` qiymatini tekshiring (parol emas, koʻrish xavfsiz). `true` boʻlmasa — egasiga darhol ayting, botga oʻzingiz tegmang.
3. **Yeppo uchun yangi Coolify resursi** (serverni oʻzgartiradi — avval egasidan ruxsat oling). Qadamlar `web/deploy/README.md` → «Yeppo resursini yaratish». Yetim konteynerlar/volume’larni egasi aytmaguncha **oʻchirmang**.
4. Deploydan keyin tekshiruv: `/uz` (parol: foydalanuvchi `yeppo`, parol — Coolify’dagi `SERVICE_PASSWORD_SITE`), `/admin` da birinchi admin yaratish, **Admin → Ishga tushirishga tayyorlik** ochiladi, `POST /api/t` 204 qaytaradi, `payload_migrations` jadvalida 5 ta yozuv.
5. Shundan keyin egasi bajaradigan ishlar boshlanadi: `docs/EGASI_UCHUN.md`.

### Maʼlumot haqida

Eski Yeppo bazasida faqat namuna mahsulotlar (13 ta) va 2 ta test mijoz boʻlgan (eski HANDOFF). Yangi resurs yangi, boʻsh baza oladi (yangi `SERVICE_BASE64_64_PAYLOAD` bilan). Ishlab turgan konteynerda `tsx`/`pnpm` yoʻq (standalone image): namuna maʼlumot kerak boʻlsa, uni admin orqali qoʻlda kiritiladi; `pnpm seed` faqat dasturchi kompyuterida.

### Qaror qilingan narsalar (egasidan qayta soʻramang)

- Admin va maydon nomlari oʻzbekcha; Payload’ning oʻz tugmalari ruscha (Payload’da oʻzbekcha yoʻq).
- Kalitlar admin panelda (shifrlangan), server env — zaxira. Sayt ochiq/yopiq holati hozircha env’da (`SITE_PASSWORD`, `SITE_NOINDEX`).
- Oʻz analitikamiz cookie ishlatadi (anonim), shaxsiy maʼlumot saqlamaydi; maxfiylik siyosatiga qoʻshish egasi/yurist ishi.
- Mijozlar boti — adminga xabar yuboradigan **bir xil** bot tokeni (Integratsiyalar → Telegram), webhook faqat https domen bilan.
- Qoidalar buzilmaydi: soxta sharh/reyting/kamyoblik yoʻq, rasm AI bilan oʻzgartirilmaydi, sirlar chatga/gitga tushmaydi, pul qarorlari admin qoʻlida, Poizon’ga ruxsatsiz tegilmaydi.

### Egasidan hal boʻlishi kutilayotgan savollar

Sayt nomi (Yeppo yoki Yeppy) va domen; Click/Payme/Eskiz akkauntlari; yurist matnlari (oferta, maxfiylik); haqiqiy yetkazish narxlari, muddatlar va bonus darajalari (hozir NAMUNA); Hetzner Storage Box (zaxira nusxa); agentlarni ishga tushirish (`docs/EGASI_UCHUN.md` 7-bosqich).

### Ish usuli haqida

- Egasi texnik mutaxassis emas, oʻzbek tilida yozadi (lotin). Javoblar qisqa va aniq boʻlsin; har bir qadamda qayerga bosishni ayting.
- Sandbox’dan serverga chiqib boʻlmaydi. Egasi Coolify’da brauzer kengaytmasidan foydalanadi: unga ingliz tilida aniq, **faqat oʻqish yoki bitta harakat** buyuradigan prompt bering (namuna: qoidalari — env qiymatlarini oʻqima, oʻchirma/toʻxtatma, bir martadan koʻp Redeploy qilma, parolni oʻzi yozma).
- Branch’ga yozing, `master`’ga faqat egasi roziligi bilan PR orqali qoʻshing.

---

Repo: `Elmun-Technologies/original-agents` (private). Unda uchta alohida qism bor:

| Papka | Nima | Holat |
|---|---|---|
| `web/` | **Yeppo** — koreys kosmetikasi internet-doʻkoni (Next.js 16 + Payload 3 + Postgres) | Serverda yopiq test rejimida. Bu branch'dagi yangilanishlar hali serverga chiqarilmagan (Redeploy kerak) |
| `yeppo_agents/`, `config/yeppo.yaml` | Marketing agentlari (Python): tovar topish, narx, Instagram paketlari, Telegram | Kodi tayyor va sinalgan, serverga qoʻyilmagan |
| `app/`, `config/settings.yaml`, `docker-compose.yml` (root) | Poizon krossovka boti (eski loyiha) | Pauzada. **Egasining ruxsatisiz tegilmaydi** |

Qoidalar (egasi talabi, buzilmaydi): soxta sharh/reyting/kamyoblik yoʻq; rasm AI bilan oʻzgartirilmaydi; sirlar faqat Integratsiyalar sahifasida (shifrlangan) yoki Coolify’da; pul qarorlari faqat admin qoʻlida; Poizon va boshqa loyihalarga tegilmaydi.

---

## 1. Arxitektura (web/)

```
src/app/(frontend)/[lang]/…   ochiq sayt (uz/ru), ISR 60 s
src/app/(payload)/            Payload admin + REST/GraphQL
src/app/api/                  shop (savat/buyurtma), pay (click/payme/mock), auth (SMS kod), account,
                              t (analitika kollektori), admin/* (faqat admin: integrations, heat, customers)
src/app/indexnow/[key]/       IndexNow kalit fayli
src/collections/              maʼlumotlar modeli; labels.ts — admin matnlari oʻzbekcha
src/lib/                      biznes mantiq (pricing, orders, payments/, loyalty, order-state, …)
src/components/admin/         admin ekranlari (Analitika, Heatmap, Marketing, SEO, Tayyorlik, Integratsiyalar, panel vidjeti)
src/migrations/               Postgres migratsiyalari (server ishga tushganda oʻzi bajaradi)
tests/int/                    vitest (haqiqiy Postgres bilan), tests/e2e/ Playwright
```

### Bu sessiyada qoʻshilgan asosiy mexanizmlar

| Mexanizm | Fayllar | Esda tuting |
|---|---|---|
| **Integratsiyalar** (kalitlar admin panelda) | `lib/integrations-def.ts` (hamma xizmatlar bitta jadvalda), `lib/integrations.ts` (oʻqish, kesh 10 s), `lib/secrets.ts` (AES-256-GCM, kalit = `PAYLOAD_SECRET` dan), `collections/integrations.ts`, `components/admin/Integrations*.tsx`, `app/api/admin/integrations/` | Qiymat ustuvorligi: admin panel → server env → standart. Yangi xizmat qoʻshish: `SERVICES` ga yozuv, migratsiya (`pnpm payload migrate:create`). «Live» rejim kalitlarsiz saqlanmaydi (`validate`, faqat oʻzgargan maydonlar tekshiriladi). `PAYLOAD_SECRET` almashsa, sirlar oʻqilmaydi (UI buni koʻrsatadi) |
| **Toʻlov holati** | `lib/order-state.ts`, `lib/orders.ts` (`markPaid` — atomar `UPDATE … WHERE payment_status <> 'paid'`; qoldiq SQL bilan, 0 dan pastga tushmaydi), `payments/click.ts`, `payments/payme.ts` | Toʻlov oynasi 12 soat, ball va sertifikat balansi 24 soat band qilinadi. Muvaffaqiyatsiz urinishdan keyin qayta toʻlash mumkin. `paymentsMode()/clickConfig()/paymeConfig()` **async** |
| **Bonus muddati** | `lib/loyalty.ts` `pointsBalance` (toza funksiya) | `Store.loyalty.expireMonths` boʻsh = yonmaydi |
| **Oʻz analitikamiz** | `collections/analytics.ts`, `lib/analytics-ingest.ts` (tekshiruv, toza), `lib/analytics-record.ts`, `lib/analytics.ts` (hisobotlar), `lib/track-client.ts` + `components/Tracker.tsx`, `app/api/t/route.ts` | Shaxsiy maʼlumot yoʻq (IP, UA, query, ism saqlanmaydi). Bot va admin kirishlari tashlanadi. Buyurtma `src/med/cmp/landing/visitor/session` maydonlarini saqlaydi; `order_created` va `purchase` hodisalari serverdan. Saqlash muddati: click 90 kun, scroll/vitals 180, qolgani 2 yil (`purgeOldEvents`) |
| **Admin ekranlari** | `payload.config.ts` → `admin.components.views` / `beforeNavLinks` / `beforeDashboard`; `AdminPage.tsx` kirishni tekshiradi | Maxsus view Payload tomonidan **himoyalanmaydi**: har view `AdminPage` ichida boʻlsin, har API `adminUser()` ni tekshirsin |
| **SEO** | `lib/seo.ts` (meta), `lib/seo-audit*.ts`, `components/ThirdPartyTags.tsx`, `lib/indexnow.ts`, `Products/Articles` `seoTitle/seoDescription` | Teglar faqat sayt ochiq (`SITE_PASSWORD`/`SITE_NOINDEX` yoʻq) va ID tekshiruvdan oʻtganda qoʻyiladi |
| **Mijozlar uchun Telegram bot** | `lib/telegram.ts` (API, webhook sirri), `lib/telegram-bot.ts` (`/start o_<n>_<token>`, `notify_<sku>`, `buy_<sku>`, `account`, `/stop`), `app/api/telegram/route.ts`, `collections/waitlist.ts`, `orders.telegramChat`, hook’lar `payload.config.ts` da | Webhook faqat `X-Telegram-Bot-Api-Secret-Token` (HMAC(PAYLOAD_SECRET, token)) bilan. Chat id faqat mijoz tugmani bosgandan keyin saqlanadi. Holat oʻzgarishi (order hook) va qoldiq 0→>0 (product hook) xabar yuboradi. Telegram faqat https webhook qabul qiladi — domen kerak |
| **Rasmlar** | `src/app/(payload)/api/media/file/[...path]/route.ts`, `lib/media-url.ts` (`thumb`) | `/api/media/file/<nom>` endi rasmni 1200 px gacha WebP (yoki JPEG) qilib beradi, `?w=` bilan kichik, `?raw=1` asl; PDF/SVG oʻzgarishsiz; diskda keshlanadi (`$TMPDIR/yeppo-media-cache`). Kartalar va savat `?w=640/480` oladi. Payload’ning oʻz fayl yoʻli oʻrniga ishlaydi (aniqroq yoʻl ustun) |
| **Tayyorlik / Marketing** | `lib/readiness*.ts`, `lib/marketing.ts` | Roʻyxat statik emas — haqiqiy holatdan hisoblanadi (`buildChecklist` toza funksiya) |

Sayt ochiq/yopiq holati hali **env** orqali (`SITE_PASSWORD`, `SITE_NOINDEX`, `proxy.ts` har soʻrovda oʻqiydi). Admin panelga koʻchirish mumkin, lekin proxy’da DB oʻqish kerak boʻladi — ataylab qilinmadi.

---

## 2. Ishga tushirish va tekshirish

```bash
cd web
pnpm install
# Postgres (127.0.0.1:5432, foydalanuvchi yeppo/yeppo): baza yeppo va yeppo_test
cp .env.example .env              # DATABASE_URI, PAYLOAD_SECRET (>=16 belgi), SITE_URL, SMS_MODE=mock
NODE_ENV=production pnpm payload migrate     # migratsiyalar (serverdagidek)
NODE_ENV=production pnpm seed --demo         # namuna maʼlumot (design/ boʻlmasa src/seed-data dan)
ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm admin:create
pnpm dev
```

```bash
pnpm -s tsc --noEmit
pnpm run lint                                        # 0 xato (ogohlantirishlar: asosan `any`)
TEST_DATABASE_URI=postgres://yeppo:yeppo@localhost:5432/yeppo_test pnpm run test:int   # 149+ test, alohida baza
pnpm run build
# e2e (ishlayotgan serverga qarshi; build + start -p 3100):
E2E_BASE=http://localhost:3100 E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… pnpm run test:e2e
```

- Integratsiya testlari **haqiqiy Postgres** ishlatadi (`TEST_DATABASE_URI` — saytning bazasi tozaligi uchun). Fayllar ketma-ket yuradi (umumiy baza).
- `PW_CHROMIUM=/yoʻl/chrome` — oʻrnatilgan brauzerni ishlatish (CI/sandbox).
- E2E admin testlari `E2E_ADMIN_*` boʻlmasa oʻtkazib yuboriladi.
- Migratsiya qoidasi: sxema oʻzgarsa `pnpm payload migrate:create <nom>`, fayl commit qilinadi; **dev rejimda push** qilingan bazaga migratsiya qoʻllab boʻlmaydi — migratsiya bilan yaratilgan bazadan foydalaning (`NODE_ENV=production`).
- Skriptlar (`seed`, `e2e-reset`) saytdan tashqarida ishlaydi: hook’lardagi `server-only` importlar `try/catch` bilan oʻralgan, yangi hook yozsangiz shunday qiling.

Oxirgi tekshiruv natijasi (2026-11-25): `tsc` toza, `lint` 0 xato, integratsiya 173/173, e2e 135/135 (126 ochiq sayt + 9 admin), `uv run pytest tests/yeppo` 74/74. Toza bazada 5 ta migratsiya xatosiz qoʻllanadi; Docker rasmidagi `standalone` server toza bazada ishga tushirilib tekshirilgan.

**Lighthouse** (lokal, production build, 2026-11-25): SEO 100 va Best Practices 100 barcha tekshirilgan sahifalarda; Accessibility 96–100; Performance: kompyuterda 97–99, telefonda katalog 92, mahsulot 95, bosh sahifa 83 (simulyatsiya qilingan sekin 4G da LCP 4.6 s; haqiqiy oʻlchovda 0.5 s). Boshlangʻich oʻlchov: bosh sahifa telefonda 75, SEO mahsulot sahifasida 92.

---

## 3. Ochiq ishlar (dasturchi tomondan)

| Ish | Izoh |
|---|---|
| Search Console / Yandex Vebmaster maʼlumotini admin’ga olib kelish | Google xizmat akkaunti JSON va Yandex OAuth token kerak (egasi beradi). Analitika → yangi «Qidiruv tizimlari» boʻlimi |
| Marketing agentlarini serverga qoʻyish | `docker-compose.yeppo-agents.yml`, `.env.yeppo-agents.example`; avval `DRY_RUN=true` |
| Avtomatik xabar (tashlab ketilgan buyurtma, qaytarish) | Eskiz/Telegram shablonlari va mijoz roziligi kerak |
| Sayt ochiq/yopiq holatini admin panelga koʻchirish | Yuqorida: proxy’da DB oʻqish |
| Lighthouse tekshiruvi (360/834/1440) | Haqiqiy domen va haqiqiy server kerak; hozir faqat oʻz analitikamiz tezlikni oʻlchaydi (Analitika → Tezlik) |
| ESLint ogohlantirishlari (~124, asosan `any`) | Xato yoʻq |
| Haqiqiy Click/Payme sinov kassasi tekshiruvlari | Akkaunt kerak. Kod rasmiy protokol boʻyicha yozilgan va unit-test qilingan, lekin jonli provayderda hali sinalmagan |

## 4. Maʼlum cheklovlar

- Click/Payme kodi provayderlarning jonli kabinetida **sinalmagan** (akkaunt yoʻq); protokol testlari mahalliy.
- Analitikada «Qidiruv» bolimi butun vaqt uchun (davr tanlanmaydi) — `search_log` jadvali shunday.
- Heatmap bosishlarni sahifa koordinatasida saqlaydi: sahifa maketi keskin oʻzgarsa, eski bosishlar siljib koʻrinishi mumkin (davrni qisqartiring).
- Analitikada «tashrifchi» — brauzer cookie’si; bitta odam telefon va kompyuterdan kirsa, ikki tashrifchi.
- Sayt faqat bitta server nusxasida ishlaydi: integratsiya keshi va tezlik cheklovi xotirada (koʻp nusxaga oʻtilsa Redis kerak).
