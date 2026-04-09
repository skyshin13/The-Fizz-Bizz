"""add lab_description and recommended_styles to yeast_profiles

Revision ID: f6g7h8i9j0k1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision: str = 'f6g7h8i9j0k1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = Inspector.from_engine(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, 'yeast_profiles', 'lab_description'):
        op.add_column('yeast_profiles', sa.Column('lab_description', sa.Text(), nullable=True))
    if not _column_exists(conn, 'yeast_profiles', 'recommended_styles'):
        op.add_column('yeast_profiles', sa.Column('recommended_styles', sa.JSON(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, 'yeast_profiles', 'recommended_styles'):
        op.drop_column('yeast_profiles', 'recommended_styles')
    if _column_exists(conn, 'yeast_profiles', 'lab_description'):
        op.drop_column('yeast_profiles', 'lab_description')
