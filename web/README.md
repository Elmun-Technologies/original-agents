# Yeppo — koreys kosmetikasi internet-doʻkoni (Oʻzbekiston)

Yeppo — Oʻzbekistondagi mijozlar uchun koreys kosmetikasi doʻkoni. Sahifalar **uz** va **ru** tillarda. Sayt serverda (Coolify / Hetzner) Docker Compose orqali ishlaydi.

- Egasi uchun qoʻllanma: [`../docs/EGASI_UCHUN.md`](../docs/EGASI_UCHUN.md)
- Dasturchi uchun hisobot (arxitektura, testlar, ochiq ishlar): [`../docs/HANDOFF_YEPPO.md`](../docs/HANDOFF_YEPPO.md)
- Serverga qoʻyish va zaxira nusxa: [`deploy/README.md`](deploy/README.md)

## Stack

Next.js 16 (App Router), React 19, Payload CMS 3 (Postgres), Docker Compose (web, db, backup).

## Admin panel (`/admin`)

Hammasi oʻzbekcha. Menyuning boshida:

| Sahifa | Nima uchun |
|---|---|
| Ishga tushirishga tayyorlik | Sayt ochilishidan oldin nima qilish kerakligi (haqiqiy holatdan hisoblanadi) |
| Integratsiyalar | Click, Payme, Eskiz SMS, Telegram, Google/Yandex/Meta/Bing kodlari, IndexNow — kalit kiritiladi, server qayta ishga tushirilmaydi |
| Analitika | Tashrifchilar, manbalar, xarid yoʻli, mahsulotlar, auditoriya, tezlik, hozir kim saytda |
| Heatmap | Sahifada qayerga bosishadi va qayergacha oʻqishadi |
| Marketing | Tashlab ketilgan buyurtmalar, mijoz guruhlari (+CSV), reklama havolasi yasagich, promokod natijasi |
| SEO audit | Qidiruv uchun nima yetishmaydi |

## Papka tuzilishi

```
src/app/(frontend)/[lang]/   ochiq sayt sahifalari
src/app/(payload)/           Payload admin va API
src/app/api/                 savat/buyurtma, toʻlov (Click/Payme), SMS kirish, analitika kollektori, admin API
src/collections/             maʼlumotlar modeli (+ labels.ts: admin matnlari)
src/lib/                     biznes mantiq (narx, buyurtma, toʻlov, bonus, analitika, SEO, integratsiyalar)
src/components/              sayt va admin komponentlari
src/migrations/              Postgres migratsiyalari (server ishga tushganda oʻzi bajaradi)
tests/int/                   vitest integratsiya testlari (haqiqiy Postgres)
tests/e2e/                   Playwright (ochiq sayt + admin)
```

## Mahalliy ishga tushirish

```bash
cd web
pnpm install
cp .env.example .env     # DATABASE_URI, PAYLOAD_SECRET (kamida 16 belgi), SITE_URL; test uchun SMS_MODE=mock
NODE_ENV=production pnpm payload migrate
NODE_ENV=production pnpm seed --demo      # namuna maʼlumot (faqat test!)
ADMIN_EMAIL=siz@misol.uz ADMIN_PASSWORD='uzun parol' pnpm admin:create
pnpm dev                                  # http://localhost:3000
```

## Testlar

```bash
pnpm -s tsc --noEmit
pnpm run lint
TEST_DATABASE_URI=postgres://yeppo:yeppo@localhost:5432/yeppo_test pnpm run test:int
pnpm run build && ADMIN_NOTIFY=off pnpm start -p 3100 &
E2E_BASE=http://localhost:3100 E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… pnpm run test:e2e
```

## Rejimlar va sozlamalar

Kalitlar (Click, Payme, Eskiz, Telegram, Google/Yandex/Meta) **admin panelda** (Integratsiyalar) saqlanadi; shifrlangan. Server oʻzgaruvchilari zaxira sifatida oʻqiladi (`.env.example`).

- **Yopiq test rejimi**: `SITE_PASSWORD` qoʻyilgan boʻlsa har sahifa parol soʻraydi (foydalanuvchi `yeppo`), `noindex` + `robots.txt` da `Disallow: /`, reklama teglari qoʻyilmaydi. Ochish: `SITE_PASSWORD` va `SITE_NOINDEX` ni olib tashlab qayta ishga tushirish.
- **Toʻlov**: «Sinov» rejimida pul yechilmaydi. «Haqiqiy» rejim Click/Payme kalitlarisiz saqlanmaydi.
- **SMS**: «Sinov» rejimida kod ekranda koʻrinadi (faqat test saytda!).
- Selfie/biometrik tekshiruv oʻchiq (yuridik tekshiruvgacha).
- Toʻlov holati: buyurtma 12 soat ichida toʻlanadi, undan keyin «muddat tugadi»; muvaffaqiyatsiz urinishdan keyin qayta toʻlash mumkin.

## Backup

Har kuni 03:00 (Toshkent) `pg_dump`, serverda saqlanadi; tashqi joyga koʻchirish `OFFSITE_*` bilan sozlanadi (`deploy/README.md`). Tiklash sinovi: `restore-test.sh`.
