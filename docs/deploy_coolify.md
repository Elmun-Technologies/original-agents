# Serverga koʻchirish: Hetzner + Coolify

Natija: bot va jadval serverda 24/7 ishlaydi, Postgres alohida, har kecha 03:00 da baza nusxasi
(7 kun saqlanadi), bot qulasa Telegram'da xabar keladi. Mac'dagi bot oʻchadi.

Vaqt: ~1 soat. Kerak: Hetzner akkaunt, GitHub akkaunt (`elmuntech`), Mac'da shu loyiha.

---

## 1. Hetzner'da server ochish

1. https://console.hetzner.cloud → loyiha → **Add Server**.
2. **Location:** Helsinki yoki Falkenstein. **Image:** Ubuntu 24.04.
3. **Type:** CX22 (2 vCPU, 4 GB RAM) — yetarli.
4. **SSH key:** Mac'dagi kalitni qoʻshing (`cat ~/.ssh/id_ed25519.pub`, yoʻq boʻlsa `ssh-keygen -t ed25519`).
5. **Backups** belgisini yoqing (+20% narx) — butun server nusxasi, bizning kechki baza nusxasiga qoʻshimcha.
6. **Create.** Server IP manzilini yozib oling (masalan `65.21.x.x`).
7. **Firewall** (Firewalls → Create): kirish uchun faqat 22 (SSH), 80, 443, 8000 (Coolify paneli) portlari.

## 2. Coolify oʻrnatish

```bash
ssh root@SERVER_IP
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Tugagach brauzerda `http://SERVER_IP:8000` → admin akkaunt yarating (kuchli parol).

**Telegram ogohlantirishlari (Coolify'ning oʻzidan, qoʻshimcha himoya):**
Settings → **Notifications → Telegram**: Bot token = bizning bot tokeni, Chat ID = sizning Telegram ID
(`TELEGRAM_ADMIN_IDS` dagi raqam) → **Container Status Changes** ni yoqing → Save → Send test.

## 3. Kodni GitHub'ga (yopiq repo)

Mac'da (bir marta):

```bash
cd "/Users/elmurodovnazir/orignal "
gh repo create poizon-uz --private --source . --push
```

`.env` va `data/` gitga tushmaydi (`.gitignore`). Keyingi oʻzgarishlar: `git push`.

Coolify'da: **Sources → + Add → GitHub App** → koʻrsatmalar boʻyicha GitHub App yarating va
faqat `poizon-uz` repozitoriyasiga ruxsat bering.

## 4. Coolify'da ilova yaratish

1. **Projects → + Add** → nom: `poizon` → **production** muhiti.
2. **+ New Resource → Private Repository (with GitHub App)** → `poizon-uz`, branch `main`.
3. **Build Pack: Docker Compose**, Docker Compose Location: `/docker-compose.yml` → **Continue**.
4. Domen kerak emas (bot Telegram'dan oʻzi soʻraydi, tashqaridan ulanish yoʻq).
5. **Environment Variables** → **Developer view** (matn rejimi) → quyidagini qoʻying va qiymatlarni
   Mac'dagi `.env` dan koʻchiring:

```
POSTGRES_PASSWORD=<yangi uzun parol: Mac'da `openssl rand -hex 24`>
ANTHROPIC_API_KEY=<.env dan>
LLM_MODEL=claude-opus-5-5
TELEGRAM_BOT_TOKEN=<.env dan>
TELEGRAM_ADMIN_IDS=<.env dan>
TELEGRAM_CHANNEL_ID=<.env dan>
DRY_RUN=false
BOT_HOLD=true
SCRAPER_CONTACT_EMAIL=
CHATPLACE_API_TOKEN=
```

   `BOT_HOLD=true` — birinchi ishga tushishda bot yoqilmaydi, faqat baza tayyorlanadi (maʼlumot
   koʻchirish uchun). `EXIT_ON_CONFLICT` ni serverga **qoʻymang** (u faqat Mac uchun).
   `DATABASE_URL` kerak emas — `docker-compose.yml` uni parol bilan oʻzi yasaydi.
6. **Save → Deploy.** Logda (`bot` servisi) shu qator chiqishi kerak:
   `BOT_HOLD=true: baza tayyor, bot ishga tushirilmadi`.

## 5. Maʼlumotlarni Mac'dan koʻchirish

**Mac'da:**

```bash
cd "/Users/elmurodovnazir/orignal "
sh scripts/export_for_server.sh
```

Skript Mac'dagi botni **toʻxtatadi** (ikkita bot bir vaqtda ishlamasin) va
`data/export-YYYYmmdd-HHMM.tgz` yaratadi (baza + suratlar + postlar + skrinshotlar).
Shu paytdan server ishga tushguncha botga hech narsa yubormang.

```bash
scp data/export-*.tgz root@SERVER_IP:/root/
```

**Serverda** (`ssh root@SERVER_IP`):

```bash
BOT=$(docker ps --format '{{.Names}}' | grep -E '^bot-' | head -1); echo $BOT
docker cp /root/export-*.tgz $BOT:/app/data/
docker exec $BOT sh -c 'python -m app.migrate_sqlite /app/data/export-*.tgz'
```

Natijada jadvallar boʻyicha "Koʻchirildi: products: N, posts: N …" chiqadi. Server bazasi boʻsh
boʻlmasa skript hech narsa yozmaydi (ikki marta koʻchirib boʻlmaydi).

## 6. Botni yoqish

Coolify → ilova → Environment Variables → `BOT_HOLD=false` → **Save → Restart** (yoki Redeploy).

Tekshirish:
- Logda `scheduler: … drafts … summary … weekly …` va `Start polling`.
- Telegram'da botga `/today` va `/summary` — Mac'dagi maʼlumotlar koʻrinishi kerak.
- Coolify'da `bot` servisi **healthy** (har daqiqada heartbeat).

Mac'dagi bot 5-qadamda toʻxtatilgan. Uni tasodifan qayta yoqsangiz ham, Mac'dagi `.env` da
`EXIT_ON_CONFLICT=true` bor: server ishlayotganini koʻrib, oʻzi toʻxtaydi.

---

## Kundalik ishlatish

**Yangilash (kod oʻzgarsa):** Mac'da `git push` → Coolify → **Redeploy** (yoki ilova sozlamasida
*Auto Deploy* yoqilgan boʻlsa — oʻzi). Baza migratsiyalari ishga tushishda avtomatik bajariladi.

**Bot qulasa:** Docker uni oʻzi qayta yoqadi (`restart: unless-stopped`). Sizga Telegram'da xabar
keladi: "🛑 Bot qulab tushdi …" yoki "♻️ Bot qayta ishga tushdi …" (30 daqiqada koʻpi bilan bitta).
Rejadagi ish (draft, nashr, hisobot) xato bersa — "⚠️ Rejadagi ish … xato bilan tugadi".
Coolify'ning oʻz ogohlantirishi (2-qadam) konteyner toʻxtaganini ham xabar qiladi.

**Baza nusxalari:** `backup` servisi har kecha 03:00 (Toshkent) `db-YYYY-MM-DD.dump` yaratadi,
7 kundan eskisini oʻchiradi. Muvaffaqiyatsiz boʻlsa — Telegram'da ogohlantirish.

Nusxalarni koʻrish va Mac'ga olish:
```bash
B=$(docker ps --format '{{.Names}}' | grep -E '^backup-' | head -1)
docker exec $B ls -la /backups
docker cp $B:/backups /root/backups && exit
scp -r root@SERVER_IP:/root/backups ./   # Mac'da
```

Nusxadan tiklash (ehtiyot boʻling — joriy baza almashtiriladi; avval botni Coolify'da Stop qiling):
```bash
DB=$(docker ps --format '{{.Names}}' | grep -E '^db-' | head -1)
docker cp $B:/backups/db-2026-11-20.dump /tmp/restore.dump
docker cp /tmp/restore.dump $DB:/tmp/restore.dump
docker exec $DB pg_restore -U poizon -d poizon --clean --if-exists /tmp/restore.dump
```

**Postgres testlari (Mac'da):**
```bash
docker run -d --name pgtest -e POSTGRES_PASSWORD=pw -p 5433:5432 postgres:16-alpine
TEST_POSTGRES_URL=postgresql+psycopg://postgres:pw@localhost:5433/postgres uv run pytest -m postgres
docker rm -f pgtest
```
Oddiy `uv run pytest` — SQLite'da hammasi, Postgres testlari `TEST_POSTGRES_URL` boʻlmasa oʻtkazib yuboriladi.

## Muammolar

| Belgi | Sabab va yechim |
|---|---|
| Logda `TelegramConflictError` | Shu token bilan boshqa bot ishlayapti (Mac?). Mac'da: `pkill -f app.bot.admin_bot`. |
| `bot` servisi *unhealthy* | Jadval ishlamayapti: Coolify → Logs. Qayta ishga tushirish: Restart. |
| `BOT_HOLD=true` yozuvi turibdi | 6-qadam: `BOT_HOLD=false` va Restart. |
| "Sxema versiyasi farq qiladi" | Mac'da `uv run --env-file .env alembic upgrade head`, keyin eksportni qayta qiling. |
| "Server bazasi boʻsh emas" | Koʻchirish allaqachon qilingan. Qayta kerak boʻlsa — Coolify'da `pg_data` volume'ni oʻchirib, 4-qadamdan. |
