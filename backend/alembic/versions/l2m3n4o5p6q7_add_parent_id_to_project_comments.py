"""add parent_id to project_comments for threaded replies

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-05-14

parent_id was defined in the ORM model but never migrated, causing
DELETE project queries to fail with 'column parent_id does not exist'
when SQLAlchemy's cascade tried to load the relationship.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = Inspector.from_engine(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, 'project_comments', 'parent_id'):
        op.add_column(
            'project_comments',
            sa.Column('parent_id', sa.Integer(),
                      sa.ForeignKey('project_comments.id'), nullable=True),
        )
        op.create_index('ix_pc_parent_id', 'project_comments', ['parent_id'])


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, 'project_comments', 'parent_id'):
        op.drop_index('ix_pc_parent_id', table_name='project_comments')
        op.drop_column('project_comments', 'parent_id')
