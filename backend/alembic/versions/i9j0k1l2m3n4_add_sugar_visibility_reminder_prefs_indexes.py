"""add sugar_amount_grams, visibility, reminder preferred time, and indexes

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-05-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = Inspector.from_engine(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()

    # --- New columns ---
    if not _column_exists(conn, 'fermentation_projects', 'sugar_amount_grams'):
        op.add_column('fermentation_projects', sa.Column('sugar_amount_grams', sa.Float(), nullable=True))

    if not _column_exists(conn, 'fermentation_projects', 'visibility'):
        op.add_column('fermentation_projects', sa.Column('visibility', sa.String(), nullable=True, server_default='private'))

    if not _column_exists(conn, 'reminders', 'preferred_hour'):
        op.add_column('reminders', sa.Column('preferred_hour', sa.Integer(), nullable=True))

    if not _column_exists(conn, 'reminders', 'preferred_minute'):
        op.add_column('reminders', sa.Column('preferred_minute', sa.Integer(), nullable=True))

    # --- Back-fill visibility from is_public for existing rows ---
    conn.execute(sa.text(
        "UPDATE fermentation_projects SET visibility = 'everyone'"
        " WHERE is_public = TRUE AND (visibility IS NULL OR visibility = 'private')"
    ))

    # --- Indexes on fermentation_projects ---
    op.execute("CREATE INDEX IF NOT EXISTS ix_fp_user_id ON fermentation_projects (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fp_is_public ON fermentation_projects (is_public)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fp_visibility ON fermentation_projects (visibility)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fp_created_at ON fermentation_projects (created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fp_fermentation_type ON fermentation_projects (fermentation_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fp_status ON fermentation_projects (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fp_public_vis ON fermentation_projects (is_public, visibility)")

    # --- Indexes on friendships ---
    op.execute("CREATE INDEX IF NOT EXISTS ix_fs_requester ON friendships (requester_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fs_receiver ON friendships (receiver_id, status)")

    # --- Indexes on user_follows ---
    op.execute("CREATE INDEX IF NOT EXISTS ix_uf_follower ON user_follows (follower_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_uf_followed ON user_follows (followed_id)")

    # --- Indexes on project_likes ---
    op.execute("CREATE INDEX IF NOT EXISTS ix_pl_project ON project_likes (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pl_user ON project_likes (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pl_project_user ON project_likes (project_id, user_id)")

    # --- Indexes on project_comments ---
    op.execute("CREATE INDEX IF NOT EXISTS ix_pc_project ON project_comments (project_id)")

    # --- Indexes on measurement_logs ---
    op.execute("CREATE INDEX IF NOT EXISTS ix_ml_project ON measurement_logs (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ml_logged_at ON measurement_logs (logged_at)")

    # --- Indexes on observation_notes ---
    op.execute("CREATE INDEX IF NOT EXISTS ix_on_project ON observation_notes (project_id)")


def downgrade() -> None:
    conn = op.get_bind()

    op.execute("DROP INDEX IF EXISTS ix_on_project")
    op.execute("DROP INDEX IF EXISTS ix_ml_logged_at")
    op.execute("DROP INDEX IF EXISTS ix_ml_project")
    op.execute("DROP INDEX IF EXISTS ix_pc_project")
    op.execute("DROP INDEX IF EXISTS ix_pl_project_user")
    op.execute("DROP INDEX IF EXISTS ix_pl_user")
    op.execute("DROP INDEX IF EXISTS ix_pl_project")
    op.execute("DROP INDEX IF EXISTS ix_uf_followed")
    op.execute("DROP INDEX IF EXISTS ix_uf_follower")
    op.execute("DROP INDEX IF EXISTS ix_fs_receiver")
    op.execute("DROP INDEX IF EXISTS ix_fs_requester")
    op.execute("DROP INDEX IF EXISTS ix_fp_public_vis")
    op.execute("DROP INDEX IF EXISTS ix_fp_status")
    op.execute("DROP INDEX IF EXISTS ix_fp_fermentation_type")
    op.execute("DROP INDEX IF EXISTS ix_fp_created_at")
    op.execute("DROP INDEX IF EXISTS ix_fp_visibility")
    op.execute("DROP INDEX IF EXISTS ix_fp_is_public")
    op.execute("DROP INDEX IF EXISTS ix_fp_user_id")

    if _column_exists(conn, 'reminders', 'preferred_minute'):
        op.drop_column('reminders', 'preferred_minute')
    if _column_exists(conn, 'reminders', 'preferred_hour'):
        op.drop_column('reminders', 'preferred_hour')
    if _column_exists(conn, 'fermentation_projects', 'visibility'):
        op.drop_column('fermentation_projects', 'visibility')
    if _column_exists(conn, 'fermentation_projects', 'sugar_amount_grams'):
        op.drop_column('fermentation_projects', 'sugar_amount_grams')
