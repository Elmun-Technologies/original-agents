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
