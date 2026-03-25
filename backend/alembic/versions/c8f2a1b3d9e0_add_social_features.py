"""add social features

Revision ID: c8f2a1b3d9e0
Revises: b074d7a27348
Create Date: 2026-03-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision: str = 'c8f2a1b3d9e0'
down_revision: Union[str, Sequence[str], None] = 'b074d7a27348'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = Inspector.from_engine(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def _table_exists(conn, table: str) -> bool:
    inspector = Inspector.from_engine(conn)
    return table in inspector.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()

    # Add is_public to fermentation_projects if not present
    if not _column_exists(conn, 'fermentation_projects', 'is_public'):
        op.add_column('fermentation_projects', sa.Column('is_public', sa.Boolean(), nullable=True, server_default='false'))

    # Create friendships table if not present
    if not _table_exists(conn, 'friendships'):
        op.create_table(
            'friendships',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('requester_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('receiver_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='pending'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_friendships_id', 'friendships', ['id'])


def downgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, 'friendships'):
        op.drop_index('ix_friendships_id', table_name='friendships')
        op.drop_table('friendships')
    if _column_exists(conn, 'fermentation_projects', 'is_public'):
        op.drop_column('fermentation_projects', 'is_public')
