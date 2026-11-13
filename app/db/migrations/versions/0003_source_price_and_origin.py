"""source price/currency on product_sizes (USD computed at quote time); product origin

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("product_sizes") as b:
        b.add_column(sa.Column("source_price", sa.Numeric(12, 2), nullable=True))
        b.add_column(sa.Column("source_currency", sa.String(3), nullable=True))
    # Existing rows only have the converted USD price; keep it as a USD source price.
    op.execute("UPDATE product_sizes SET source_price = price_usd, source_currency = 'USD'")
    with op.batch_alter_table("product_sizes") as b:
        b.alter_column("source_price", existing_type=sa.Numeric(12, 2), nullable=False)
        b.alter_column("source_currency", existing_type=sa.String(3), nullable=False)
        b.drop_column("price_usd")
        b.create_check_constraint(op.f("ck_product_sizes_source_currency"), "source_currency IN ('USD', 'CNY')")
        b.create_check_constraint(op.f("ck_product_sizes_source_price_positive"), "source_price > 0")

    with op.batch_alter_table("products") as b:
        b.add_column(sa.Column("origin", sa.String(16), nullable=False, server_default="other"))
        b.create_check_constraint(op.f("ck_products_origin"), "origin IN ('dewu', 'poizon_com', 'other')")


def downgrade() -> None:
    with op.batch_alter_table("products") as b:
        b.drop_constraint(op.f("ck_products_origin"), type_="check")
        b.drop_column("origin")
    with op.batch_alter_table("product_sizes") as b:
        b.add_column(sa.Column("price_usd", sa.Numeric(12, 2), nullable=True))
    # USD rows restore exactly; CNY rows cannot be converted without a rate and are dropped.
    op.execute("UPDATE product_sizes SET price_usd = source_price WHERE source_currency = 'USD'")
    op.execute("DELETE FROM product_sizes WHERE price_usd IS NULL")
    with op.batch_alter_table("product_sizes") as b:
        b.drop_constraint(op.f("ck_product_sizes_source_currency"), type_="check")
        b.drop_constraint(op.f("ck_product_sizes_source_price_positive"), type_="check")
        b.alter_column("price_usd", existing_type=sa.Numeric(12, 2), nullable=False)
        b.drop_column("source_currency")
        b.drop_column("source_price")
