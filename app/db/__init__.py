from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url

from app import config


def make_engine(url: str | None = None, *, foreign_keys: bool = True) -> Engine:
    """foreign_keys=False only for migrations: SQLite batch mode recreates tables, and with
    FKs on, dropping the old table cascades deletes into child tables."""
    url = url or config.env("DATABASE_URL")
    u = make_url(url)
    if u.get_backend_name() == "sqlite" and u.database and u.database != ":memory:":
        Path(u.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url)
    if u.get_backend_name() == "sqlite" and foreign_keys:
        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):  # SQLite ignores FKs unless asked
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    return engine
