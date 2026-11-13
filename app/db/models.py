"""DB schema (CLAUDE.md §5). Written for Postgres; SQLite works for dev/tests.
All datetimes are stored in UTC."""
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (JSON, BigInteger, CheckConstraint, DateTime, ForeignKey, MetaData, Numeric,
                        String, Text, UniqueConstraint)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


class Base(DeclarativeBase):
    type_annotation_map = {datetime: DateTime(timezone=True)}  # timestamptz on Postgres
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
    __table_args__ = (UniqueConstraint("source", "style_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(32))  # poizon_com | manual_sheet
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
    first_seen_at: Mapped[datetime] = mapped_column(default=utcnow)
    last_checked_at: Mapped[datetime] = mapped_column(default=utcnow)
    is_active: Mapped[bool] = mapped_column(default=True)
    rejected_reason: Mapped[str | None] = mapped_column(Text)

    sizes: Mapped[list["ProductSize"]] = relationship(back_populates="product",
                                                      cascade="all, delete-orphan")


class ProductSize(Base):
    __tablename__ = "product_sizes"
    __table_args__ = (UniqueConstraint("product_id", "size_eu"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    size_eu: Mapped[str] = mapped_column(String(16))  # "42.5", or "M" for apparel
    size_us: Mapped[str | None] = mapped_column(String(16))
    price_usd: Mapped[Decimal] = mapped_column(USD)
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


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (one_of("status", POST_STATUSES),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    caption_uz: Mapped[str | None] = mapped_column(Text)
    caption_ru: Mapped[str | None] = mapped_column(Text)
    image_paths: Mapped[list] = mapped_column(JSON, default=list)
    telegram_message_id: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    approved_by: Mapped[int | None] = mapped_column(BigInteger)  # admin telegram id


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

    prepayment_status: Mapped[str] = mapped_column(String(32), default="awaiting_prepayment")
    admin_confirmed_at: Mapped[datetime | None]
    buyout_status: Mapped[str] = mapped_column(String(16), default="pending")
    shipping_status: Mapped[str] = mapped_column(String(32), default="pending")
    delivered_at: Mapped[datetime | None]
    cancelled_at: Mapped[datetime | None]
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
