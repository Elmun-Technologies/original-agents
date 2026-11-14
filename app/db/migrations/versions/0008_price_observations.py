"""products.min_price_override, price_observations (/prices)

Revision ID: 0008
Revises: 0007
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0008'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('price_observations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('brand', sa.String(length=100), nullable=False),
    sa.Column('model_name', sa.String(length=300), nullable=False),
    sa.Column('style_code', sa.String(length=64), nullable=False),
    sa.Column('category', sa.String(length=32), nullable=False),
    sa.Column('min_price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('source', sa.String(length=32), nullable=False),
    sa.Column('override', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_price_observations'))
    )
    with op.batch_alter_table('price_observations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_price_observations_created_at'), ['created_at'], unique=False)
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('min_price_override', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('min_price_override')
    with op.batch_alter_table('price_observations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_price_observations_created_at'))
    op.drop_table('price_observations')
