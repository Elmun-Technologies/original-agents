"""orders.buy_price_cny, orders.buy_cost_uzs (/buyprice)

Revision ID: 0007
Revises: 0006
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0007'
down_revision: Union[str, Sequence[str], None] = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('buy_price_cny', sa.Numeric(precision=12, scale=2), nullable=True))
        batch_op.add_column(sa.Column('buy_cost_uzs', sa.BigInteger(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_column('buy_cost_uzs')
        batch_op.drop_column('buy_price_cny')
