"""Handler-level tests: real aiogram Dispatcher + router, Telegram replaced by a fake session."""
import asyncio
from datetime import datetime, timezone

import pytest
from PIL import Image
from aiogram import Bot, Dispatcher
from aiogram.client.session.base import BaseSession
from aiogram.methods import EditMessageReplyMarkup, EditMessageText, SendMediaGroup, SendMessage
from aiogram.types import CallbackQuery, Chat, Message, Update, User
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.agents.content import create_draft
from app.bot import admin_bot
from app.db.models import Order, TrendNote
from tests.helpers import FX, NOW, FakeLlm, make_product

ADMIN, STRANGER = 111, 999


class FakeSession(BaseSession):
    def __init__(self):
        super().__init__()
        self.sent = []

    async def make_request(self, bot, method, timeout=None):
        self.sent.append(method)
        if isinstance(method, (SendMessage, EditMessageText)):
            return Message(message_id=len(self.sent), date=datetime.now(timezone.utc),
                           chat=Chat(id=getattr(method, "chat_id", ADMIN) or ADMIN, type="private"),
                           text=method.text)
        if isinstance(method, SendMediaGroup):
            return []
        return True

    async def stream_content(self, *a, **kw):
        yield b""

    async def close(self):
        pass

    def texts(self):
        return [m.text for m in self.sent if isinstance(m, (SendMessage, EditMessageText))]


@pytest.fixture
def env(db, monkeypatch):
    monkeypatch.setattr(admin_bot, "now", lambda: NOW)
    monkeypatch.setattr(admin_bot, "fx_now", lambda at: (FX, []))
    ctx = admin_bot.Ctx(factory=sessionmaker(bind=db.get_bind()), admin_ids={ADMIN}, channel_id=None)
    session = FakeSession()
    bot = Bot("42:TEST", session=session)
    tg = admin_bot.Tg(bot, ctx)
    dp = Dispatcher()
    dp.include_router(admin_bot.create_router(ctx, tg))
    return dp, bot, session, ctx


def msg(text, user=ADMIN):
    return Message(message_id=1, date=datetime.now(timezone.utc), chat=Chat(id=user, type="private"),
                   from_user=User(id=user, is_bot=False, first_name="A"), text=text)


def send(env, text, user=ADMIN):
    dp, bot, *_ = env
    asyncio.run(dp.feed_update(bot, Update(update_id=1, message=msg(text, user))))


def press(env, data, user=ADMIN):
    dp, bot, *_ = env
    cq = CallbackQuery(id="1", from_user=User(id=user, is_bot=False, first_name="A"), chat_instance="x",
                       data=data, message=msg("…", user))
    asyncio.run(dp.feed_update(bot, Update(update_id=2, callback_query=cq)))


def published_post(db, tmp_path):
    p = make_product(db)
    post = create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path).post
    post.status = "published"
    db.commit()
    return post


def test_stranger_is_ignored(env):
    send(env, "/today", user=STRANGER)
    assert env[2].sent == []


def test_today_and_trend(env, db):
    send(env, "/today")
    assert "Draftlar (bugun): 0" in env[2].texts()[-1]
    send(env, "/trend New Balance 530 koʻp soʻralyapti")
    assert "Yozib qoʻyildi" in env[2].texts()[-1]
    assert db.scalar(select(TrendNote.text)) == "New Balance 530 koʻp soʻralyapti"


def test_neworder_preview_confirm_creates_order(env, db, tmp_path):
    post = published_post(db, tmp_path)
    send(env, f"/neworder {post.id} 41 Ali Valiyev +998 90 123 45 67")
    preview = env[2].sent[-1]
    assert "Yangi buyurtma" in preview.text and "Ali Valiyev" in preview.text
    ok = preview.reply_markup.inline_keyboard[0][0].callback_data
    assert db.query(Order).count() == 0                     # nothing before confirmation
    press(env, ok)
    o = db.scalar(select(Order))
    assert o is not None and o.customer_contact == "+998901234567"
    assert any("Buyurtma yaratildi" in t for t in env[2].texts())
    press(env, ok)                                         # second press: token already used
    assert db.query(Order).count() == 1 and "eskirgan" in env[2].texts()[-1]

    press(env, f"ord:paid:{o.id}")                         # status button
    db.refresh(o)
    assert o.prepayment_status == "paid" and isinstance(env[2].sent[-1], EditMessageText)


def test_neworder_bad_input(env):
    send(env, "/neworder 5 42 Ali")
    assert env[2].texts()[-1].startswith("❌")


def test_edit_flow_rejects_then_accepts(env, db, tmp_path):
    p = make_product(db)
    post = create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path).post
    db.commit()
    press(env, f"post:edit:{post.id}")
    send(env, "Rasmiy diler, oxirgisi!")
    assert "❌" in env[2].texts()[-1] and "rasmiy" in env[2].texts()[-1]
    send(env, "Yengil va qulay model.")                     # still in edit mode after a refusal
    db.refresh(post)
    assert post.body_uz == "Yengil va qulay model." and any(t.startswith("✅") for t in env[2].texts())


def test_approve_without_photo_is_blocked(env, db, tmp_path):
    p = make_product(db)
    post = create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path).post
    db.commit()
    press(env, f"post:approve:{post.id}")
    db.refresh(post)
    assert post.status == "draft" and any("surat yoʻq" in t for t in env[2].texts())


def test_publish_dry_run_goes_to_admin(env, db, tmp_path, monkeypatch):
    from app import config
    from tests.helpers import add_photos
    root = tmp_path / "photos"
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(root))
    monkeypatch.setenv("DRY_RUN", "true")
    send(env, "/publish")
    assert "navbati boʻsh" in env[2].texts()[-1]
    p = make_product(db)
    post = create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path).post
    db.commit()
    add_photos(root, p.style_code)
    press(env, f"post:approve:{post.id}")
    db.refresh(post)
    assert post.status == "approved"
    send(env, "/publish")
    db.refresh(post)
    assert post.status == "published"
    groups = [m for m in env[2].sent if isinstance(m, SendMediaGroup)]
    assert all(str(g.chat_id) == str(ADMIN) for g in groups)          # DRY_RUN: never the channel
    assert any("[DRY_RUN]" in t for t in env[2].texts())


def test_album_items_wait_for_captioned_one(env, db, tmp_path, monkeypatch):
    """Album photos arrive in parallel; the captionless one must wait for the SKU, not fail."""
    from aiogram.types import PhotoSize
    from app import config
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(tmp_path / "photos"))
    make_product(db)
    db.commit()
    saved = []

    async def fake_download(self, file, destination=None, **kw):
        Image.new("RGB", (20, 20)).save(destination)
        saved.append(destination)
    monkeypatch.setattr(Bot, "download", fake_download)

    def photo(caption, uid):
        return Message(message_id=uid, date=datetime.now(timezone.utc), chat=Chat(id=ADMIN, type="private"),
                       from_user=User(id=ADMIN, is_bot=False, first_name="A"), media_group_id="g1", caption=caption,
                       photo=[PhotoSize(file_id=f"f{uid}", file_unique_id=f"u{uid}", width=20, height=20)])
    dp, bot, session, _ = env

    async def both():  # captionless item first, captioned one 0.3 s later
        async def late():
            await asyncio.sleep(0.3)
            await dp.feed_update(bot, Update(update_id=11, message=photo("MR530SG", 2)))
        await asyncio.gather(dp.feed_update(bot, Update(update_id=10, message=photo(None, 1))), late())
    asyncio.run(both())
    assert len(saved) == 2 and not any("Izohga SKU" in t for t in session.texts())


def test_schedule_times(env):
    _, _, _, ctx = env
    sched = admin_bot.schedule(ctx, None)
    jobs = {j.id: str(j.trigger) for j in sched.get_jobs()}
    assert set(jobs) == {"import", "drafts", "publish0", "publish1", "publish2", "summary", "weekly"}
    assert "hour='9', minute='0'" in jobs["drafts"] and "hour='21', minute='30'" in jobs["summary"]


def test_auto_run_is_quiet_then_one_summary(env, db, tmp_path, monkeypatch):
    from app import config
    from app.agents import publisher
    monkeypatch.setitem(config.settings(), "auto_publish", True)
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(tmp_path / "photos"))
    monkeypatch.setattr(publisher, "create_draft", lambda *a, **k: (_ for _ in ()).throw(ValueError("boom")))
    make_product(db)
    db.commit()
    dp, bot, session, ctx = env
    asyncio.run(admin_bot.job_daily_drafts(ctx, admin_bot.Tg(bot, ctx)))
    assert session.sent == []                                   # nothing per draft in auto mode
    send(env, "/summary")
    assert "kunlik xulosa" in session.texts()[-1] and "MR530SG: boom" in session.texts()[-1]


def test_import_job_bad_sheet_goes_to_summary(env, monkeypatch):
    from app import config
    monkeypatch.setitem(config.settings(), "sheet_url", "/nonexistent.csv")
    dp, bot, session, ctx = env
    asyncio.run(admin_bot.job_import(ctx, None))
    send(env, "/summary")
    assert "Jadval yuklanmadi" in session.texts()[-1]


def screenshot_env(env, monkeypatch, tmp_path, answers):
    import json
    from aiogram.types import PhotoSize
    from app import config
    from tests.test_screens import DATA
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(tmp_path / "photos"))
    monkeypatch.setattr(config, "DATA_DIR", tmp_path / "data")

    async def fake_download(self, file, destination=None, **kw):
        Image.new("RGB", (1000, 2000), (200, 200, 200)).save(destination)
    monkeypatch.setattr(Bot, "download", fake_download)
    replies = iter(answers)
    env[3].llm = FakeLlm(lambda user: json.dumps(DATA | next(replies)))

    def photo(uid, caption=None, group=None):
        return Message(message_id=uid, date=datetime.now(timezone.utc), chat=Chat(id=ADMIN, type="private"),
                       from_user=User(id=ADMIN, is_bot=False, first_name="A"), caption=caption, media_group_id=group,
                       photo=[PhotoSize(file_id=f"f{uid}", file_unique_id=f"u{uid}", width=20, height=20)])
    return photo


def buttons(env):
    return [b.callback_data for row in env[2].sent[-1].reply_markup.inline_keyboard for b in row]


def test_screenshots_album_preview_confirm(env, db, tmp_path, monkeypatch):
    photo = screenshot_env(env, monkeypatch, tmp_path, [{}])
    dp, bot, session, ctx = env

    async def album():
        await asyncio.gather(dp.feed_update(bot, Update(update_id=20, message=photo(1, "https://dw4.co/t/A/x", "g"))),
                             dp.feed_update(bot, Update(update_id=21, message=photo(2, None, "g"))))
    asyncio.run(album())
    assert len(ctx.llm.calls) == 1                                  # one read for the whole album
    assert "Toʻgʻrimi" in session.texts()[-1]
    ok = buttons(env)[0]
    assert ok.startswith("scr:ok:")
    press(env, ok)
    from app.db.models import Product
    p = db.scalar(select(Product).where(Product.style_code == "MR530SG"))
    assert p is not None and p.source_url == "https://dw4.co/t/A/x"
    assert any(t.startswith("✓ qoʻshildi: New Balance 530") for t in session.texts())


def test_screenshot_fix_flow(env, db, tmp_path, monkeypatch):
    photo = screenshot_env(env, monkeypatch, tmp_path, [{"style_code": None, "size_system": "US"}, {}])
    dp, bot, session, ctx = env
    asyncio.run(dp.feed_update(bot, Update(update_id=30, message=photo(5))))
    assert "Saqlab boʻlmaydi" in session.texts()[-1] and not any(b.startswith("scr:ok") for b in buttons(env))
    press(env, [b for b in buttons(env) if b.startswith("scr:fix")][0])
    send(env, "SKU MR530SG, oʻlchamlar EU")
    assert "Admin correction (apply it): SKU MR530SG" in ctx.llm.calls[-1][1]
    assert "Toʻgʻrimi" in session.texts()[-1]


def test_link_gets_explanation(env):
    send(env, "https://www.poizon.com/product/new-balance-530-582868624")
    assert "skrinshot" in env[2].texts()[-1]


def test_buyprice_recalculates_profit(env, db, tmp_path):
    post = published_post(db, tmp_path)
    send(env, f"/neworder {post.id} 41 Ali Valiyev +998 90 123 45 67")
    press(env, env[2].sent[-1].reply_markup.inline_keyboard[0][0].callback_data)
    assert any("Xariddan oldin ilovada joriy narxni tekshiring" in t for t in env[2].texts())
    o = db.scalar(select(Order))
    send(env, f"/buyprice {o.id} 520")
    db.refresh(o)
    assert o.buy_price_cny == 520 and o.buy_cost_uzs > 0
    assert "Foyda:" in env[2].texts()[-1] and "rejada" in env[2].texts()[-1]
    send(env, "/buyprice x")
    assert env[2].texts()[-1].startswith("❌")


def test_report_sends_text_and_excel(env):
    from aiogram.methods import SendDocument
    send(env, "/report")
    assert "Tushum" in env[2].texts()[-1]
    assert isinstance(env[2].sent[-1], SendDocument)


def test_size_picker_screenshot_is_merged(env, db, tmp_path, monkeypatch):
    photo = screenshot_env(env, monkeypatch, tmp_path, [{"sizes": []}, {}])
    dp, bot, session, ctx = env
    asyncio.run(dp.feed_update(bot, Update(update_id=40, message=photo(7))))
    assert "oʻlcham tanlash oynasining skrinshotini yuboring" in session.texts()[-1]
    asyncio.run(dp.feed_update(bot, Update(update_id=41, message=photo(8))))
    assert "size picker" in ctx.llm.calls[-1][1] and "Toʻgʻrimi" in session.texts()[-1]
    paths, _, _ = next(iter(ctx.pending_screens.values()))
    assert len(paths) == 2                                          # first screenshot + size picker


def test_force_button_only_for_low_price(env, db, tmp_path, monkeypatch):
    photo = screenshot_env(env, monkeypatch, tmp_path, [{"sizes": [{"size": "41", "price": 150}]},
                                                        {"brand": None, "model_name": "Dunk Low"}])
    dp, bot, session, ctx = env
    asyncio.run(dp.feed_update(bot, Update(update_id=50, message=photo(9))))
    force = [b for b in buttons(env) if b.startswith("scr:force")]
    assert force and not any(b.startswith("scr:ok") for b in buttons(env))
    press(env, force[0])
    from app.db.models import Product
    assert db.scalar(select(Product).where(Product.style_code == "MR530SG")).min_price_override
    asyncio.run(dp.feed_update(bot, Update(update_id=51, message=photo(10))))
    assert "oʻxshatma" in session.texts()[-1]
    assert not any(b.startswith(("scr:force", "scr:ok")) for b in buttons(env))   # knock-off: no override
    send(env, "/prices")
    assert "New Balance · Krossovka" in session.texts()[-1]
