"""
Live CER Background Task
========================
Every 30 seconds, samples the CER simulation at the current elapsed time
for each active fermentation project and appends a new MeasurementLog row.

On the first run for a project, backfills hourly data points from project
start up to now so the chart is immediately populated with a full curve.
"""

import asyncio
import random
from datetime import datetime, timezone, timedelta

from app.db.database import SessionLocal
from app.models.models import (
    FermentationProject, MeasurementLog, ProjectStatus,
    ProjectYeastConnection,
)
from app.services.cer_engine import simulate_cer, STRAIN_MAP


# ── Constants ─────────────────────────────────────────────────────────────────

INTERVAL_SECONDS = 30
CO2_TO_PSI = 300.0
DEFAULT_STRAIN = "US-05"
SUPPORTED_TYPES = {"beer", "mead", "cider", "wine", "alcohol_brewing"}

# Backfill one point per this many hours of elapsed time
BACKFILL_INTERVAL_HOURS = 1.0


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_strain(project, db) -> str:
    conn = db.query(ProjectYeastConnection).filter_by(project_id=project.id).first()
    if conn:
        from app.models.models import YeastProfile
        yeast = db.query(YeastProfile).filter_by(id=conn.yeast_id).first()
        if yeast and yeast.strain_code and yeast.strain_code in STRAIN_MAP:
            return yeast.strain_code
    return DEFAULT_STRAIN


def _estimate_sugar_g(project) -> float:
    og = project.initial_gravity or 1.050
    volume_l = project.batch_size_liters or 19.0
    sugar_g_per_l = (og - 1.0) * 2500
    return max(50.0, sugar_g_per_l * volume_l)


def _psi_at_hours(result_points, target_hours: float) -> float:
    """Compute cumulative CO2 PSI at a given elapsed-hours point."""
    cumulative = sum(p.cer * 0.5 for p in result_points if p.t <= target_hours)
    psi = cumulative / CO2_TO_PSI + random.uniform(-0.05, 0.05)
    return round(max(0.0, psi), 2)


def _get_co2_log_times(project_id: int, db) -> set[datetime]:
    """Return set of logged_at timestamps that have co2_psi values."""
    rows = (
        db.query(MeasurementLog.logged_at)
        .filter(
            MeasurementLog.project_id == project_id,
            MeasurementLog.co2_psi.isnot(None),
        )
        .all()
    )
    result = set()
    for (ts,) in rows:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        result.add(ts)
    return result


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
            if project.fermentation_type.value not in SUPPORTED_TYPES:
                continue

            start = project.start_date
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)

            elapsed_hours = (now - start).total_seconds() / 3600.0
            if elapsed_hours < 0:
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

            existing_times = _get_co2_log_times(project.id, db)

            # ── Backfill: one point per BACKFILL_INTERVAL_HOURS since start ──
            h = BACKFILL_INTERVAL_HOURS
            while h <= elapsed_hours:
                candidate_ts = start + timedelta(hours=h)
                # Check if we already have a reading within 10 minutes of this slot
                already_logged = any(
                    abs((candidate_ts - t).total_seconds()) < 600
                    for t in existing_times
                )
                if not already_logged:
                    psi = _psi_at_hours(result.points, h)
                    db.add(MeasurementLog(
                        project_id=project.id,
                        logged_at=candidate_ts,
                        co2_psi=psi,
                        temperature_celsius=temp_c + random.uniform(-0.1, 0.1),
                    ))
                    existing_times.add(candidate_ts)
                h += BACKFILL_INTERVAL_HOURS

            # ── Live point: current moment ──
            recent = any(
                (now - t).total_seconds() < 25
                for t in existing_times
            )
            if not recent:
                psi = _psi_at_hours(result.points, elapsed_hours)
                db.add(MeasurementLog(
                    project_id=project.id,
                    logged_at=now,
                    co2_psi=psi,
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
