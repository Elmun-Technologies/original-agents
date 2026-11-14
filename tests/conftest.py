import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.orm import Session

from app import config
from app.db import make_engine


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


@pytest.fixture
def pg_url():
    """A fresh, empty Postgres database per test (TEST_POSTGRES_URL points at the server's
    maintenance DB, e.g. postgresql+psycopg://postgres:pw@localhost:5433/postgres)."""
    import os
    import secrets

    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url
    base = os.environ.get("TEST_POSTGRES_URL")
    if not base:
        pytest.skip("TEST_POSTGRES_URL not set")
    name = f"test_{secrets.token_hex(4)}"
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text(f'CREATE DATABASE "{name}"'))
    yield make_url(base).set(database=name).render_as_string(hide_password=False)
    with admin.connect() as c:
        c.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
    admin.dispose()


@pytest.fixture
def pg_db(pg_url):
    command.upgrade(alembic_cfg(pg_url), "head")
    engine = make_engine(pg_url)
    with Session(engine) as s:
        yield s
    engine.dispose()
