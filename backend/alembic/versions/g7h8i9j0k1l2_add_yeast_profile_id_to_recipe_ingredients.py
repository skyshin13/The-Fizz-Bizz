"""add yeast_profile_id to recipe_ingredients

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-04-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, Sequence[str], None] = 'f6g7h8i9j0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('recipe_ingredients',
        sa.Column('yeast_profile_id', sa.Integer(), sa.ForeignKey('yeast_profiles.id'), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('recipe_ingredients', 'yeast_profile_id')
