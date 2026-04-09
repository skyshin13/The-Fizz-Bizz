"""add best_for to yeast_profiles

Revision ID: e5f6a7b8c9d0
Revises: c8f2a1b3d9e0
Create Date: 2026-04-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'c8f2a1b3d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = Inspector.from_engine(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, 'yeast_profiles', 'best_for'):
        op.add_column('yeast_profiles', sa.Column('best_for', sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, 'yeast_profiles', 'best_for'):
        op.drop_column('yeast_profiles', 'best_for')
