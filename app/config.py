"""Loads config/*.yaml (business numbers) and env vars (secrets)."""
import os
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

TZ = ZoneInfo("Asia/Tashkent")  # business time: dates, months, customs schedule
ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"  # runtime state (gitignored, docker volume)

REQUIRED = {
    "settings.yaml": ["poizon_scraping_enabled", "sourcing_mode", "image_source_policy", "auto_publish", "sheet_url",
                      "schedule", "images", "ranking", "trial", "pricing", "customs", "sourcing", "llm", "content", "stock",
                      "publishing"],
    "schedule": ["import_time", "draft_time", "publish_times", "summary_time", "weekly_report"],
    "trial": ["start", "days", "paid_orders_min", "ads_per_order_max_uzs", "size_problem_max_pct"],
    "images": ["max_bytes", "pause_seconds", "timeout_seconds", "min_side_px"],
    "ranking": ["weights", "price_range_usd", "sold_cap", "winter_months"],
    "pricing": ["buyout_fee_pct", "buyout_fee_min_usd", "ship_rate_per_kg_usd", "avia_months",
                "local_delivery_usd", "volumetric_divisor", "usd_rate_buffer_pct", "round_to_uzs",
                "quote_valid_hours", "stale_rate_max_hours", "stale_rate_extra_buffer_pct"],
    "customs": ["duty_free_limit_usd", "customs_value_includes_shipping", "schedule"],
    "llm": ["models", "daily_budget_usd", "max_tokens", "effort", "refusal_fallback",
            "no_fallback_models", "customer_data_purposes", "prices_per_mtok", "pii_allowlist"],
    "content": ["badge", "delivery_days", "cta", "hashtags", "max_body_chars", "llm_retries", "caption_max_chars",
                "photos_dir", "cards_max"],
    "stock": ["markup", "delivery_text"],
    "publishing": ["daily_drafts", "price_change_alert_pct", "price_max_age_days",
                   "stale_price_buffer_after_days", "stale_price_buffer_pct", "repost_after_days",
                   "per_brand_daily_max", "per_model_daily_max", "stock_repost_after_days",
                   "trend_days", "photos_max_per_sku"],
    "category": ["weight_kg", "package_cm", "markup", "winter", "size_type", "label_uz", "hashtag"],
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
    _require(settings["llm"], REQUIRED["llm"], "settings.yaml:llm")
    _require(settings["content"], REQUIRED["content"], "settings.yaml:content")
    _require(settings["stock"], REQUIRED["stock"], "settings.yaml:stock")
    for key in ("publishing", "schedule", "images", "ranking", "trial"):
        _require(settings[key], REQUIRED[key], f"settings.yaml:{key}")
    if settings["image_source_policy"] not in ("source_images", "own_photos_only"):
        raise ConfigError(f"image_source_policy: {settings['image_source_policy']!r}")
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
