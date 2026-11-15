# Yeppo marketing agentlari

Koreys kosmetikasi uchun avtomatik zanjir: **talab → manba (Q-Depot) → narx → Instagram paketi → Telegram**.
Kod: `yeppo_agents/`, sozlamalar: `config/yeppo.yaml`, matn qoidalari: `prompts/yeppo_caption.md`, testlar: `tests/yeppo/`.
Poizon tizimi (`app/`) o'zgartirilmagan. Faqat replika filtri (`app/scraping/blocklist.py`) o'qish uchun ishlatiladi.

## Har kuni nima bo'ladi (Toshkent vaqti)

| Vaqt | Agent | Natija |
|---|---|---|
| Du va Pa, 06:00 | **Talab + Manba** | Q-Depot'dan mos tovarlar topiladi va narxlanadi. Botga **xarid takliflari** keladi: rasm, manba narxi ($), sotuv narxi, taxminiy foyda, *nega* taklif qilingani. Tugmalar: **✅ Katalogga qoʻshish** yoki **❌ Kerak emas**. |
| Har kuni, 10:00 | **Kontent** | Omborda bor tovarlardan 3 tasi tanlanadi. Har biri uchun bitta paket keladi: kartochkalar 1080×1350, story 1080×1920, **Reels MP4** (9:16, ~13 s), o'zbekcha va ruscha matn, hashtaglar, UTM havola. Paketni Instagram'ga o'zingiz joylaysiz. |

Bot buyruqlari (faqat admin): `/posts`, `/source`, `/candidates`, `/trend <matn>`, `/status`, `/help`.

## Talab qayerdan olinadi (uydirma statistika yo'q)
- **Mavsum va bayramlar.** Qishda krem va essensiya, yozda SPF. 31-dekabr va 8-mart oldidan to'plamlar. Hammasi `config/yeppo.yaml` → `demand` da.
- **Saytdagi qidiruvlar.** Ayniqsa "topilmadi" bo'lganlari. Mijoz so'zlari (o'zbekcha va ruscha) inglizcha mahsulot so'zlariga o'giriladi, masalan "husnbuzar" → acne, cica, tea tree (`query_words`).
- **Oxirgi 30 kundagi to'langan buyurtmalar.** Toifa va brend bo'yicha. Mijoz ma'lumoti o'qilmaydi.
- **Sizning `/trend` yozuvlaringiz** (14 kun hisobga olinadi).

## Manbalar (2026-11-15 tekshiruvi)

| Sayt | Holat |
|---|---|
| **Q-Depot** (q-depot.com) | ✅ Ishlatiladi. robots.txt mahsulot va kategoriya sahifalariga ruxsat beradi. Narx, brend, model kodi, bor/yo'qligi va 1000px rasm sahifadagi tuzilgan ma'lumotdan (JSON-LD) olinadi. |
| Olive Young Global | ⛔ Bot uchun "Access restricted" |
| Coupang | ⛔ Cloudflare blok |
| Gmarket | ⛔ Mahsulot sahifalari 403 |

Saytlarga hurmat qoidalari:
- robots.txt har ishga tushishda qayta o'qiladi va `*` belgili qoidalar ham hisobga olinadi;
- so'rovlar orasida 5–10 soniya pauza;
- bir oqim, 12 soatlik kesh, kuniga ko'pi bilan 300 sahifa;
- rost User-Agent ishlatiladi.

403, 429 yoki captcha chiqsa agent **darhol to'xtaydi** va botda xabar beradi. Proxy, soxta brauzer yoki login ishlatilmaydi.

Q-Depot'ning ulgurji narxlari login ortida. Agent faqat **chakana** narxni ko'radi, shuning uchun taklifdagi foyda konservativ hisoblangan.

## Narx formulasi (sof kod)

```
tannarx_usd = narx + og'irlik_kg × kargo_$/kg + bojxona% × (narx + kargo)
sotuv_soʻm  = yuqoriga_yaxlitlash_1000( tannarx_usd × (1 + ustama) × CBU_kursi × (1 + 1.5%) )
```

`config/yeppo.yaml → pricing` dagi **TODO(admin)** raqamlarini haqiqiylariga almashtiring:
- kargo $/kg (hozir $9);
- og'irliklar;
- bojxona % (hozir 0, buxgalterdan so'rang);
- ustama (hozir 35%).

## "Katalogga qoʻshish" bosilganda
Tovar saytga **qoldiq 0** bilan qo'shiladi: nomi, brendi, toifasi, rasmi, narxi va `QD-<model>` SKU. Saytda u "tugagan" bo'lib ko'rinadi.

Tovar Toshkentga kelgach, admin panelda quyidagilarni kiriting:
- qoldiq;
- "nima uchun" qatori va qisqa tavsif;
- teri turlari va muammolar;
- partiya raqami va yaroqlilik muddati.

Kontent agenti faqat **qoldig'i bor** tovarlarga post yasaydi. Yo'q tovarni reklama qilmaydi.

`DRY_RUN=true` bo'lsa, tugma saytga hech narsa yozmaydi.

## Kontent qoidalari
- AI faqat tavsif matnini yozadi va faqat katalogdagi faktlardan foydalanadi.
- Narx, yetkazish muddati, qaytarish sharti, originallik iborasi, chaqiriq va hashtaglarni **kod** qo'shadi. Ular sayt sozlamalaridan (Store) olinadi.
- AI matni filtrdan o'tkaziladi. Quyidagilar bo'lsa matn rad etiladi va katalogdagi tavsif ishlatiladi:
  - "rasmiy diler" da'vosi;
  - soxta kamyoblik ("faqat 2 ta qoldi");
  - tibbiy da'vo ("davolaydi");
  - narx, havola yoki hashtag.
- Tovar rasmi faqat kichraytiriladi yoki qirqiladi, AI bilan o'zgartirilmaydi.
- Sayt ma'lumotida "namuna" deb belgilangan tovar paketida ⚠️ ogohlantirish chiqadi.
- AI'ga kunlik byudjet: $2 (`llm.daily_budget_usd`).

## Ishga tushirish

**Mahalliy:**
```
uv run pytest tests/yeppo -q
uv run python -m yeppo_agents.bot
```
Sozlamalar root `.env` dan o'qiladi.

**Server (Coolify):** `docker-compose.yeppo-agents.yml`. U alohida tarmoq va volume bilan ishlaydi, port ochilmaydi. Image'da ffmpeg bor. O'zgaruvchilar ro'yxati `.env.yeppo-agents.example` da.

Kerakli narsalar:
1. Saytda agent uchun alohida **admin foydalanuvchi**: `YEPPO_API_EMAIL` va `YEPPO_API_PASSWORD`.
2. Bot tokeni. Bitta tokenni bir vaqtda faqat **bitta** jarayon o'qiy oladi, shuning uchun @Originalpobot ishlatilsa Poizon boti pauzada qolishi kerak. Ikkalasi birga ishlashi kerak bo'lsa, BotFather'da alohida bot oching.
