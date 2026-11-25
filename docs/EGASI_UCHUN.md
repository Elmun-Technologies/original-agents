# Yeppo — egasi uchun: nima tayyor, siz nima qilasiz

Sana: 2026-11-25. Bu hujjat faqat **sizning qoʻlingizdagi ishlarni** tartib bilan sanaydi. Dasturchi qismi tayyor va sinalgan. Har bir band qayerda va nima bosish kerakligini aytadi. Sayt ichidagi **Admin → «Ishga tushirishga tayyorlik»** sahifasi shu roʻyxatni saytning hozirgi holatiga qarab oʻzi tekshiradi va bajarilganini yashil qiladi.

Admin panel manzili: `https://<sayt manzili>/admin`

---

## 0. Hozir nima tayyor (siz qoʻl tegizmaysiz)

| Nima | Qayerda |
|---|---|
| Sayt: katalog, mahsulot, savat, buyurtma, kabinet, bonus, jurnal, qidiruv (uz/ru) | saytning oʻzi |
| Click va Payme toʻlov kodi (rasmiy protokol boʻyicha, ikki marta toʻlashdan himoyalangan) | tayyor, kalit kerak |
| SMS orqali kirish (Eskiz) | tayyor, akkaunt kerak |
| Adminga Telegramda buyurtma xabari | tayyor, bot kerak |
| **Oʻz analitikamiz**: tashrifchilar, manbalar, xarid yoʻli, mahsulotlar, tezlik, hozir kim saytda | Admin → Analitika |
| **Heatmap** (qayerga bosishadi, qayergacha oʻqishadi) | Admin → Heatmap |
| **Marketing**: toʻlanmay qolgan buyurtmalar, mijoz guruhlari + jadval, reklama havolasi yasagich, promokod natijasi | Admin → Marketing |
| **SEO audit** va avtomatik SEO (sitemap, hreflang, sxemalar, IndexNow) | Admin → SEO audit |
| **Integratsiyalar**: hamma kalitlar shu sahifadan kiritiladi, server qayta ishga tushirilmaydi | Admin → Integratsiyalar |
| Ishga tushirishga tayyorlik roʻyxati | Admin → Ishga tushirishga tayyorlik |
| Admin menyusi oʻzbekcha | Admin |

**Analitika uchun Google yoki Yandex akkaunti shart emas.** Hammasi admin ichida koʻrinadi. Google/Yandex/Meta kodlarini qoʻshsangiz, ular ham ishlaydi (reklama va ularning hisobotlari uchun).

---

## 1-bosqich. Server va admin (30 daqiqa)

1. **Yangilanishni serverga chiqaring.** Coolify → Yeppo resursi → **Redeploy**. Maʼlumotlar bazasi oʻzgarishlari (migratsiya) oʻzi bajariladi, maʼlumot yoʻqolmaydi.
2. **Admin akkaunt.** Agar hali admin yoʻq boʻlsa: brauzerda `/admin` oching — birinchi foydalanuvchini yaratish oynasi chiqadi. Email va **uzun parol** (kamida 12 belgi) kiriting. Parolni parol-menejerda saqlang.
3. **Maxfiy kalitni saqlab qoʻying.** Coolify → Environment Variables → `SERVICE_BASE64_64_PAYLOAD` qiymatini xavfsiz joyga (parol-menejer) nusxalang. Integratsiyalardagi parol va kalitlar shu kalit bilan shifrlanadi. **Uni oʻzgartirmang.** Yoʻqolsa yoki oʻzgarsa, maʼlumotlar yoʻqolmaydi, faqat kiritilgan kalitlarni (Click, Payme, Eskiz, bot) qayta kiritishga toʻgʻri keladi.
4. `Admin → Ishga tushirishga tayyorlik` ni oching. Pastdagi bosqichlar shu roʻyxatdagi qizil bandlarni yopadi.

---

## 2-bosqich. Doʻkon maʼlumotlari (admin ichida, 1–2 soat)

Hammasi **Admin → Sozlamalar → Doʻkon sozlamalari** va boshqa boʻlimlarda.

| Qilinadigan ish | Izoh |
|---|---|
| **Raqamlarni tasdiqlang yoki oʻzgartiring** | Hozir NAMUNA qiymatlar turibdi: bepul yetkazish 300 000 soʻmdan, Toshkentga 25 000, viloyatga 35 000, sovgʻa qutisi 15 000, qaytarish 14 kun, pul qaytishi 3–5 kun, kamida 6 oy yaroqlilik, Toshkentga 1 kun, viloyatga 2–4 kun. Haqiqiy shartlaringizni yozing: saytning hamma joyidagi matnlar shu yerdan oʻzgaradi. |
| **Aloqa** | Doʻkon telefoni, Telegram kanal havolasi, Telegram bot havolasi, ish vaqti. Boʻsh boʻlsa saytda koʻrinmaydi. |
| **Bonus dasturi** | Darajalar (Pushti 3%, Shaftoli 5%, Kakao 7%) va ball yonish muddati (oy) namuna. Haqiqiy shartlarni yozing. Ball yonish muddatini kiritsangiz, tizim oʻzi hisoblaydi va mijoz kabinetida sanani koʻrsatadi. |
| **Ommaviy oferta va Maxfiylik siyosati** | Admin → Huquqiy sahifalar. Matnni **yurist** yozadi. Maxfiylik siyosatiga analitika haqida jumla qoʻshtiring: «Sayt tashrif statistikasi uchun anonim identifikator (cookie) ishlatadi, ism va telefon bilan bogʻlanmaydi». |
| **Haqiqiy mahsulotlar** | Admin → Mahsulotlar. Namuna mahsulotlarni («Namuna maʼlumot» belgisi bor, 12 ta) oʻchiring, haqiqiylarini qoʻshing: nom, brend, toifa, 3+ rasm (asl surat, AI bilan oʻzgartirilmaydi), tavsif, tarkib, narx, qoldiq, **partiya raqami va yaroqlilik muddati**. |
| **Namuna promokod** | Admin → Promokodlar → SALOM10 (−10%) namuna. Qoldirasizmi yoki oʻzgartirasizmi — qaror sizniki. |
| **Banner va maqolalar** | Admin → Bannerlar, Jurnal maqolalari. Hozirgilari dizayndan olingan namuna matn. |
| **Ruscha matnlar** | Mahsulot/maqolani ochib yuqoridagi tilni «Русский» ga almashtiring va qisqacha tavsifni yozing. Yozmasangiz ruscha sahifada oʻzbekcha matn chiqadi. SEO audit shuni koʻrsatadi. |

---

## 3-bosqich. Akkauntlar ochish (erta boshlang — kutish kerak)

Hammasini ochgach, kalitlarni **Admin → Integratsiyalar** ga kiritasiz. Har bir karta ichida «Qanday ulayman?» yoʻriqnomasi, kerakli havolalar va nusxa olish tugmali manzillar bor.

| # | Xizmat | Nima kerak | Qancha kutiladi |
|---|---|---|---|
| 1 | **Telegram bot** (adminga buyurtma xabari) | @BotFather orqali bot yarating, token oling; oʻz ID’ingizni @userinfobot dan biling. Integratsiyalar → Telegram → «Tekshirish». | 5 daqiqa |
| 2 | **Eskiz** (SMS kodlar) | my.eskiz.uz da roʻyxatdan oʻting, hisobni toʻldiring, shablonni tasdiqlating: `Yeppo: kirish kodi XXXX`. Integratsiyalar → Eskiz → email/parol → «Tekshirish» → rejim «Haqiqiy SMS». | shablon tasdigʻi: 1–3 kun |
| 3 | **Click** | Click Merchant shartnomasi, servis yaratish. Kartadagi «Prepare/Complete» manzilini kabinetga yozing. Service ID, Merchant ID, Secret key ni kiriting. | shartnoma: bir necha kun |
| 4 | **Payme** | Payme Business shartnomasi, kassa. Endpoint URL va hisob maydoni `order_id` ni kabinetga yozing. Merchant ID va Key ni kiriting. Avval «Payme sinov kassasi» belgisini qoʻyib, Payme sinovlaridan oʻting. | shartnoma: bir necha kun |
| 5 | **Google Search Console** | search.google.com/search-console → «URL prefix» → «HTML tag» → `content=` ichidagi kodni kiriting → Search Console’da «Verify» → «Sitemaps» ga `…/sitemap.xml`. | domen ochilgach |
| 6 | **Yandex Vebmaster** | webmaster.yandex.ru → meta-teg kodi → «Проверить» → Sitemap. | domen ochilgach |
| 7 | **Google Analytics 4** (ixtiyoriy) | Measurement ID (`G-…`). | 10 daqiqa |
| 8 | **Yandex Metrika** (ixtiyoriy) | Hisoblagich raqami. «Vebvizor» belgisi mijoz sessiyasini yozadi — yoqishdan oldin maxfiylik siyosatiga yozing. | 10 daqiqa |
| 9 | **Meta Pixel** (Instagram reklamasi uchun) | Events Manager → Pixel ID. | 10 daqiqa |
| 10 | **Bing Webmaster** (ixtiyoriy) | meta-teg kodi. | 10 daqiqa |
| 11 | **IndexNow** | akkaunt kerak emas: Integratsiyalar → IndexNow → «Yoqilgan». Sayt ochiq boʻlgandan keyin. | 1 daqiqa |

Logotiplar: Google Analytics, Search Console, Meta va Telegram — rasmiy; qolganlari oddiy harfli belgi. Rasmiy logotipini qoʻymoqchi boʻlsangiz, `web/public/integrations/<nom>.svg` faylini oʻsha nomda almashtirib yuboring.

---

## 4-bosqich. Domen va saytni ochish

1. Domen sotib oling (masalan `yeppo.uz`; nom — Yeppo yoki Yeppy — oldin hal qiling).
2. DNS’da A yozuvini server IP’siga yoʻnaltiring.
3. Coolify → resurs → **Domains** ga domenni yozing (https sertifikat avtomatik).
4. Coolify → Environment Variables: `SITE_URL` ni `https://yeppo.uz` qiling (hozir Coolify manzilidan oladi).
5. **Saytni ochish:** Coolify → Environment Variables’dan `SITE_PASSWORD` va `SITE_NOINDEX` ni **oʻchiring** → Redeploy. Shundan keyin sayt parolsiz ochiladi, Google va Yandex indekslay oladi, Google/Yandex/Meta teglari va IndexNow ishga tushadi.
6. Search Console va Vebmaster’da **sitemap** manzilini yuboring: `https://yeppo.uz/sitemap.xml` (Admin → SEO audit sahifasida nusxa tugmasi bor).

> Sayt ochilishidan **oldin** 2 va 3-bosqich tayyor boʻlishi kerak: aks holda mijoz namuna mahsulot koʻradi va toʻlov ishlamaydi.

---

## 5-bosqich. Haqiqiy toʻlovga oʻtish va sinov

1. Click yoki Payme kalitlari kiritilgach: Integratsiyalar → **Toʻlov rejimi** → «Haqiqiy» → Saqlash. Kalitlar toʻliq boʻlmasa, tizim oʻzi yoqtirmaydi.
2. **Telefoningizdan** eng arzon mahsulotni sotib oling: sayt → savat → toʻlov → pul hisobingizga tushganini tekshiring → Telegramga xabar kelganini → buyurtma sahifasini. Keyin buyurtmani bekor qilib pulni qaytaring.
3. Admin → Analitika → Hozir: oʻsha buyurtma «TOʻLADI» boʻlib koʻrinadi.
4. Admin → Ishga tushirishga tayyorlik: hamma majburiy band yashil boʻlishi kerak. «?» belgilari (zaxira nusxa, haqiqiy buyurtma sinovi) sizning tasdigʻingiz.

---

## 6-bosqich. Zaxira nusxa (maʼlumot yoʻqolmasligi uchun)

Baza har kuni 03:00 da nusxalanadi, lekin tashqi joy sozlanmaguncha nusxa **shu serverda** turadi (server buzilsa, u ham yoʻqoladi).

1. Hetzner Storage Box (BX11) buyurtma qiling.
2. Coolify → Environment Variables: `OFFSITE_TYPE=sftp`, `OFFSITE_HOST`, `OFFSITE_USER`, `OFFSITE_PASS_OBSCURED` — aniq qadamlar `web/deploy/README.md` da.
3. Serverda bir marta: `docker exec <backup konteyner> restore-test.sh` — «tiklash sinovi» muvaffaqiyatli boʻlishi kerak.

---

## 7-bosqich. Marketing agentlari (Instagram uchun tayyor paket, tovar topish)

Alohida tizim (`yeppo_agents/`), serverga hali qoʻyilmagan. Kodi sinalgan (74 ta test). Ishga tushirish uchun sizdan:

1. **Alohida Telegram bot** (BotFather’da yangi) — Poizon boti bilan bir token ishlamaydi.
2. **Saytda agent uchun alohida admin foydalanuvchi** (Admin → Adminlar → yangi). Email/parolni `YEPPO_API_EMAIL`, `YEPPO_API_PASSWORD` ga yozasiz.
3. **Anthropic API kaliti** (`ANTHROPIC_API_KEY`) — matn yozish uchun, kuniga $2 limit bor.
4. **Raqamlar** (`config/yeppo.yaml`, `TODO(admin)` belgisi bor qatorlar): kargo $/kg (hozir $9), mahsulot ogʻirligi (0.25 kg), bojxona % (hozir 0 — buxgalterdan soʻrang), ustama (35%).
5. Avval `DRY_RUN=true` bilan ishga tushiring: saytga hech narsa yozilmaydi, taklif va paketlar Telegramda koʻrinadi. Hammasi yoqsa, `DRY_RUN=false`.

Batafsil: `docs/yeppo_agents.md`.

---

## Har hafta 10 daqiqa

1. **Admin → boshqaruv paneli**: «Eʼtibor kerak» blokidagi narsalar.
2. **Marketing → Tashlab ketilgan**: toʻlanmagan buyurtmalarga 1–2 soat ichida yozing («Xabar matni» tugmasi tayyor matnni nusxalaydi).
3. **Analitika → Qidiruv**: «Topilmadi» deb belgilanganlar — mijoz izlagan, sizda yoʻq narsa. Eng koʻpini buyurtma qiling.
4. **Analitika → Manbalar**: qaysi reklama/post xarid keltirdi, qaysi biri faqat tashrif.
5. **Analitika → Tezlik**: qizil boʻlsa, dasturchiga ayting.
6. **Marketing → Mijozlar → «Qaytmagan»**: 45 kundan beri xarid qilmaganlarga eslatma.
7. **SEO audit**: baho 85 dan past boʻlsa, roʻyxatdagi birinchi muammoni tuzating.

Reklama yoki post joylashda **Marketing → Havola yasagich** da havola yasab, oʻshani qoʻying: shunda qaysi reklama nechta xarid keltirgani aniq koʻrinadi.

---

## Saytda hozircha YOʻQ narsalar (ochiq aytamiz)

| Nima | Holat |
|---|---|
| Google Search Console / Yandex Vebmaster **maʼlumotlarini** admin ichiga olib kelish (qaysi soʻz bilan topishgani) | Qurilmagan. Buning uchun Google’dan xizmat akkaunti (JSON kalit) va Yandex OAuth token kerak. Kalitlar tayyor boʻlsa, ~1 kunlik ish. Hozircha ularning oʻz saytida koʻrasiz. |
| Mijoz sessiyasini video kabi koʻrish (record) | Oʻzimizda yoʻq. Heatmap: bosishlar va scroll bor. Sessiya yozuvi kerak boʻlsa — Yandex Metrika «Vebvizor» (Integratsiyalarda belgisi bor). |
| Avtomatik SMS/Telegram kampaniya yuborish | Qurilmagan. Mijoz guruhlari jadval (CSV) sifatida yuklanadi, xabarni oʻzingiz yuborasiz. Eskiz toʻplam SMS uchun alohida shablon tasdigʻini talab qiladi. |
| Tashlab ketilgan buyurtmaga avtomatik xabar | Qoʻlda (tayyor matn tugmasi bor). Avtomatik yuborish uchun mijozdan xabar olishga rozilik va Eskiz/Telegram shablon kerak. |
| Selfie orqali teri tahlili | Yuridik tekshiruvgacha oʻchiq (qasddan). |
| Haqiqiy sharhlar | Sharh faqat tasdiqlangan xariddan keyin, admin tasdiqlagach chiqadi. Soxta sharh yoʻq. |

---

## Qoidalar (buzilmaydi)

- Soxta sharh, soxta reyting, «faqat 2 ta qoldi» yozilmaydi. Eski narx faqat oxirgi 30 kundagi haqiqiy narx.
- Mahsulot rasmi AI bilan oʻzgartirilmaydi.
- Kalit va parollar chatga, gitga va logga tushmaydi — faqat Integratsiyalar sahifasi (shifrlangan) yoki Coolify.
- Pul bilan bogʻliq qarorlar (toʻlovni qaytarish, xarid) faqat sizda.
- Poizon boti va serverdagi boshqa loyihalarga ruxsatsiz tegilmaydi.
