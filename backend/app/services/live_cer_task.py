"""
Live CER Background Task
========================
Every 30 seconds, samples the CER simulation at the current elapsed time
for each active fermentation project and appends a new MeasurementLog row.

This makes the CO2 chart on the Project Detail page grow in real time
without any physical sensor — useful for demos.

CO2 PSI is approximated from cumulative CO2 (mg/L) via a scale factor.
"""

import asyncio
import random
from datetime import datetime, timezone

from app.db.database import SessionLocal
from app.models.models import (
    FermentationProject, MeasurementLog, ProjectStatus,
    ProjectYeastConnection,
)
from app.services.cer_engine import simulate_cer, STRAIN_MAP


# ── Constants ─────────────────────────────────────────────────────────────────

INTERVAL_SECONDS = 30

# mg/L cumulative CO2 → PSI conversion factor (empirical, demo-quality)
CO2_TO_PSI = 300.0

# Default CER strain when project has no matching strain
DEFAULT_STRAIN = "US-05"

# Fermentation types that should get live CER data
SUPPORTED_TYPES = {"beer", "mead", "cider", "wine", "alcohol_brewing"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_strain(project, db) -> str:
    """Find the best CER strain ID for a project."""
    conn = db.query(ProjectYeastConnection).filter_by(project_id=project.id).first()
    if conn:
        from app.models.models import YeastProfile
        yeast = db.query(YeastProfile).filter_by(id=conn.yeast_id).first()
        if yeast and yeast.strain_code and yeast.strain_code in STRAIN_MAP:
            return yeast.strain_code
    return DEFAULT_STRAIN


def _estimate_sugar_g(project) -> float:
    """Estimate initial sugar mass from OG and batch size."""
    og = project.initial_gravity or 1.050
    volume_l = project.batch_size_liters or 19.0
    # Rough approximation: extract g/L ≈ (OG - 1) * 2500
    sugar_g_per_l = (og - 1.0) * 2500
    return max(50.0, sugar_g_per_l * volume_l)


def _get_latest_co2(project_id: int, db) -> tuple[float, datetime | None]:
    """Return (latest co2_psi, logged_at) or (0.0, None) if no readings."""
    latest = (
        db.query(MeasurementLog)
        .filter(
            MeasurementLog.project_id == project_id,
            MeasurementLog.co2_psi.isnot(None),
        )
        .order_by(MeasurementLog.logged_at.desc())
        .first()
    )
    if latest:
        return latest.co2_psi, latest.logged_at
    return 0.0, None


# ── Core tick ─────────────────────────────────────────────────────────────────

def _tick():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        projects = (
            db.query(FermentationProject)
            .filter(
                FermentationProject.status == ProjectStatus.ACTIVE,
                FermentationProject.start_date.isnot(None),
            )
            .all()
        )

        for project in projects:
            # Only supported fermentation types
            if project.fermentation_type.value not in SUPPORTED_TYPES:
                continue

            start = project.start_date
            # Make start timezone-aware if needed
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)

            elapsed_hours = (now - start).total_seconds() / 3600.0
            if elapsed_hours < 0:
                continue

            # Skip if we logged in the last 25 seconds (avoid duplicates on restart)
            _, last_logged_at = _get_latest_co2(project.id, db)
            if last_logged_at:
                if last_logged_at.tzinfo is None:
                    last_logged_at = last_logged_at.replace(tzinfo=timezone.utc)
                seconds_since_last = (now - last_logged_at).total_seconds()
                if seconds_since_last < 25:
                    continue

            strain_id = _resolve_strain(project, db)
            sugar_g = _estimate_sugar_g(project)
            volume_ml = (project.batch_size_liters or 19.0) * 1000
            temp_c = project.fermentation_temp_celsius or 20.0

            try:
                result = simulate_cer(
                    strain_id=strain_id,
                    sugar_g=sugar_g,
                    volume_ml=volume_ml,
                    temperature_c=temp_c,
                    duration_hours=max(elapsed_hours + 1, 2.0),
                    dt=0.5,
                )
            except Exception:
                continue

            # Find the CER point closest to current elapsed time
            closest = min(result.points, key=lambda p: abs(p.t - elapsed_hours))

            # Cumulative CO2 up to this point
            cumulative_co2 = sum(
                p.cer * 0.5  # cer * dt
                for p in result.points
                if p.t <= elapsed_hours
            )

            # Convert to PSI with small random noise for realism
            co2_psi = round(
                cumulative_co2 / CO2_TO_PSI + random.uniform(-0.05, 0.05),
                2,
            )
            co2_psi = max(0.0, co2_psi)

            db.add(MeasurementLog(
                project_id=project.id,
                logged_at=now,
                co2_psi=co2_psi,
                temperature_celsius=temp_c + random.uniform(-0.1, 0.1),
            ))

        db.commit()

    except Exception as e:
        db.rollback()
        print(f"[live_cer_task] error: {e}")
    finally:
        db.close()


# ── Async loop ────────────────────────────────────────────────────────────────

async def live_cer_loop():
    """Run _tick() every INTERVAL_SECONDS. Started on FastAPI startup."""
    while True:
        await asyncio.sleep(INTERVAL_SECONDS)
        _tick()
