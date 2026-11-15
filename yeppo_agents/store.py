"""Agent state (not the shop catalog): candidates found at the source, sent posts, admin trends, LLM spend.
SQLite file by default; YEPPO_AGENTS_DB_URL may point to Postgres (schema is portable)."""
import json
from datetime import datetime, timedelta
from functools import lru_cache

from sqlalchemy import (JSON, Column, DateTime, Float, Integer, MetaData, Numeric, String, Table, Text, create_engine,
                        func, insert, select, update)
from sqlalchemy.engine import Engine

from yeppo_agents.settings import DATA, TZ, env

meta = MetaData()

candidates = Table(
    "yeppo_candidates", meta,
    Column("id", Integer, primary_key=True),
    Column("url", String(500), unique=True, nullable=False),
    Column("name", String(300), nullable=False),
    Column("brand", String(120), nullable=False),
    Column("model", String(80)),
    Column("category", String(40)),
    Column("volume", String(40)),
    Column("img", String(500)),
    Column("price_usd", Numeric(10, 2), nullable=False),
    Column("sell_uzs", Integer),
    Column("profit_uzs", Integer),
    Column("score", Float, default=0),
    Column("reasons", JSON, default=list),
    Column("status", String(20), default="new", nullable=False),  # new | sent | added | rejected
    Column("product_slug", String(120)),
    Column("found_at", DateTime(timezone=True), nullable=False),
    Column("checked_at", DateTime(timezone=True), nullable=False),
)

posts = Table(
    "yeppo_posts", meta,
    Column("id", Integer, primary_key=True),
    Column("product_slug", String(120), nullable=False, index=True),
    Column("caption", Text),
    Column("files", JSON, default=list),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

trends = Table(
    "yeppo_trends", meta,
    Column("id", Integer, primary_key=True),
    Column("text", String(300), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

llm_usage = Table(
    "yeppo_llm_usage", meta,
    Column("id", Integer, primary_key=True),
    Column("day", String(10), nullable=False, index=True),
    Column("purpose", String(40)),
    Column("input_tokens", Integer, default=0),
    Column("output_tokens", Integer, default=0),
    Column("cost_usd", Float, default=0),
)


def now() -> datetime:
    return datetime.now(TZ)


@lru_cache
def engine() -> Engine:
    url = env("YEPPO_AGENTS_DB_URL")
    if not url:
        DATA.mkdir(parents=True, exist_ok=True)
        url = f"sqlite:///{DATA / 'agents.db'}"
    e = create_engine(url, future=True)
    meta.create_all(e)
    return e


def add_trend(text: str) -> None:
    with engine().begin() as c:
        c.execute(insert(trends).values(text=text[:300], created_at=now()))


def recent_trends(days: int) -> list[str]:
    with engine().connect() as c:
        rows = c.execute(select(trends.c.text).where(trends.c.created_at >= now() - timedelta(days=days))).all()
    return [r[0] for r in rows]


def upsert_candidate(**v) -> int:
    with engine().begin() as c:
        row = c.execute(select(candidates.c.id, candidates.c.status).where(candidates.c.url == v["url"])).first()
        if row:
            keep = {k: x for k, x in v.items() if k not in ("url", "found_at")}
            c.execute(update(candidates).where(candidates.c.id == row.id).values(**keep, checked_at=now()))
            return row.id
        return c.execute(insert(candidates).values(**v, found_at=now(), checked_at=now())).inserted_primary_key[0]


def candidate(cid: int) -> dict | None:
    with engine().connect() as c:
        r = c.execute(select(candidates).where(candidates.c.id == cid)).mappings().first()
    return dict(r) if r else None


def candidates_by_status(*status: str, limit: int = 50) -> list[dict]:
    with engine().connect() as c:
        rows = c.execute(select(candidates).where(candidates.c.status.in_(status))
                         .order_by(candidates.c.score.desc()).limit(limit)).mappings().all()
    return [dict(r) for r in rows]


def known_urls() -> dict[str, str]:
    with engine().connect() as c:
        return {r.url: r.status for r in c.execute(select(candidates.c.url, candidates.c.status))}


def set_status(cid: int, status: str, product_slug: str | None = None) -> None:
    with engine().begin() as c:
        vals = {"status": status}
        if product_slug:
            vals["product_slug"] = product_slug
        c.execute(update(candidates).where(candidates.c.id == cid).values(**vals))


def record_post(slug: str, caption: str, files: list[str]) -> None:
    with engine().begin() as c:
        c.execute(insert(posts).values(product_slug=slug, caption=caption, files=files, created_at=now()))


def last_posted() -> dict[str, datetime]:
    with engine().connect() as c:
        rows = c.execute(select(posts.c.product_slug, func.max(posts.c.created_at)).group_by(posts.c.product_slug)).all()
    out = {}
    for slug, at in rows:
        out[slug] = at if at.tzinfo else at.replace(tzinfo=TZ)
    return out


def add_llm_usage(purpose: str, inp: int, out: int, cost: float) -> None:
    with engine().begin() as c:
        c.execute(insert(llm_usage).values(day=now().date().isoformat(), purpose=purpose, input_tokens=inp,
                                           output_tokens=out, cost_usd=cost))


def llm_spent_today() -> float:
    with engine().connect() as c:
        return float(c.execute(select(func.coalesce(func.sum(llm_usage.c.cost_usd), 0))
                               .where(llm_usage.c.day == now().date().isoformat())).scalar())


def dumps(x) -> str:
    return json.dumps(x, ensure_ascii=False, default=str)
