"""add X_bact column to project_cer_states for kombucha AAB simulation

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-05-14

X_bact stores the Acetic Acid Bacteria (AAB) biomass g/L between live-tick
iterations for kombucha projects.  For beer/wine/mead/cider projects the
column is present but ignored (defaults to 0.03).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision = 'k1l2m3n4o5p6'
down_revision = 'j0k1l2m3n4o5'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = Inspector.from_engine(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, 'project_cer_states', 'X_bact'):
        op.add_column(
            'project_cer_states',
            sa.Column('X_bact', sa.Float(), nullable=True, server_default='0.03'),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, 'project_cer_states', 'X_bact'):
        op.drop_column('project_cer_states', 'X_bact')
