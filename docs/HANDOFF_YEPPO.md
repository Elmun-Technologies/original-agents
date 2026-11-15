# Yeppo — ishni davom ettiruvchi dasturchi uchun hisobot

Holat sanasi: 2026-11-15. Oxirgi commit: `19cafdb` (`master`, GitHub'ga push qilingan). Ishchi papka toza.

Repo: `Elmun-Technologies/original-agents` (private). Unda ikkita alohida loyiha bor:

| Papka | Nima | Holat |
|---|---|---|
| `app/`, `config/settings.yaml`, `docker-compose.yml` (root) | **Poizon** krossovka boti (eski loyiha) | Serverda ishlaydi, bot **pauzada**. **Egasining ruxsatisiz tegilmaydi.** |
| `web/` | **Yeppo** — koreys kosmetikasi internet-do'koni (Next.js 16 + Payload 3 + Postgres) | Tayyor, testlardan o'tgan, serverga chiqarishga tayyor |
| `yeppo_agents/`, `config/yeppo.yaml` | **Yeppo marketing agentlari** (Python): tovar topish, narx, Instagram paketlari, Telegram | Tayyor, jonli sinovdan o'tgan, serverga hali qo'yilmagan |

Asosiy qoidalar (egasining talablari, buzilmaydi):
- Soxta sharh, reyting yoki "faqat 2 ta qoldi" yozilmaydi. Eski narx faqat oxirgi 30 kundagi haqiqiy narx bo'lishi mumkin.
- Mahsulot rasmlari AI bilan o'zgartirilmaydi.
- Sirlar (token, parol, kalit) chatga, logga yoki git'ga chiqmaydi.
- Pul bilan bog'liq qarorlar faqat admin qo'lida. To'lovlar hozircha soxta (mock) rejimda.
- Yeppo'dan tashqaridagi narsalar (Poizon, serverdagi boshqa loyihalar) egasidan so'ramasdan o'zgartirilmaydi.

---

## 1. Sayt (`web/`)

### Ishga tushirish (lokal)
```
cd web
pnpm install
# Postgres: docker konteyner "yeppo-pg", 127.0.0.1:5434, baza "yeppo" (ulanish satri web/.env da)
pnpm dev                      # http://localhost:3000
pnpm seed --demo              # namuna ma'lumot (12 tovar + sertifikat, 1-marta)
```
`web/.env` git'da yo'q. Kalitlar ro'yxati `web/.env.example` da. Lokalda `SMS_MODE=mock` (kirish kodi ekranda ko'rinadi) va `PAYMENTS_MODE=mock`.

### Testlar
```
pnpm -s tsc --noEmit
npx eslint src                                  # 0 xato (faqat ogohlantirishlar)
pnpm -s vitest run --config ./vitest.config.mts # 71 ta unit test
pnpm build && ADMIN_NOTIFY=off pnpm start -p 3100 &
E2E_BASE=http://localhost:3100 npx playwright test   # 126 ta e2e test
```
E2E haqida:
- Har ishga tushishdan oldin `tests/e2e/global-setup.ts` namuna tovarlar qoldig'ini seed qiymatiga qaytaradi (faqat `sample=true` tovarlar).
- `ADMIN_NOTIFY=off` qo'yilmasa, test buyurtmalari egasining Telegram'iga "To'landi" xabarlarini yuboradi. Egasi bundan shikoyat qilgan.
- Parolli saytga qarshi ishlatish uchun `E2E_PASSWORD=...` beriladi.

### Nimalar qurilgan
- **Sahifalar (uz/ru):**
  - bosh sahifa, katalog, mahsulot;
  - savat, rasmiylashtirish, buyurtma sahifasi;
  - yuz parvarishi, aksiyalar, brendlar, brend;
  - kim uchun, qidiruv (qoidaga asoslangan "tushunish");
  - jurnal va maqola, yordam (5 bo'lim + oferta/maxfiylik), sovg'alar va sertifikatlar;
  - rutina konstruktori, sevimlilar;
  - kirish (SMS kod), kabinet, bonus dasturi, AI maslahatchi (qoidaga asoslangan so'rovnoma);
  - 404.
- **Telefon versiyalari** dizayn bo'yicha: MobileHome, MobileCatalog, MobileProduct, MobileCart, MobileCheckout, MobileSearch, MobileAccount, MobileAI. MegaMenu ham bor.
- **To'lov:** Click va Payme modullari (`src/lib/payments/`). `PAYMENTS_MODE=mock` da `/uz/tolov/sinov` sahifasi imzolangan so'rovlar bilan to'lovni "o'tkazadi".
  - "To'landi" holatiga yagona yo'l — `markPaid`: qoldiqni kamaytiradi, sertifikat kodlarini chiqaradi, adminga xabar beradi.
- **Narx hisobi** faqat serverda (`src/lib/pricing.ts`):
  - promokod va to'plam chegirmasi qo'shilmaydi, eng kattasi olinadi;
  - bepul yetkazish chegirmadan keyingi summa bo'yicha hisoblanadi;
  - bonus ballar ham shu yerda.
- **Kirish:** SMS kod (`src/lib/customer.ts`, `src/lib/sms.ts`; provayder Eskiz):
  - bitta raqamga kuniga 5 ta kod, har kodga 5 ta urinish;
  - ishlatilgan kod qayta ishlamaydi;
  - cookie HMAC bilan imzolanadi.
  - `SMS_MODE=mock` **faqat aniq qo'yilsa** ishlaydi. Unda kod ekranga chiqadi, shuning uchun jonli saytda bo'lishi mumkin emas.
- **SEO:**
  - `src/lib/seo.ts` dagi `meta()`: canonical, hreflang (uz/ru/x-default), OG, Twitter;
  - `sitemap.xml`, `robots.txt`, `llms.txt`;
  - schema: Product, Breadcrumb, FAQ, Article, OnlineStore, WebSite;
  - ikonlar.
  - Filtrli katalog sahifalari noindex.
- **Animatsiyalar:** `styles.css` oxirida. `prefers-reduced-motion` yoqilganda o'chadi.
- **Tezlik:**
  - pastdagi rasmlar kechiktirib yuklanadi;
  - LCP 0,2–0,3 s;
  - telefonda katalog 0,8 MB, bosh sahifa 2,3 MB.
  - Lighthouse ishga tushirishga ruxsat berilmagan, o'lchov Playwright bilan qilingan.
- **Admin panel:** Payload'ning standart paneli `/admin` da ishlaydi (kolleksiyalar `src/collections/`). Egasi keyingi bosqichda **alohida, qulayroq admin panel** so'ramoqchi. U hali boshlanmagan.

### Muhim texnik tafsilotlar
- **Sayt manzili:** bitta runtime sozlama, `SITE_URL` (`src/lib/site.ts`). `NEXT_PUBLIC_SITE_URL` ishlatmang, u build paytida kodga qotib qoladi.
- **Bazadagi o'zgarishlar:**
  - Production'da jadvallar avtomatik yaratilmaydi, migratsiya kerak. Kolleksiya o'zgarsa: `pnpm payload migrate:create <nom>`, hosil bo'lgan faylni commit qiling.
  - Server ishga tushganda migratsiyalar o'zi bajariladi (`prodMigrations`).
  - Dev rejimida Payload sxemani o'zi "push" qiladi.
- **`loading.tsx` qo'shmang:** sahifa oqim bilan yuborilgani uchun 404 sahifalar 200 qaytara boshlaydi. Bu sinab ko'rilgan va olib tashlangan.
- **Konstantalar:** `'use client'` faylidan server sahifasiga konstanta import qilinmaydi. Masalan, `HELP_SLUGS` shu sababli `src/lib/help.ts` ga ko'chirilgan.
- **Menyu:** asosiy menyu va MegaMenu faqat bazada bor kategoriyalarni ko'rsatadi (`categoryCounts`). E2E testdagi crawler barcha ichki havolalarni tekshiradi.

---

## 2. Serverga chiqarish (to'xtagan joy)

**Server:** Hetzner `ubuntu-8gb-hel1-1`, `2.29.137.243`, Coolify. SSH: `ssh root@2.29.137.243`, kalit egasining mashinasida.

Bo'sh resurs (2026-11-15):

| | Jami | Bo'sh |
|---|---|---|
| RAM | 7,5 GB | 4,4 GB (swap 1,8 GB band) |
| Disk | 75 GB | 44 GB |
| CPU | 4 yadro | — |

Serverda ~35 ta boshqa loyiha konteyneri ishlaydi, ularga tegmang.

### Tayyor
- `web/Dockerfile`: standalone, pnpm 10.28.0, media uchun volume, healthcheck. Image 452 MB, ishlaganda ~230 MB RAM.
- `web/docker-compose.yml` (Coolify uchun). Xizmatlar:

  | Xizmat | Xotira chegarasi |
  |---|---|
  | `web` | 768 MB |
  | `db` (postgres:16) | 384 MB |
  | `backup` | 128 MB |

  Port ochilmaydi. Sirlarni Coolify o'zi generatsiya qiladi: `SERVICE_PASSWORD_POSTGRES`, `SERVICE_BASE64_64_PAYLOAD`, `SERVICE_PASSWORD_SITE`.
- **Yopiq test rejimi** (`SITE_PASSWORD` + `SITE_NOINDEX=1`):
  - har sahifa parol so'raydi (Basic auth, foydalanuvchi `yeppo`);
  - har javobda `X-Robots-Tag: noindex` sarlavhasi, HTML'da meta noindex;
  - `robots.txt`: `Disallow: /`;
  - `/api` va `robots.txt` parolsiz ochiq.
- **Zaxira** (`web/deploy/backup/`):
  - har kuni 03:00 da `pg_dump` olinadi va rasmlar papkasi bilan birga rclone orqali tashqi joyga (`offsite:`) yuboriladi;
  - `restore-test.sh` eng yangi nusxani vaqtinchalik bazaga tiklab tekshiradi.
  - Butun zanjir lokal papka bilan sinalgan: tiklangan bazada 13 tovar, 38 rasm.
- **Lokal sinov:** production image'ga qarshi, parol yoqilgan holda 126 ta e2e testning hammasi o'tdi.
- Yo'riqnoma: `web/deploy/README.md`.

### Qolgan qadamlar (tartib bilan)
1. **Coolify API token.** Egasi Coolify → Keys & Tokens'da token yaratib, repo ildizidagi `coolify.env` fayliga `COOLIFY_TOKEN=...` qilib yozishi kerak (fayl gitignore'da). Token hali berilmagan. Muqobil yo'l: egasi resursni panelda o'zi yaratadi.
2. **Coolify'da resurs yaratish:**
   - turi Docker Compose;
   - repo `original-agents`, branch `master`, Base Directory `/web`;
   - deploy key Poizon resursida ishlatilgani bilan bir xil (faqat o'qish huquqi);
   - domen: Coolify bergan vaqtinchalik `*.sslip.io`. Haqiqiy domen yo'q, `yeppo.uz` hali olinmagan.
3. **Birinchi deploy.** Serverda build ~2 GB RAM va bir necha daqiqa oladi (type check o'chirilgan: `SKIP_TYPECHECK=1`).
4. **Namuna ma'lumot.** Serverdagi bo'sh bazaga migratsiya o'zi bajariladi. Keyin bitta yo'l:
   - **Tayyor nusxa:** lokal `yeppo_mig` bazasi toza holatda (13 tovar, 38 rasm, buyurtma va mijoz yo'q). Undan `pg_dump` olib serverga tiklash, `web/media/` papkasini volume'ga ko'chirish.
   - **Yoki seed:** seed'ni serverda ishga tushirish. Lekin `src/seed.ts` `../design/yeppo-handoff` papkasini o'qiydi, u image ichida yo'q.
5. **Tashqi zaxira.** Egasi Hetzner **Storage Box** (BX11) olishi kerak. Ma'lumotlarini Coolify'ga **egasining o'zi** kiritadi: `OFFSITE_TYPE=sftp`, `OFFSITE_HOST`, `OFFSITE_PORT=23`, `OFFSITE_USER`, `OFFSITE_PASS_OBSCURED`. Keyin serverda:
   ```
   docker exec <backup> sh -c 'BACKUP_NOW=1 backup.sh'
   docker exec <backup> restore-test.sh
   ```
6. **Egasiga topshirish:**
   - telefonda ochiladigan havola;
   - sayt paroli: chatga yozilmaydi, egasi Coolify Environment Variables'dagi `SERVICE_PASSWORD_SITE` maydonida ko'radi;
   - 360, 834 va 1440 px'dagi Lighthouse yoki Playwright natijalari.
7. **Domen** olinganda:
   - DNS'da `A` yozuvini `2.29.137.243` ga yo'naltirish;
   - Coolify'da domenni almashtirish va `SITE_URL` ni yangilash;
   - jonli ochilishda `SITE_PASSWORD` va `SITE_NOINDEX` ni olib tashlash.

---

## 3. Marketing agentlari (`yeppo_agents/`)

Zanjir: talab → Q-Depot (manba) → narx → kartochkalar, story, Reels MP4 → Telegram (@Originalpobot) → egasi Instagram'ga o'zi joylaydi.

```
uv run pytest tests/yeppo -q          # 41 ta test
uv run python -m yeppo_agents.bot     # bot + jadval
```

- **Manba: faqat Q-Depot.** Olive Young, Coupang va Gmarket botlarni bloklaydi, chetlab o'tilmaydi.
- **Saytga hurmat:**
  - robots.txt `*` belgili qoidalari bilan o'qiladi (`fetch.Robots`);
  - so'rovlar orasida 5–10 soniya pauza, 12 soatlik kesh;
  - 403, 429 yoki captcha chiqsa darhol to'xtaydi.
- **Narx raqamlari** `config/yeppo.yaml` da, `TODO(admin)` deb belgilangan: kargo $/kg, bojxona %, ustama %. Egasi haqiqiylarini berishi kerak.
- **Matnlar:** AI faqat tavsif yozadi. Narx, yetkazish, qaytarish va CTA'ni kod qo'shadi. Yolg'on da'volar filtrda rad etiladi.
- **"Katalogga qo'shish" tugmasi** tovarni saytga Payload REST orqali **qoldiq 0** bilan qo'shadi. Buning uchun saytda agent uchun admin foydalanuvchi kerak (`YEPPO_API_EMAIL` / `YEPPO_API_PASSWORD`).
- **Deploy:** `Dockerfile.yeppo-agents` (ffmpeg bilan) va `docker-compose.yeppo-agents.yml`. O'zgaruvchilar `.env.yeppo-agents.example` da. Serverga **hali qo'yilmagan**.
- ⚠️ **Bot tokeni:** @Originalpobot tokenini Poizon boti bilan bir vaqtda faqat bitta jarayon o'qiy oladi. Poizon pauzada qolishi kerak, yoki alohida Yeppo boti ochiladi.

---

## 4. Ochiq savollar va egasidan kutilayotganlar
- Haqiqiy tovarlar, narxlar, qoldiqlar, partiya raqamlari, yaroqlilik muddatlari va sertifikatlar. Hozir saytda namuna ma'lumot.
- Ommaviy oferta va maxfiylik siyosati matnlari (yurist).
- Click, Payme va Eskiz SMS hisoblari. Ular kelguncha to'lov va SMS soxta (mock) rejimda.
- Telegram kanal havolasi.
- 300 000 so'mdan bepul yetkazish viloyatlarga ham amal qiladimi? Hozir amal qiladi.
- Agent narx raqamlari (yuqoridagi 3-bo'lim).

## 5. Ma'lum kamchiliklar
- Poizon: `tests/test_llm.py::test_alert_when_a_call_crosses_the_budget` tushyapti. Bu eski muammo, Yeppo bilan bog'liq emas, egasining ruxsatisiz tuzatilmagan.
- ESLint'da 103 ta ogohlantirish bor (asosan `any`), xato yo'q.
- Bonus ballar:
  - ballarning muddati o'tishi qoida sifatida ko'rsatiladi, lekin hali amalda ishlamaydi;
  - 12 soatdan keyin to'langan buyurtmada ballar ikki marta ishlatilishi mumkin (kichik xavf).
- Agent tovar o'xshashligini nom so'zlari bo'yicha aniqlaydi. Katalogda shtrix-kod paydo bo'lsa, shunga o'tkazish kerak.

## 6. Keyingi bosqichlar (egasi aytgan tartibda)
1. Serverga chiqarishni tugatish (2-bo'lim).
2. Agentlarni serverga qo'yish.
3. **Alohida admin panel** qurish.
