"""Postgres-only checks: migrations, the main business chain, timestamps, the SQLite -> Postgres move.
Run:  docker run -d --name pgtest -e POSTGRES_PASSWORD=pw -p 5433:5432 postgres:16-alpine
      TEST_POSTGRES_URL=postgresql+psycopg://postgres:pw@localhost:5433/postgres uv run pytest -m postgres
"""
import tarfile
from datetime import timedelta
from decimal import Decimal

import pytest
from alembic import command
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config
from app.agents import orders, publisher, screens
from app.agents.content import create_draft
from app.db import make_engine
from app.db.models import Order, Post, PriceObservation, Product
from app.migrate_sqlite import MigrateError, copy, local_path, unpack
from app.reports import weekly
from tests.conftest import alembic_cfg
from tests.helpers import FX, NOW, FakeLlm, make_product
from tests.test_screens import DATA

pytestmark = pytest.mark.postgres


def test_migrations_up_down_no_drift(pg_url):
    cfg = alembic_cfg(pg_url)
    command.upgrade(cfg, "head")
    command.check(cfg)              # models.py and migrations agree on Postgres too
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


def test_business_chain(pg_db, tmp_path, monkeypatch):
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(tmp_path / "photos"))
    p, msg = screens.save(pg_db, DATA, [])
    assert msg.startswith("✓") and pg_db.scalar(select(PriceObservation.min_price)) == Decimal("489.00")
    post = create_draft(pg_db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path).post
    publisher.mark_published(pg_db, post, 1, NOW)
    req = orders.parse_neworder(f"{post.id} 41 Ali +998901234567")
    o = orders.create_order(pg_db, orders.preview_order(pg_db, req, FX, NOW), NOW)
    orders.apply_action(pg_db, o, "paid", NOW)
    assert "Foyda" in orders.set_buy_price(pg_db, f"{o.id} 500", FX, NOW)
    pg_db.commit()
    rep = weekly.build(pg_db, NOW.date() - timedelta(days=NOW.weekday()), NOW.date(), Decimal("12000"))
    assert rep.revenue == o.sell_price_uzs and rep.costs[weekly.GOODS] == o.buy_cost_uzs
    assert pg_db.get(Order, o.id).created_at.utcoffset() == timedelta(0)     # timestamptz, UTC back


def test_constraints_enforced(pg_db):
    p = make_product(pg_db)
    pg_db.add(Post(product_id=p.id, status="bogus"))
    with pytest.raises(IntegrityError):
        pg_db.flush()


def test_sqlite_to_postgres_move(tmp_path, pg_url, monkeypatch):
    # a "Mac" SQLite DB with data and files
    sqlite_url = f"sqlite:///{tmp_path / 'mac' / 'app.db'}"
    command.upgrade(alembic_cfg(sqlite_url), "head")
    with Session(make_engine(sqlite_url)) as s:
        p = make_product(s)
        post = create_draft(s, p, FakeLlm(), FX, now=NOW, out_root=tmp_path / "mac" / "data" / "posts").post
        s.commit()
        old_paths = list(post.image_paths)
    (tmp_path / "mac" / "photos" / "MR530SG").mkdir(parents=True)
    (tmp_path / "mac" / "photos" / "MR530SG" / "a.jpg").write_bytes(b"x")
    archive = tmp_path / "export.tgz"
    with tarfile.open(archive, "w:gz") as tar:
        tar.add(tmp_path / "mac" / "app.db", "app.db")
        tar.add(tmp_path / "mac" / "photos", "photos")
        tar.add(tmp_path / "mac" / "app.db", "../evil.db")          # must not escape DATA_DIR

    server_data = tmp_path / "server"
    db_file = unpack(archive, server_data)
    assert (server_data / "photos" / "MR530SG" / "a.jpg").exists() and not (tmp_path / "evil.db").exists()

    command.upgrade(alembic_cfg(pg_url), "head")
    counts = copy(make_engine(f"sqlite:///{db_file}"), make_engine(pg_url), server_data)
    assert counts["products"] == 1 and counts["posts"] == 1 and counts["quotes"] == 2
    with Session(make_engine(pg_url)) as s:
        moved = s.scalar(select(Post))
        assert moved.image_paths == [local_path(x, server_data) for x in old_paths]
        assert all(x.startswith(str(server_data)) for x in moved.image_paths)
        s.add(Product(source="x", brand="b", model_name="m", style_code="NEW", category="sneakers"))
        s.commit()                                                     # sequence moved past copied ids
        assert s.scalar(select(Product.id).where(Product.style_code == "NEW")) == 2
    with pytest.raises(MigrateError, match="boʻsh emas"):
        copy(make_engine(f"sqlite:///{db_file}"), make_engine(pg_url), server_data)
