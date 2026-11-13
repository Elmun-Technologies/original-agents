from datetime import date, timedelta
from decimal import Decimal

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config
from app.db import make_engine
from app.db.models import (Expense, Lead, Order, Post, Product, ProductSize, Quote, utcnow)

TABLES = {"products", "product_sizes", "demand_briefs", "quotes", "posts", "leads", "orders",
          "expenses", "settings_history"}


def alembic_cfg(url: str) -> Config:
    cfg = Config(str(config.ROOT / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


@pytest.fixture
def db(tmp_path):
    url = f"sqlite:///{tmp_path / 'sub' / 'app.db'}"  # also checks parent dir is created
    command.upgrade(alembic_cfg(url), "head")
    engine = make_engine(url)
    with Session(engine) as s:
        yield s
    engine.dispose()


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
                sizes=[ProductSize(size_eu="42", price_usd=Decimal("95.00"))])
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
                category="sneakers", sizes=[ProductSize(size_eu="41", price_usd=1)])
    db.add(p)
    db.commit()
    db.delete(p)
    db.commit()
    assert db.query(ProductSize).count() == 0
