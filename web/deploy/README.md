# Yeppo sayti — serverga qo'yish (Coolify)

> **Kalitlar endi admin panelda.** Click, Payme, Eskiz (SMS), Telegram bot, Google/Yandex/Meta kodlari: `/admin` → **Integratsiyalar**. Server o'zgaruvchilari (`CLICK_*`, `PAYME_*`, `ESKIZ_*`, `TELEGRAM_*`) faqat zaxira sifatida o'qiladi — admin paneldagi qiymat ustun turadi. Server o'zgaruvchilarida qoladigan narsalar: ma'lumotlar bazasi, `SERVICE_BASE64_64_PAYLOAD` (**o'zgartirmang**: panelda saqlangan kalitlar shu bilan shifrlangan), `SITE_URL`, `SITE_PASSWORD`/`SITE_NOINDEX` (sayt yopiq/ochiq), zaxira nusxa `OFFSITE_*`.
> Birinchi admin: `/admin` ni oching — foydalanuvchi yo'q bo'lsa, yaratish oynasi chiqadi.
> Yangilanishdan keyin Redeploy qiling: migratsiyalar o'zi bajariladi.

Fayllar:
- `web/docker-compose.yml` — xizmatlar: `web` (sayt), `db` (Postgres), `backup` (kunlik nusxa).
- `web/Dockerfile` — sayt image'i.
- `web/deploy/backup/` — zaxira nusxa skriptlari.

## Coolify resurs
- Turi: **Docker Compose**, repo `Elmun-Technologies/original-agents`, branch `master`, Base Directory `/web`.
- Domen: Coolify `SERVICE_FQDN_WEB` ni o'zi beradi (vaqtinchalik `*.sslip.io`). Haqiqiy domen ulanganda shu qiymat almashtiriladi va qayta ishga tushiriladi. Sayt manzili bitta sozlamada turadi: `SITE_URL`.
- Sirlarni Coolify o'zi generatsiya qiladi va ular faqat Environment Variables oynasida ko'rinadi:
  - `SERVICE_PASSWORD_POSTGRES`
  - `SERVICE_BASE64_64_PAYLOAD`
  - `SERVICE_PASSWORD_SITE` — test sayt paroli, foydalanuvchi nomi `yeppo`.
- Xotira chegaralari: web 768 MB, db 384 MB, backup 128 MB.
- Tashqariga port ochilmaydi. Saytga faqat Coolify proxy orqali kiriladi.

## Yopiq test rejimi
`SITE_PASSWORD` qo'yilgan bo'lsa:
- har sahifa parol so'raydi;
- har javobda `X-Robots-Tag: noindex` sarlavhasi bo'ladi;
- sahifalarda `meta robots noindex` bo'ladi;
- `robots.txt` da `Disallow: /` turadi.

Saytni ochish uchun `SITE_PASSWORD` va `SITE_NOINDEX` ni olib tashlab, qayta ishga tushirish kifoya.

To'lovlar `PAYMENTS_MODE=mock` rejimida: haqiqiy pul qabul qilinmaydi.

## Ma'lumotlar bazasi
- Migratsiyalar (`src/migrations`) sayt ishga tushganda o'zi bajariladi.
- Sxema o'zgarsa, lokalda `pnpm payload migrate:create <nom>` ishga tushiriladi va hosil bo'lgan fayl commit qilinadi.

## Zaxira nusxa (backup)
Har kuni 03:00 da (Toshkent vaqti):
- bazadan `pg_dump` olinadi; nusxa serverda 3 kun saqlanadi;
- nusxa **serverdan tashqariga** (`offsite:`) ko'chiriladi va u yerda 14 kun saqlanadi;
- rasmlar papkasi ham tashqariga sinxronlanadi.

Tashqi joy sozlanmagan bo'lsa, bot har kuni ogohlantiradi.

### Hetzner Storage Box ulash
1. Hetzner Robot → Storage Box → buyurtma (BX11, 1 TB). Sozlamalarda **SSH support** ni yoqing.
2. Coolify → resurs → Environment Variables:

   | O'zgaruvchi | Qiymat |
   |---|---|
   | `OFFSITE_TYPE` | `sftp` |
   | `OFFSITE_HOST` | `uXXXXXX.your-storagebox.de` |
   | `OFFSITE_PORT` | `23` |
   | `OFFSITE_USER` | `uXXXXXX` |
   | `OFFSITE_PASS_OBSCURED` | parolning rclone ko'rinishi (pastda) |

   Parolning rclone ko'rinishini olish:
   ```
   docker run --rm rclone/rclone obscure 'PAROL'
   ```
3. Qayta ishga tushiring.

### Hetzner Object Storage (S3) ulash
| O'zgaruvchi | Qiymat |
|---|---|
| `OFFSITE_TYPE` | `s3` |
| `OFFSITE_PROVIDER` | `Other` |
| `OFFSITE_ENDPOINT` | `https://hel1.your-objectstorage.com` |
| `OFFSITE_ACCESS_KEY_ID` | kalit |
| `OFFSITE_SECRET_ACCESS_KEY` | maxfiy kalit |

`OFFSITE_PATH=<bucket>/yeppo` qilib qo'yiladi.

### Buyruqlar (serverda, backup konteyneri ichida)
- Hozir nusxa olish:
  ```
  docker exec <backup> sh -c 'BACKUP_NOW=1 backup.sh'
  ```
- Tiklashni sinash:
  ```
  docker exec <backup> restore-test.sh
  ```
  Eng yangi nusxa vaqtinchalik bazaga tiklanadi, qatorlar sanaladi, keyin baza o'chiriladi. Ishlayotgan bazaga tegilmaydi.
