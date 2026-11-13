"""Handler-level tests: real aiogram Dispatcher + router, Telegram replaced by a fake session."""
import asyncio
from datetime import datetime, timezone

import pytest
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
