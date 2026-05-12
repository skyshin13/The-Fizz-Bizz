"""add email_notifications_enabled to users and email_enabled to reminders

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-05-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision = 'j0k1l2m3n4o5'
down_revision = 'i9j0k1l2m3n4'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = Inspector.from_engine(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()

    if not _column_exists(conn, 'users', 'email_notifications_enabled'):
        op.add_column('users', sa.Column('email_notifications_enabled', sa.Boolean(), nullable=True, server_default='false'))

    if not _column_exists(conn, 'reminders', 'email_enabled'):
        op.add_column('reminders', sa.Column('email_enabled', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    conn = op.get_bind()

    if _column_exists(conn, 'reminders', 'email_enabled'):
        op.drop_column('reminders', 'email_enabled')

    if _column_exists(conn, 'users', 'email_notifications_enabled'):
        op.drop_column('users', 'email_notifications_enabled')
