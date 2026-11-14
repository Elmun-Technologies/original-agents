"""DB schema (CLAUDE.md §5). Written for Postgres; SQLite works for dev/tests.
All datetimes are stored in UTC."""
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (JSON, BigInteger, CheckConstraint, DateTime, ForeignKey, MetaData, Numeric, TypeDecorator,
                        String, Text, UniqueConstraint)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Always stores UTC, always returns aware UTC datetimes.
    SQLite keeps the wall time of an aware datetime without converting it (10:00+05:00 is
    stored as "10:00" and read back as 10:00 UTC), so we convert on the way in and tag on
    the way out. Postgres (timestamptz) behaves the same through this type."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                raise ValueError("naive datetime: pass an aware datetime (UTC or Asia/Tashkent)")
            value = value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


USD = Numeric(12, 2)
KG = Numeric(8, 3)


def one_of(column: str, values: tuple[str, ...]) -> CheckConstraint:
    return CheckConstraint(f"{column} IN ({', '.join(repr(v) for v in values)})", name=column)


POST_STATUSES = ("draft", "approved", "published", "rejected")
PREPAYMENT_STATUSES = ("awaiting_prepayment", "paid")
BUYOUT_STATUSES = ("pending", "bought")
SHIPPING_STATUSES = ("pending", "in_china_warehouse", "shipped", "in_tashkent", "delivered")
LEAD_STATUSES = ("new", "ordered", "lost")
EXPENSE_TYPES = ("ads", "ai", "server", "manager", "other")
CURRENCIES = ("USD", "CNY")
ORIGINS = ("dewu", "poizon_com", "other")


class Base(DeclarativeBase):
    type_annotation_map = {datetime: UTCDateTime}  # timestamptz on Postgres
    # Stable constraint names: required for Alembic batch migrations on SQLite.
    metadata = MetaData(naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_N_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    })


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("source", "style_code"), one_of("origin", ORIGINS))

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(32))  # how it got here: poizon_com | manual_sheet
    # where the name/description text comes from; dewu/poizon_com text is "official"
    # for the blocklist (复刻 = official retro). See config/blocklist.yaml.
    origin: Mapped[str] = mapped_column(String(16), default="other", server_default="other")
    source_url: Mapped[str | None] = mapped_column(String(1000))
    brand: Mapped[str] = mapped_column(String(100))
    model_name: Mapped[str] = mapped_column(String(300))
    style_code: Mapped[str] = mapped_column(String(64))  # SKU, required for originality checks
    category: Mapped[str] = mapped_column(String(32))    # key in categories.yaml
    gender: Mapped[str | None] = mapped_column(String(16))
    colorway: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)   # source text; content agent's only fact base
    seller_note: Mapped[str | None] = mapped_column(Text)   # note from source/intermediary sheet
    images: Mapped[list] = mapped_column(JSON, default=list)
    sold_count: Mapped[int | None]  # "Sold" at the source, for ranking
    # admin added it although it is below min_price ("➕ Baribir qoʻshish" / /allow)
    min_price_override: Mapped[bool] = mapped_column(default=False, server_default="0")
    first_seen_at: Mapped[datetime] = mapped_column(default=utcnow)
    last_checked_at: Mapped[datetime] = mapped_column(default=utcnow)
    is_active: Mapped[bool] = mapped_column(default=True)
    rejected_reason: Mapped[str | None] = mapped_column(Text)

    sizes: Mapped[list["ProductSize"]] = relationship(back_populates="product",
                                                      cascade="all, delete-orphan")

    @property
    def in_stock(self) -> bool:
        return any(s.stock_qty > 0 for s in self.sizes)


class ProductSize(Base):
    __tablename__ = "product_sizes"
    __table_args__ = (UniqueConstraint("product_id", "size_eu"),
                      one_of("source_currency", CURRENCIES),
                      CheckConstraint("source_price > 0", name="source_price_positive"),
                      CheckConstraint("stock_qty >= 0", name="stock_qty_nonneg"))

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    size_eu: Mapped[str] = mapped_column(String(16))  # "42.5", or "M" for apparel
    size_us: Mapped[str | None] = mapped_column(String(16))
    # Price as listed at the source. Converted to USD at quote time with the current rate.
    source_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    source_currency: Mapped[str] = mapped_column(String(3))
    # Our own stock in Tashkent (per size). stock_cost_uzs = what one unit really cost us
    # (auto from the order's landed cost, admin can correct with /stockcost).
    stock_qty: Mapped[int] = mapped_column(default=0, server_default="0")
    stock_cost_uzs: Mapped[int | None] = mapped_column(BigInteger)
    available: Mapped[bool] = mapped_column(default=True)
    checked_at: Mapped[datetime] = mapped_column(default=utcnow)

    product: Mapped[Product] = relationship(back_populates="sizes")


class DemandBrief(Base):
    __tablename__ = "demand_briefs"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    period: Mapped[str] = mapped_column(String(32))
    items: Mapped[list] = mapped_column(JSON, default=list)
    source_notes: Mapped[str | None] = mapped_column(Text)


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    size: Mapped[str] = mapped_column(String(16))
    landed_cost_usd: Mapped[Decimal] = mapped_column(USD)
    sell_price_uzs: Mapped[int] = mapped_column(BigInteger)
    usd_rate: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    valid_until: Mapped[datetime]
    breakdown: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), index=True)


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (one_of("status", POST_STATUSES),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    caption_uz: Mapped[str | None] = mapped_column(Text)
    body_uz: Mapped[str | None] = mapped_column(Text)        # LLM/admin-written part of the caption
    is_stock: Mapped[bool] = mapped_column(default=False, server_default="0")
    caption_ru: Mapped[str | None] = mapped_column(Text)
    image_paths: Mapped[list] = mapped_column(JSON, default=list)
    telegram_message_id: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    approved_by: Mapped[int | None] = mapped_column(BigInteger)  # admin telegram id
    approved_at: Mapped[datetime | None]
    published_at: Mapped[datetime | None]


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (one_of("status", LEAD_STATUSES),)

    id: Mapped[int] = mapped_column(primary_key=True)
    chatplace_contact_id: Mapped[str | None] = mapped_column(String(64))  # null for /lead
    channel: Mapped[str | None] = mapped_column(String(16))  # instagram | telegram
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"))
    size: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="new")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        one_of("prepayment_status", PREPAYMENT_STATUSES),
        one_of("buyout_status", BUYOUT_STATUSES),
        one_of("shipping_status", SHIPPING_STATUSES),
        CheckConstraint("external_parcels_usd >= 0", name="external_parcels_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"))
    quote_id: Mapped[int] = mapped_column(ForeignKey("quotes.id"))
    size: Mapped[str] = mapped_column(String(16))
    sell_price_uzs: Mapped[int] = mapped_column(BigInteger)

    # PII: used only for the order and the per-recipient customs limit. Never log raw.
    customer_name: Mapped[str] = mapped_column(String(200))
    customer_contact: Mapped[str] = mapped_column(String(64), index=True)  # normalized phone or @username

    # $200/month/recipient customs limit (CLAUDE.md §6.3)
    customs_value_usd: Mapped[Decimal] = mapped_column(USD)
    weight_kg: Mapped[Decimal] = mapped_column(KG)
    external_parcels_usd: Mapped[Decimal] = mapped_column(USD, default=0)  # customer's other parcels this month
    vacuum_packing: Mapped[bool | None]  # null = category default
    from_stock: Mapped[bool] = mapped_column(default=False, server_default="0")

    prepayment_status: Mapped[str] = mapped_column(String(32), default="awaiting_prepayment")
    admin_confirmed_at: Mapped[datetime | None]
    buyout_status: Mapped[str] = mapped_column(String(16), default="pending")
    shipping_status: Mapped[str] = mapped_column(String(32), default="pending")
    delivered_at: Mapped[datetime | None]
    cancelled_at: Mapped[datetime | None]
    # Real purchase price entered with /buyprice, and the landed cost it gives (for profit and reports)
    buy_price_cny: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    buy_cost_uzs: Mapped[int | None] = mapped_column(BigInteger)
    problem: Mapped[str | None] = mapped_column(Text)  # e.g. size issue
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (one_of("type", EXPENSE_TYPES), CheckConstraint("amount_uzs >= 0", name="amount_nonneg"))

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date]
    type: Mapped[str] = mapped_column(String(16))
    amount_uzs: Mapped[int] = mapped_column(BigInteger)
    note: Mapped[str | None] = mapped_column(Text)


class SettingsHistory(Base):
    __tablename__ = "settings_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    changed_at: Mapped[datetime] = mapped_column(default=utcnow)
    key: Mapped[str] = mapped_column(String(200))
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    changed_by: Mapped[int | None] = mapped_column(BigInteger)


class LlmCall(Base):
    """One row per LLM request: tokens + cost, for the daily budget and the AI expense rollup.
    Never stores prompt or response text."""
    __tablename__ = "llm_calls"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    purpose: Mapped[str] = mapped_column(String(32))     # e.g. content, demand
    model: Mapped[str] = mapped_column(String(64))       # model that served the request
    input_tokens: Mapped[int]
    output_tokens: Mapped[int]
    cache_write_tokens: Mapped[int] = mapped_column(default=0)
    cache_read_tokens: Mapped[int] = mapped_column(default=0)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    stop_reason: Mapped[str | None] = mapped_column(String(32))
    request_id: Mapped[str | None] = mapped_column(String(64))


class TrendNote(Base):
    """Admin observations from /trend; used to pick daily drafts and by the demand agent."""
    __tablename__ = "trend_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    text: Mapped[str] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(BigInteger)


class AppState(Base):
    """Small shared flags (e.g. paused) visible to both the bot and the scheduler."""
    __tablename__ = "app_state"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class Problem(Base):
    """Something that kept a post from going out (or another issue) for the daily summary."""
    __tablename__ = "problems"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    text: Mapped[str] = mapped_column(Text)


class PriceObservation(Base):
    """Lowest price of every accepted product at import time, for /prices (tuning min_price)."""
    __tablename__ = "price_observations"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    brand: Mapped[str] = mapped_column(String(100))
    model_name: Mapped[str] = mapped_column(String(300))
    style_code: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(32))
    min_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    source: Mapped[str] = mapped_column(String(32))
    override: Mapped[bool] = mapped_column(default=False)  # accepted below min_price by the admin
