"""add interval_seconds to project_cer_states

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-04-16

"""
from alembic import op
import sqlalchemy as sa

revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE project_cer_states
        ADD COLUMN IF NOT EXISTS interval_seconds INTEGER NOT NULL DEFAULT 30
    """)


def downgrade() -> None:
    op.drop_column('project_cer_states', 'interval_seconds')
