# Keyingi dasturchi uchun ishga tushirish prompti

Quyidagi matnni (kod blokini) yangi Claude Code sessiyasiga yoki boshqa dasturchiga bering. U hamma narsani qayta aniqlab oʻtirmasdan, kelgan joyidan davom etadi. Prompt ataylab qisqa: tafsilotlar hujjatlarda.

```
Sen Yeppo loyihasining ishini davom ettirasan. Repo: Elmun-Technologies/original-agents (private), branch: master.

NIMA BU
Yeppo — O'zbekiston uchun koreys kosmetikasi internet-do'koni (uz/ru): Next.js 16 + Payload CMS 3 + Postgres (papka web/), Coolify (Hetzner) da Docker Compose orqali. Alohida: marketing agentlari (yeppo_agents/, Python, serverga qo'yilmagan) va eski Poizon boti (app/, pauzada, tegilmaydi). Kod tayyor va sinalgan; qolgan ish — serverga chiqarish va egasi bajaradigan sozlamalar.

AVVAL O'QI (shu tartibda, boshqa narsani qayta tadqiq qilma)
1. docs/HANDOFF_YEPPO.md — §0 "Hozirgi holat va BIRINCHI vazifa", arxitektura, testlar, ochiq ishlar, qaror qilingan narsalar.
2. docs/EGASI_UCHUN.md — egasi bajaradigan ishlar (ketma-ket) va saytda hozircha YO'Q narsalar.
3. web/deploy/README.md — Coolify, zaxira nusxa, "Yeppo resursini yaratish".
4. docs/yeppo_agents.md — marketing agentlari.

HOLAT (2026-11-25)
- Kod master'da (PR #1 qo'shilgan), hamma test yashil: web integratsiya 173, e2e 135, agentlar 74.
- Admin panel (o'zbekcha): Integratsiyalar, Analitika, Heatmap, Marketing, SEO audit, Ishga tushirishga tayyorlik; mijozlar uchun Telegram bot; to'lov (Click/Payme) kodi tayyor, lekin jonli provayderda sinalmagan.
- MUAMMO: yangi versiya serverga chiqmagan. Coolify (http://2.29.137.243:8000) da faqat eski Poizon boti resursi bor; Yeppo resursi (UUID k0dffhjims7lucm6ytxly88v) yo'q, lekin sayt web-k0dffhjims7lucm6ytxly88v.2.29.137.243.sslip.io da javob bermoqda (yetim konteynerlar bo'lishi mumkin). Poizon resursi adashib qayta deploy qilingan (kodi o'zgarmagan; BOT_HOLD=true ekanini tekshirish kerak).

BIRINCHI VAZIFALAR (HANDOFF §0 da buyruqlar bor)
1. Serverda FAQAT-O'QISH diagnostika: docker ps -a, docker volume ls, free -m, df -h. Natijani HANDOFF §0 ga yoz.
2. Poizon resursida BOT_HOLD=true ekanini tekshir (parol emas). Aks holda egasiga darhol ayt, botga o'zing tegma.
3. Egasidan ruxsat olib, Yeppo uchun yangi Coolify resursini yarat (web/deploy/README.md). Yetim konteyner/volume'larni egasi aytmaguncha o'chirma.
4. Deploydan keyin tekshir: /uz, /admin (birinchi admin), "Ishga tushirishga tayyorlik" sahifasi, POST /api/t = 204, payload_migrations da 5 yozuv.
5. Keyin docs/EGASI_UCHUN.md dagi ishlarda egasiga yordam ber (akkauntlar, kalitlar, domen, sayt ochish, haqiqiy to'lovga o'tish).

QOIDALAR (buzilmaydi)
- Soxta sharh/reyting/"faqat 2 ta qoldi" yo'q. Mahsulot rasmi AI bilan o'zgartirilmaydi.
- Sirlar (token, parol, kalit) chatga, logga, gitga tushmaydi: faqat Integratsiyalar sahifasi (shifrlangan) yoki Coolify. Coolify Environment Variables qiymatlarini o'qima va ko'chirma. SERVICE_BASE64_64_PAYLOAD ni o'zgartirma (kalitlar shu bilan shifrlangan).
- Pul qarorlari (to'lovni qaytarish, xarid) faqat egasida. Poizon va serverdagi boshqa loyihalarga ruxsatsiz tegilmaydi.
- Serverni o'zgartiradigan har bir harakatdan (resurs yaratish, o'chirish, qayta ishga tushirish, env o'zgartirish) oldin egasidan aniq ruxsat ol. Bir deploy xato bersa, qayta-qayta urinma: logning oxirgi 40 qatorini o'qib sababini top.
- master'ga to'g'ridan-to'g'ri yozma: branch + PR; qo'shish faqat egasi roziligi bilan.

ISH USULI
- Egasi texnik mutaxassis emas, o'zbek (lotin) yozadi. Qisqa, aniq javob ber; har qadamda qayerga bosishni ayt.
- Sandbox'dan serverga chiqib bo'lmaydi (tarmoq proksisi bloklaydi). Egasi Coolify'da brauzer kengaytmasidan foydalanadi: unga ingliz tilida aniq, FAQAT-O'QISH yoki BITTA harakat buyuradigan prompt ber (env qiymatlarini o'qima, o'chirma/to'xtatma, Redeploy bir martadan ko'p emas, parolni o'zi yozma).
- Kod o'zgartirsang: web/ da `pnpm -s tsc --noEmit`, `pnpm run lint`, `TEST_DATABASE_URI=postgres://yeppo:yeppo@localhost:5432/yeppo_test pnpm run test:int`, kerak bo'lsa e2e (HANDOFF §2). Sxema o'zgarsa `pnpm payload migrate:create <nom>` va migratsiya faylini commit qil. Agentlar: `uv run pytest tests/yeppo -q`.
- Yangi hook/skript yozsang: `server-only` modullarni hook ichida try/catch bilan oraltir (skriptlar saytdan tashqarida ishlaydi) va hook'larni payload.config.ts da ro'yxatga ol, collections/ fayllarida emas (ular brauzer kodiga ham import qilinadi).

TUGADI DEYISH SHARTI
Yeppo serverda yangi versiyada ishlayapti (parol bilan yopiq), admin kirish ishlayapti, "Ishga tushirishga tayyorlik" sahifasi ochiladi, Poizon boti o'zgarmagan (BOT_HOLD=true), va HANDOFF §0 yangilangan (nima aniqlandi, nima qilindi). Oxirida egasiga 5–10 qatorli hisobot ber: nima tayyor, nima uning qo'lida (EGASI_UCHUN bo'yicha), keyingi bitta qadam.
```

## Egasi uchun eslatma

Bu faylni va `docs/HANDOFF_YEPPO.md` ni oʻzgartirib turing: har bir sessiya oxirida §0 «Hozirgi holat» boʻlimini yangilab qoʻyilsa, keyingi dasturchi yana boshidan boshlamaydi.
