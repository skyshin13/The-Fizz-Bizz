"""
Live CER Background Task
========================
Runs every 30 seconds. For each active alcohol fermentation project:

1. Loads (or creates) a persistent ProjectCERState row.
2. Advances the stateful simulation from last_tick_at → now via step_cer().
3. Backfills one MeasurementLog point per hour for any offline gap
   (covers server restarts and disconnections automatically).
4. Appends a live point at the current moment.
5. Saves updated simulation state.

CO₂ release events reduce psi_released so subsequent readings restart from 0
and grow again according to the model — creating a real new trajectory.
"""

import asyncio
import random
from datetime import datetime, timezone, timedelta

from app.db.database import SessionLocal
from app.models.models import (
    FermentationProject, MeasurementLog, ProjectCERState,
    ProjectStatus, ProjectYeastConnection,
)
from app.services.cer_engine import (
    STRAIN_MAP, CERState, initial_cer_state, step_cer,
)


# ── Constants ─────────────────────────────────────────────────────────────────

INTERVAL_SECONDS    = 5
CO2_TO_PSI          = 300.0     # converts Σ(cer·dt) → PSI
DEFAULT_STRAIN      = "US-05"
SUPPORTED_TYPES     = {"beer", "mead", "cider", "wine", "alcohol_brewing"}
BACKFILL_INTERVAL_H = 1.0       # one backfill point per hour for offline gaps
SIM_DT              = 0.5       # internal simulation step (hours)


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
    og    = project.initial_gravity or 1.050
    vol_l = project.batch_size_liters or 19.0
    return max(50.0, (og - 1.0) * 2500 * vol_l)


def _get_recent_co2_log_times(project_id: int, db, since: datetime) -> set:
    """Return co2_psi timestamps only from `since` onward — keeps the set small."""
    rows = (
        db.query(MeasurementLog.logged_at)
        .filter(
            MeasurementLog.project_id == project_id,
            MeasurementLog.co2_psi.isnot(None),
            MeasurementLog.logged_at >= since,
        )
        .all()
    )
    result = set()
    for (ts,) in rows:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        result.add(ts)
    return result


def _create_initial_state(project, db, now: datetime) -> ProjectCERState:
    """
    Bootstrap a ProjectCERState for a project that doesn't have one yet.

    Advances the simulation to the current elapsed time so X/S/ethanol
    reflect realistic fermentation progress.  Initialises psi_cumulative
    from the last stored measurement (if any) so the graph continues
    smoothly rather than jumping back to 0.
    """
    strain_id   = _resolve_strain(project, db)
    sugar_g     = _estimate_sugar_g(project)
    volume_ml   = (project.batch_size_liters or 19.0) * 1000.0
    temp_c      = project.fermentation_temp_celsius or 20.0

    start = project.start_date
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    elapsed_hours = max(0.0, (now - start).total_seconds() / 3600.0)

    # Advance sim to current elapsed time for realistic X, S state
    state = initial_cer_state(strain_id, sugar_g, volume_ml)
    psi   = 0.0
    t     = 0.0
    while t < elapsed_hours:
        dt    = min(SIM_DT, elapsed_hours - t)
        state, cer = step_cer(strain_id, state, temp_c, dt)
        psi  += cer * dt / CO2_TO_PSI
        t    += dt

    # Use existing last measurement as PSI baseline to avoid discontinuity
    last_meas = (
        db.query(MeasurementLog.co2_psi)
        .filter(
            MeasurementLog.project_id == project.id,
            MeasurementLog.co2_psi.isnot(None),
        )
        .order_by(MeasurementLog.logged_at.desc())
        .first()
    )
    psi_baseline = last_meas[0] if last_meas else psi

    row = ProjectCERState(
        project_id     = project.id,
        strain_id      = strain_id,
        sugar_g        = sugar_g,
        volume_ml      = volume_ml,
        temperature_c  = temp_c,
        X              = state.X,
        S              = state.S,
        ethanol_est    = state.ethanol_est,
        elapsed_t      = state.elapsed_t,
        phase          = state.phase,
        last_tick_at   = now,
        psi_cumulative = psi_baseline,
        psi_released   = 0.0,
    )
    db.add(row)
    db.flush()
    return row


# ── Core tick ─────────────────────────────────────────────────────────────────

def _tick():
    db  = SessionLocal()
    now = datetime.now(timezone.utc)
    try:
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
            if start > now:
                continue

            # Load or bootstrap persistent state
            state_row = (
                db.query(ProjectCERState)
                .filter_by(project_id=project.id)
                .first()
            )
            if state_row is None:
                state_row = _create_initial_state(project, db, now)

            last_tick = state_row.last_tick_at or now
            if last_tick.tzinfo is None:
                last_tick = last_tick.replace(tzinfo=timezone.utc)

            gap_hours = max(0.0, (now - last_tick).total_seconds() / 3600.0)

            # Reconstruct in-memory CERState from persisted values
            cer_state = CERState(
                X           = state_row.X,
                S           = state_row.S,
                ethanol_est = state_row.ethanol_est,
                elapsed_t   = state_row.elapsed_t,
                phase       = state_row.phase,
            )

            # Only look back far enough to cover the gap + a 10-min overlap buffer.
            # This keeps the duplicate-check set small regardless of total history length.
            lookback = max(gap_hours + (BACKFILL_INTERVAL_H * 2), 0.5)
            since_ts = last_tick - timedelta(hours=lookback)
            existing_times = _get_recent_co2_log_times(project.id, db, since_ts)

            # ── Advance simulation from last_tick → now ───────────────────────
            sim_elapsed   = 0.0
            last_backfill = 0.0
            noise = lambda: random.uniform(-0.02, 0.02)

            while sim_elapsed < gap_hours:
                dt = min(SIM_DT, gap_hours - sim_elapsed)
                cer_state, cer_val = step_cer(
                    state_row.strain_id, cer_state, state_row.temperature_c, dt
                )
                state_row.psi_cumulative += cer_val * dt / CO2_TO_PSI
                sim_elapsed += dt

                # Backfill: one stored point per BACKFILL_INTERVAL_H (offline gap)
                if gap_hours > 0.083 and (sim_elapsed - last_backfill) >= BACKFILL_INTERVAL_H:
                    candidate_ts = last_tick + timedelta(hours=sim_elapsed)
                    already = any(
                        abs((candidate_ts - t).total_seconds()) < 600
                        for t in existing_times
                    )
                    if not already:
                        display_psi = max(0.0, state_row.psi_cumulative - state_row.psi_released)
                        db.add(MeasurementLog(
                            project_id          = project.id,
                            logged_at           = candidate_ts,
                            co2_psi             = round(max(0.0, display_psi + noise()), 3),
                            temperature_celsius = state_row.temperature_c + random.uniform(-0.1, 0.1),
                        ))
                        existing_times.add(candidate_ts)
                    last_backfill = sim_elapsed

            # ── Live point at now ─────────────────────────────────────────────
            recent = any((now - t).total_seconds() < 4 for t in existing_times)
            if not recent:
                display_psi = max(0.0, state_row.psi_cumulative - state_row.psi_released)
                db.add(MeasurementLog(
                    project_id          = project.id,
                    logged_at           = now,
                    co2_psi             = round(display_psi + noise(), 3),
                    temperature_celsius = state_row.temperature_c + random.uniform(-0.1, 0.1),
                ))

            # ── Persist updated state ─────────────────────────────────────────
            state_row.X           = cer_state.X
            state_row.S           = cer_state.S
            state_row.ethanol_est = cer_state.ethanol_est
            state_row.elapsed_t   = cer_state.elapsed_t
            state_row.phase       = cer_state.phase
            state_row.last_tick_at = now

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
