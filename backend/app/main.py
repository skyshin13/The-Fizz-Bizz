import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.db.database import Base, engine
from app.api.routes import auth, users, projects, yeasts, recipes, calculations, lookup, explore, friends, reminders
from app.services.live_cer_task import live_cer_loop
from app.services.reminder_task import reminder_loop
from app.services.yeast_matcher import sync_all_yeast_links
from app.db.database import SessionLocal

logger = logging.getLogger(__name__)


def _run_migrations():
    """Apply any schema changes that create_all won't handle (new columns / indexes on existing tables)."""
    with engine.connect() as conn:
        for stmt in [
            # Columns
            "ALTER TABLE project_cer_states ADD COLUMN interval_seconds INTEGER NOT NULL DEFAULT 30",
            "ALTER TABLE fermentation_projects ADD COLUMN sugar_amount_grams REAL",
            "ALTER TABLE reminders ADD COLUMN preferred_hour INTEGER",
            "ALTER TABLE reminders ADD COLUMN preferred_minute INTEGER",
            "ALTER TABLE fermentation_projects ADD COLUMN visibility TEXT DEFAULT 'private'",
            "ALTER TABLE users ADD COLUMN show_activity_to_friends BOOLEAN DEFAULT FALSE",
            "ALTER TABLE project_comments ADD COLUMN parent_id INTEGER REFERENCES project_comments(id)",
            "ALTER TABLE recipe_ingredients ADD COLUMN yeast_profile_id INTEGER REFERENCES yeast_profiles(id)",
            # Indexes — fermentation_projects
            "CREATE INDEX IF NOT EXISTS ix_fp_user_id ON fermentation_projects (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_fp_is_public ON fermentation_projects (is_public)",
            "CREATE INDEX IF NOT EXISTS ix_fp_visibility ON fermentation_projects (visibility)",
            "CREATE INDEX IF NOT EXISTS ix_fp_created_at ON fermentation_projects (created_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_fp_fermentation_type ON fermentation_projects (fermentation_type)",
            "CREATE INDEX IF NOT EXISTS ix_fp_status ON fermentation_projects (status)",
            # Composite for the main explore filter
            "CREATE INDEX IF NOT EXISTS ix_fp_public_vis ON fermentation_projects (is_public, visibility)",
            # Indexes — friendships
            "CREATE INDEX IF NOT EXISTS ix_fs_requester ON friendships (requester_id, status)",
            "CREATE INDEX IF NOT EXISTS ix_fs_receiver ON friendships (receiver_id, status)",
            # Indexes — user_follows
            "CREATE INDEX IF NOT EXISTS ix_uf_follower ON user_follows (follower_id)",
            "CREATE INDEX IF NOT EXISTS ix_uf_followed ON user_follows (followed_id)",
            # Indexes — project_likes
            "CREATE INDEX IF NOT EXISTS ix_pl_project ON project_likes (project_id)",
            "CREATE INDEX IF NOT EXISTS ix_pl_user ON project_likes (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_pl_project_user ON project_likes (project_id, user_id)",
            # Indexes — project_comments
            "CREATE INDEX IF NOT EXISTS ix_pc_project ON project_comments (project_id)",
            # Indexes — measurement_logs
            "CREATE INDEX IF NOT EXISTS ix_ml_project ON measurement_logs (project_id)",
            "CREATE INDEX IF NOT EXISTS ix_ml_logged_at ON measurement_logs (logged_at)",
            # Indexes — observation_notes
            "CREATE INDEX IF NOT EXISTS ix_on_project ON observation_notes (project_id)",
        ]:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass
        # Back-fill visibility from is_public for existing rows
        try:
            conn.execute(text(
                "UPDATE fermentation_projects SET visibility = 'everyone'"
                " WHERE is_public = TRUE AND (visibility IS NULL OR visibility = 'private')"
            ))
        except Exception:
            pass
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        _run_migrations()
    except Exception as e:
        logger.error(f"Startup DB error: {e}")
    try:
        db = SessionLocal()
        try:
            matched = sync_all_yeast_links(db)
            if matched:
                logger.info(f"Startup yeast link sync: linked {matched} ingredient(s) to yeast profiles")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Startup yeast link sync error: {e}")

    task = asyncio.create_task(live_cer_loop())
    rtask = asyncio.create_task(reminder_loop())
    yield
    task.cancel()
    rtask.cancel()


app = FastAPI(
    title="Fizz Bizz API",
    description="Fermentation Management Platform — track kombucha, beer, kimchi & more.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(yeasts.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(calculations.router, prefix="/api")
app.include_router(lookup.router, prefix="/api")
app.include_router(explore.router, prefix="/api")
app.include_router(friends.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "🫧 Fizz Bizz API is running!", "docs": "/api/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
