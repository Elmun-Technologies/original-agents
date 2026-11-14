"""products.sold_count, problems (auto mode daily summary)

Revision ID: 0006
Revises: 0005
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0006'
down_revision: Union[str, Sequence[str], None] = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('problems',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_problems'))
    )
    with op.batch_alter_table('problems', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_problems_created_at'), ['created_at'], unique=False)
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sold_count', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('sold_count')
    with op.batch_alter_table('problems', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_problems_created_at'))
    op.drop_table('problems')
