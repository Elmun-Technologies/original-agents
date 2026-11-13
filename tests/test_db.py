from datetime import date, timedelta
from decimal import Decimal

import pytest
from alembic import command
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from tests.conftest import alembic_cfg

from app.db import make_engine
from app.db.models import (Expense, Lead, Order, Post, Product, ProductSize, Quote, utcnow)

TABLES = {"products", "product_sizes", "demand_briefs", "quotes", "posts", "leads", "orders",
          "expenses", "settings_history"}


def test_migration_up_down_and_no_drift(tmp_path):
    url = f"sqlite:///{tmp_path / 'app.db'}"
    cfg = alembic_cfg(url)
    command.upgrade(cfg, "head")
    assert TABLES <= set(inspect(make_engine(url)).get_table_names())
    command.check(cfg)  # raises if models.py and migrations disagree
    command.downgrade(cfg, "base")
    assert not TABLES & set(inspect(make_engine(url)).get_table_names())


def seed(s: Session):
    p = Product(source="manual_sheet", brand="New Balance", model_name="530",
                style_code="MR530SG", category="sneakers",
                sizes=[ProductSize(size_eu="42", source_price=Decimal("489.00"), source_currency="CNY")])
    s.add(p)
    s.flush()
    q = Quote(product_id=p.id, size="42", landed_cost_usd=Decimal("110.25"),
              sell_price_uzs=1_650_000, usd_rate=Decimal("12153.04"),
              valid_until=utcnow() + timedelta(hours=24), breakdown={"customs_usd": 0})
    post = Post(product_id=p.id)
    s.add_all([q, post])
    s.flush()
    return p, q, post


def test_full_chain(db):
    p, q, post = seed(db)
    lead = Lead(product_id=p.id, post_id=post.id)
    db.add(lead)
    db.flush()
    o = Order(lead_id=lead.id, product_id=p.id, post_id=post.id, quote_id=q.id, size="42",
              sell_price_uzs=q.sell_price_uzs, customer_name="Ali", customer_contact="+998901234567",
              customs_value_usd=Decimal("95.00"), weight_kg=Decimal("1.5"))
    db.add_all([o, Expense(date=date(2026, 11, 14), type="ads", amount_uzs=150_000)])
    db.commit()
    assert post.status == "draft"
    assert o.prepayment_status == "awaiting_prepayment"
    assert o.buyout_status == "pending" and o.shipping_status == "pending"
    assert o.external_parcels_usd == 0 and o.vacuum_packing is None
    assert lead.status == "new"


def test_foreign_keys_enforced(db):
    db.add(Post(product_id=999))
    with pytest.raises(IntegrityError):
        db.flush()


@pytest.mark.parametrize("make", [
    lambda p, q: Post(product_id=p.id, status="published_maybe"),
    lambda p, q: Expense(date=date(2026, 11, 14), type="crypto", amount_uzs=1),
    lambda p, q: Expense(date=date(2026, 11, 14), type="ads", amount_uzs=-1),
    lambda p, q: Lead(product_id=p.id, status="hot"),
])
def test_check_constraints(db, make):
    p, q, _ = seed(db)
    db.add(make(p, q))
    with pytest.raises(IntegrityError):
        db.flush()


def test_order_status_and_external_parcels_checks(db):
    p, q, _ = seed(db)
    base = dict(product_id=p.id, quote_id=q.id, size="42", sell_price_uzs=1, customer_name="A",
                customer_contact="+998900000000", customs_value_usd=1, weight_kg=1)
    for bad in ({"shipping_status": "lost_in_space"}, {"external_parcels_usd": -5}):
        db.add(Order(**base, **bad))
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()
        p, q, _ = seed(db)
        base.update(product_id=p.id, quote_id=q.id)


def test_unique_sku_per_source(db):
    seed(db)
    db.add(Product(source="manual_sheet", brand="NB", model_name="x", style_code="MR530SG",
                   category="sneakers"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_sizes_cascade_on_product_delete(db):
    p = Product(source="manual_sheet", brand="NB", model_name="x", style_code="X1",
                category="sneakers", sizes=[ProductSize(size_eu="41", source_price=1, source_currency="USD")])
    db.add(p)
    db.commit()
    db.delete(p)
    db.commit()
    assert db.query(ProductSize).count() == 0


def test_migration_0003_keeps_old_usd_price(tmp_path):
    from sqlalchemy import text
    url = f"sqlite:///{tmp_path / 'app.db'}"
    cfg = alembic_cfg(url)
    command.upgrade(cfg, "0002")
    eng = make_engine(url)
    with eng.begin() as c:
        c.execute(text("INSERT INTO products (id, source, brand, model_name, style_code, category, images,"
                       " first_seen_at, last_checked_at, is_active) VALUES (1, 'manual_sheet', 'NB', '530',"
                       " 'X', 'sneakers', '[]', '2026-11-01', '2026-11-01', 1)"))
        c.execute(text("INSERT INTO product_sizes (product_id, size_eu, price_usd, available, checked_at)"
                       " VALUES (1, '42', 73.30, 1, '2026-11-01')"))
    command.upgrade(cfg, "head")
    with eng.connect() as c:
        assert c.execute(text("SELECT source_price, source_currency FROM product_sizes")).one() == (73.3, "USD")
        assert c.execute(text("SELECT origin FROM products")).scalar() == "other"
    command.downgrade(cfg, "0002")
    with eng.connect() as c:
        assert c.execute(text("SELECT price_usd FROM product_sizes")).scalar() == 73.3


@pytest.mark.parametrize("make", [
    lambda: ProductSize(size_eu="43", source_price=10, source_currency="EUR"),
    lambda: ProductSize(size_eu="43", source_price=0, source_currency="USD"),
])
def test_size_price_checks(db, make):
    p, _, _ = seed(db)
    p.sizes.append(make())
    with pytest.raises(IntegrityError):
        db.flush()


def test_origin_check(db):
    db.add(Product(source="manual_sheet", brand="NB", model_name="x", style_code="O1",
                   category="sneakers", origin="taobao"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_datetimes_stored_as_utc_and_read_back_aware(db):
    from datetime import datetime, timezone
    from app.config import TZ
    from app.db.models import LlmCall
    local = datetime(2026, 11, 15, 10, 0, tzinfo=TZ)          # 05:00 UTC
    db.add(LlmCall(purpose="x", model="m", input_tokens=0, output_tokens=0, cost_usd=0, created_at=local))
    db.commit()
    db.expire_all()                                            # force a real read from SQLite
    got = db.query(LlmCall).one().created_at
    assert got == local and got.tzinfo is not None and got.utcoffset().total_seconds() == 0
    assert db.query(LlmCall).filter(LlmCall.created_at < datetime(2026, 11, 15, 5, 30, tzinfo=timezone.utc)).count() == 1
    db.add(LlmCall(purpose="x", model="m", input_tokens=0, output_tokens=0, cost_usd=0,
                   created_at=datetime(2026, 11, 15, 10, 0)))  # naive: rejected
    with pytest.raises(Exception, match="naive"):
        db.flush()
