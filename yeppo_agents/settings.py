"""config/yeppo.yaml (business numbers) + environment (secrets). Root .env is read for local runs;
real environment variables (Docker/Coolify) win."""
import os
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

TZ = ZoneInfo("Asia/Tashkent")
ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("YEPPO_DATA_DIR", ROOT / "data" / "yeppo"))


def _load_dotenv(path: Path = ROOT / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


@lru_cache
def cfg() -> dict:
    return yaml.safe_load((ROOT / "config" / "yeppo.yaml").read_text(encoding="utf-8"))


def env(name: str, default: str | None = None, required: bool = False) -> str | None:
    v = os.environ.get(name, default)
    if required and not v:
        raise RuntimeError(f"{name} is not set (.env / Coolify)")
    return v


def dry_run() -> bool:
    return os.environ.get("DRY_RUN", "true").lower() != "false"


def admin_ids() -> list[int]:
    return [int(x) for x in (env("TELEGRAM_ADMIN_IDS") or "").replace(" ", "").split(",") if x]


def site_url() -> str:
    return (env("YEPPO_SITE_URL") or "https://yeppo.uz").rstrip("/")
