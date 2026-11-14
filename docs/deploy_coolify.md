# Serverga koʻchirish: mavjud Hetzner + Coolify serveri

Natija: bot va jadval `ubuntu-8gb-hel1-1` (Helsinki) serverida 24/7 ishlaydi, Postgres alohida,
har kecha 03:00 da baza nusxasi (7 kun), bot qulasa Telegram'da xabar. Mac'dagi bot oʻchadi.

**Boshqa loyihalarga (sofkino, sofexpo …) xalaqit bermaydi:**
- Hech qanday port tashqariga ochilmaydi (bot faqat Telegram/Anthropic'ga oʻzi chiqadi).
- Postgres faqat ichki `original-agents-internal` tarmogʻida (internetsiz, portsiz).
- Oʻz tarmoq va volume nomlari: `original-agents-*`.
- Xotira cheklovi: bot 512 MB, db 512 MB, backup 256 MB.

Kod: `Elmun-Technologies/original-agents` (private, branch `master`). `.env` va `data/` gitda yoʻq.

---

## 1. Coolify'da yangi resurs

1. Coolify paneli → **Projects → + Add** → nom: `original-agents` → **production** muhiti.
2. **+ New Resource → Private Repository (with GitHub App)** → Elmun-Technologies ulangan
   GitHub App'ni tanlang → `original-agents`, branch `master`.
   - Roʻyxatda `original-agents` koʻrinmasa: GitHub → Elmun-Technologies → Settings →
     GitHub Apps → (Coolify App) → Configure → Repository access → `original-agents` ni qoʻshing.
3. **Build Pack: Docker Compose**, Docker Compose Location: `/docker-compose.yml` → **Continue**.
4. Domen **qoʻymang** (servislar uchun "Domains" maydonlari boʻsh qoladi) — tashqaridan ulanish yoʻq.
5. Hali **Deploy bosmang** — avval 2-qadam.

## 2. Oʻzgaruvchilar (.env oʻrniga)

Resurs → **Environment Variables**. Coolify `docker-compose.yml` dagi `${...}` larni oʻzi topib,
roʻyxatda koʻrsatadi — qiymatlarini toʻldirasiz. Eng oson yoʻl: **Developer view** (matn rejimi)
→ quyidagini qoʻying, qiymatlarni Mac'dagi `.env` dan koʻchiring → **Save**:

```
POSTGRES_PASSWORD=<yangi uzun parol: Mac'da `openssl rand -hex 24`>
ANTHROPIC_API_KEY=<.env dan>
LLM_MODEL=<.env dan>
TELEGRAM_BOT_TOKEN=<.env dan>
TELEGRAM_ADMIN_IDS=<.env dan>
TELEGRAM_CHANNEL_ID=<.env dan>
DRY_RUN=false
BOT_HOLD=true
SCRAPER_CONTACT_EMAIL=
CHATPLACE_API_TOKEN=
```

- `BOT_HOLD=true` — birinchi ishga tushishda bot yoqilmaydi, faqat baza tayyorlanadi.
- `DATABASE_URL`, `INSTANCE`, `EXIT_ON_CONFLICT` ni **qoʻymang** (compose oʻzi yasaydi / faqat Mac uchun).
- "Build Variable" belgisini yoqmang (sirlar image ichiga yozilmasin).
- `POSTGRES_PASSWORD` ni birinchi Deploy'dan keyin **oʻzgartirmang** — baza eski parol bilan yaratilgan.

## 3. Birinchi Deploy

**Deploy** → logda (`bot` servisi) shu qator chiqishi kerak:
`BOT_HOLD=true: baza tayyor, bot ishga tushirilmadi`.

Resurs ID (UUID) ni yozib oling — u brauzer manzilida `.../application/<UUID>` yoki
konteyner nomlarida (`bot-<UUID>-…`). Serverdagi buyruqlarda shu ishlatiladi:

```bash
ssh root@SERVER_IP
UUID=<resurs ID>
docker ps --format '{{.Names}}  {{.Status}}' | grep "$UUID"     # bot, db, backup koʻrinadi
```

## 4. Maʼlumotlarni Mac'dan koʻchirish

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

**Serverda** (`ssh root@SERVER_IP`, `UUID` — 3-qadamdagi):

```bash
BOT=$(docker ps --format '{{.Names}}' | grep "^bot-$UUID" | head -1); echo $BOT
docker cp /root/export-*.tgz $BOT:/app/data/
docker exec $BOT sh -c 'python -m app.migrate_sqlite /app/data/export-*.tgz'
```

Natijada jadvallar boʻyicha "Koʻchirildi: products: N, posts: N …" chiqadi. Server bazasi boʻsh
boʻlmasa skript hech narsa yozmaydi (ikki marta koʻchirib boʻlmaydi).

## 5. Botni yoqish

Coolify → ilova → Environment Variables → `BOT_HOLD=false` → **Save → Restart** (yoki Redeploy).

Tekshirish:
- Logda `scheduler: … drafts … summary … weekly …` va `Start polling`.
- Telegram'da botga `/today` va `/summary` — Mac'dagi maʼlumotlar koʻrinishi kerak.
- Coolify'da `bot` servisi **healthy** (har daqiqada heartbeat).

Mac'dagi bot 4-qadamda toʻxtatilgan. Uni tasodifan qayta yoqsangiz ham, Mac'dagi `.env` da
`EXIT_ON_CONFLICT=true` bor: server ishlayotganini koʻrib, oʻzi toʻxtaydi.

---

## Kundalik ishlatish

**Yangilash (kod oʻzgarsa):** Mac'da `git push` → Coolify → **Redeploy** (yoki ilova sozlamasida
*Auto Deploy* yoqilgan boʻlsa — oʻzi). Baza migratsiyalari ishga tushishda avtomatik bajariladi.

**Bot qulasa:** Docker uni oʻzi qayta yoqadi (`restart: unless-stopped`). Sizga Telegram'da xabar
keladi: "🛑 Bot qulab tushdi …" yoki "♻️ Bot qayta ishga tushdi …" (30 daqiqada koʻpi bilan bitta).
Rejadagi ish (draft, nashr, hisobot) xato bersa — "⚠️ Rejadagi ish … xato bilan tugadi".
Qoʻshimcha: Coolify → Settings → Notifications → Telegram yoqilgan boʻlsa, konteyner toʻxtaganini u ham xabar qiladi.

**Baza nusxalari:** `backup` servisi har kecha 03:00 (Toshkent) `db-YYYY-MM-DD.dump` yaratadi,
7 kundan eskisini oʻchiradi. Muvaffaqiyatsiz boʻlsa — Telegram'da ogohlantirish.

Nusxalarni koʻrish va Mac'ga olish:
```bash
B=$(docker ps --format '{{.Names}}' | grep "^backup-$UUID" | head -1)
docker exec $B ls -la /backups
docker cp $B:/backups /root/backups && exit
scp -r root@SERVER_IP:/root/backups ./   # Mac'da
```

Nusxadan tiklash (ehtiyot boʻling — joriy baza almashtiriladi; avval botni Coolify'da Stop qiling):
```bash
DB=$(docker ps --format '{{.Names}}' | grep "^db-$UUID" | head -1)
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
| `BOT_HOLD=true` yozuvi turibdi | 5-qadam: `BOT_HOLD=false` va Restart. |
| "Sxema versiyasi farq qiladi" | Mac'da `uv run --env-file .env alembic upgrade head`, keyin eksportni qayta qiling. |
| "Server bazasi boʻsh emas" | Koʻchirish allaqachon qilingan. Qayta kerak boʻlsa — Coolify'da resursni Stop, `…original-agents-pg-data` volume'ni oʻchirib, 3-qadamdan. |
| Build "out of memory" / server sekin | Boshqa loyihalar bilan bir server: `free -h`, `docker stats`. Cheklovlar `docker-compose.yml` dagi `mem_limit`. |
