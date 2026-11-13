"""Loads config/*.yaml (business numbers) and env vars (secrets)."""
import os
from functools import lru_cache
from pathlib import Path

import yaml

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"

REQUIRED = {
    "settings.yaml": ["poizon_tos_reviewed", "sourcing_mode", "image_source_policy", "pricing", "customs"],
    "pricing": ["buyout_fee_pct", "buyout_fee_min_usd", "ship_rate_per_kg_usd", "avia_months",
                "local_delivery_usd", "volumetric_divisor", "usd_rate_buffer_pct", "round_to_uzs",
                "quote_valid_hours"],
    "customs": ["duty_free_limit_usd", "customs_value_includes_shipping", "schedule"],
    "category": ["weight_kg", "package_cm", "markup", "winter"],
}


class ConfigError(Exception):
    pass


def _require(d: dict, keys: list[str], where: str) -> None:
    missing = [k for k in keys if k not in d]
    if missing:
        raise ConfigError(f"{where}: missing keys {missing}")


def _load(name: str) -> dict:
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
    s, c = _load("settings.yaml"), _load("categories.yaml")
    validate(s, c)
    return s


@lru_cache
def categories() -> dict:
    settings()  # validates both files
    return _load("categories.yaml")


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        raise ConfigError(f"env var {name} is not set (see .env.example)")
    return value


def dry_run() -> bool:
    return os.environ.get("DRY_RUN", "true").lower() != "false"
