"""One-time move from the Mac (SQLite + files) to the server (Postgres + data volume).

On the Mac:     sh scripts/export_for_server.sh        -> data/export-YYYYmmdd-HHMM.tgz
On the server:  python -m app.migrate_sqlite /app/data/export-....tgz
                (inside the bot container, started with BOT_HOLD=true; see docs/deploy_coolify.md)

The archive holds app.db and the photo/post/screenshot folders. Files are unpacked into
DATA_DIR, every table is copied with its ids into DATABASE_URL (must be migrated to the same
revision and empty), Postgres id sequences are moved past the copied ids, and stored file paths
(posts.image_paths) are rewritten from the Mac's data folder to DATA_DIR.
"""
import sys
import tarfile
from pathlib import Path

from sqlalchemy import func, insert, select, text
from sqlalchemy.engine import Engine

from app import config
from app.db import make_engine
from app.db.models import Base, Post, Product

ALLOWED = ("app.db", "photos/", "posts/", "screens/", "reports/", "cbu_")  # "._*" (macOS) skipped below
CHUNK = 500


class MigrateError(Exception):
    pass


def unpack(archive: Path, dest: Path) -> Path:
    """Extracts the export into dest; returns the SQLite file. Only expected names, no path tricks."""
    with tarfile.open(archive) as tar:
        members = [m for m in tar.getmembers() if m.name.lstrip("./").startswith(ALLOWED)
                   and not Path(m.name).name.startswith("._")]
        tar.extractall(dest, members=members, filter="data")
    db = dest / "app.db"
    if not db.exists():
        raise MigrateError(f"{archive.name} ichida app.db yoʻq")
    return db


def local_path(stored: str, data_dir: Path) -> str:
    """'/Users/x/orignal /data/posts/5/card_1.png' -> '<DATA_DIR>/posts/5/card_1.png'."""
    if "/data/" not in stored:
        return stored
    return str(data_dir / stored.rsplit("/data/", 1)[1])


def revision(engine: Engine) -> str | None:
    with engine.connect() as c:
        try:
            return c.execute(text("SELECT version_num FROM alembic_version")).scalar()
        except Exception:
            return None


def copy(src: Engine, dst: Engine, data_dir: Path) -> dict[str, int]:
    if revision(src) != revision(dst):
        raise MigrateError(f"Sxema versiyasi farq qiladi: Mac {revision(src)}, server {revision(dst)}. "
                           "Ikkalasida ham 'alembic upgrade head' qiling.")
    with dst.connect() as c:
        if c.execute(select(func.count()).select_from(Product.__table__)).scalar():
            raise MigrateError("Server bazasi boʻsh emas — koʻchirish faqat boʻsh bazaga.")
    counts = {}
    with src.connect() as s, dst.begin() as d:
        for table in Base.metadata.sorted_tables:  # parents before children
            rows = [dict(r) for r in s.execute(select(table)).mappings()]
            if table.name == "app_state":  # the Mac's "bot running" flag must not look like a server crash
                rows = [r for r in rows if r["key"] != "bot_running"]
            if table is Post.__table__:
                for r in rows:
                    r["image_paths"] = [local_path(p, data_dir) for p in r["image_paths"] or []]
            for i in range(0, len(rows), CHUNK):
                d.execute(insert(table), rows[i:i + CHUNK])
            counts[table.name] = len(rows)
        if dst.dialect.name == "postgresql":  # next ids after the copied ones
            for table in Base.metadata.sorted_tables:
                if "id" in table.c and table.c.id.autoincrement in (True, "auto") and table.c.id.type.python_type is int:
                    d.execute(text(f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                                   f"COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM {table.name}"))
    return counts


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src_path = Path(sys.argv[1])
    data_dir = config.DATA_DIR
    db = unpack(src_path, data_dir) if src_path.suffix in (".tgz", ".gz") else src_path
    try:
        counts = copy(make_engine(f"sqlite:///{db}"), make_engine(), data_dir)
    except MigrateError as e:
        sys.exit(f"Xato: {e}")
    print("Koʻchirildi:")
    for name, n in counts.items():
        print(f"  {name}: {n}")
    print(f"Fayllar: {data_dir}")


if __name__ == "__main__":
    main()
