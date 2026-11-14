# Poizon → O'zbekiston: savdo agentlari

Loyiha qoidalari va arxitektura: [claude.md](claude.md).

## Ishga tushirish

```bash
uv sync
cp .env.example .env              # to'ldiring; DRY_RUN=true — hech narsa kanalga chiqmaydi
uv run --env-file .env alembic upgrade head
uv run --env-file .env python -m app.bot.admin_bot   # bot + jadval (APScheduler)
uv run pytest
```

## Kundalik ish (admin)

- **Yangi tovar / narxni yangilash:** Poizon ilovasidan mahsulot sahifasining 1–3 ta skrinshotini botga
  izohsiz yuboring → bot o'qib ko'rsatadi → ✅ To'g'ri / ✏️ Tuzatish.
- **Tovar surati:** SKU izohi bilan (fayl sifatida) yuboring.
- **Avtomatik:** 09:00 draft + tekshiruv, 12:00/19:00/21:00 kanalga nashr, 21:30 kunlik xulosa,
  dushanba 09:00 haftalik hisobot + Excel. `/pause` — to'xtatish.
- **Qo'lda:** to'lovni tasdiqlash (buyurtma tugmalari), xarid (ilovada narxni tekshirib, keyin
  `/buyprice <id> <yuan>`), muammo: `/problem <id> <oʻlcham|kechikish|nuqson|boshqa> [izoh]`.
- Hamma buyruqlar: botda `/help`.

Zaxira manba: CSV / Google Sheet (`python -m app.agents.sourcing <fayl|url>`, namuna
`data/samples/manual_sheet_sample.csv`, yoki `settings.yaml: sheet_url` — har kuni 05:00).
