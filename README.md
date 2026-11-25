# Original Agents — monorepo

Bu repoda uchta qism bor:

| Papka | Nima | Stack | Holat |
|---|---|---|---|
| `web/` | **Yeppo** — O'zbekiston uchun koreys kosmetikasi internet-do'koni (uz/ru) | Next.js 16 + Payload CMS 3 + Postgres, Docker Compose | Serverda ishlayapti (yopiq test rejimi) |
| `yeppo_agents/`, `config/yeppo.yaml` | **Yeppo marketing agentlari** — talab, Q-Depot manba, narx, Instagram paketi, Telegram bot | Python 3.12 + uv | Serverga hali qo'yilmagan |
| `app/`, `config/settings.yaml`, root `docker-compose.yml` | **Poizon** — krossovka savdo agent-boti (eski loyiha) | Python + Postgres + Alembic | Serverda **pauzada**. Egasining ruxsatisiz **tegilmaydi** |

## Qayerdan boshlash

| Kimga | Hujjat |
|---|---|
| Egasi: ulash va sozlash kerak bo'lgan hamma narsa, ketma-ketlikda | [docs/EGASI_UCHUN.md](docs/EGASI_UCHUN.md) |
| Dasturchi: holat, ishga tushirish, testlar, ochiq ishlar | [docs/HANDOFF_YEPPO.md](docs/HANDOFF_YEPPO.md) |
| Sayt: lokal ishga tushirish, rejimlar, deploy | [web/README.md](web/README.md), [web/deploy/README.md](web/deploy/README.md) |
| Marketing agentlari | [docs/yeppo_agents.md](docs/yeppo_agents.md) |
| Poizon boti (eski loyiha) | [claude.md](claude.md), [docs/deploy_coolify.md](docs/deploy_coolify.md) |

## Qoidalar (buzilmaydi)

- Soxta sharh, reyting yoki "faqat 2 ta qoldi" yozilmaydi. Eski narx faqat oxirgi 30 kundagi haqiqiy narx bo'lishi mumkin.
- Mahsulot rasmlari AI bilan o'zgartirilmaydi.
- Sirlar (token, parol, kalit) chatga, logga yoki git'ga chiqmaydi — faqat `.env` / Coolify Environment Variables.
- Pul bilan bog'liq qarorlar (to'lovni tasdiqlash, qaytarish, xarid) faqat admin qo'lida.
- Yeppo'dan tashqaridagi narsalar (Poizon, serverdagi boshqa loyihalar) egasidan so'ramasdan o'zgarmaydi.

## Tez tekshiruv

```bash
# sayt
cd web && pnpm install && pnpm -s tsc --noEmit && pnpm run lint && pnpm run test:int

# marketing agentlari
uv run pytest tests/yeppo -q
```
