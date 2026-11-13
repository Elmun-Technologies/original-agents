"""Loads config/*.yaml (business numbers) and env vars (secrets)."""
import os
from functools import lru_cache
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"  # runtime state (gitignored, docker volume)

REQUIRED = {
    "settings.yaml": ["poizon_tos_reviewed", "sourcing_mode", "image_source_policy", "pricing", "customs"],
    "pricing": ["buyout_fee_pct", "buyout_fee_min_usd", "ship_rate_per_kg_usd", "avia_months",
                "local_delivery_usd", "volumetric_divisor", "usd_rate_buffer_pct", "round_to_uzs",
                "quote_valid_hours", "stale_rate_max_hours", "stale_rate_extra_buffer_pct"],
    "customs": ["duty_free_limit_usd", "customs_value_includes_shipping", "schedule"],
    "category": ["weight_kg", "package_cm", "markup", "winter"],
}


class ConfigError(Exception):
    pass


def _require(d: dict, keys: list[str], where: str) -> None:
    missing = [k for k in keys if k not in d]
    if missing:
        raise ConfigError(f"{where}: missing keys {missing}")


def load_yaml(name: str) -> dict:
    path = CONFIG_DIR / name
    if not path.exists():
        raise ConfigError(f"config file not found: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def validate(settings: dict, categories: dict) -> None:
    _require(settings, REQUIRED["settings.yaml"], "settings.yaml")
    _require(settings["pricing"], REQUIRED["pricing"], "settings.yaml:pricing")
    _require(settings["customs"], REQUIRED["customs"], "settings.yaml:customs")
    for name, cat in categories.items():
        _require(cat, REQUIRED["category"], f"categories.yaml:{name}")


@lru_cache
def settings() -> dict:
    s, c = load_yaml("settings.yaml"), load_yaml("categories.yaml")
    validate(s, c)
    return s


@lru_cache
def categories() -> dict:
    settings()  # validates both files
    return load_yaml("categories.yaml")


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        raise ConfigError(f"env var {name} is not set (see .env.example)")
    return value


def dry_run() -> bool:
    return os.environ.get("DRY_RUN", "true").lower() != "false"
