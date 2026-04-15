from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.schemas import (
    ABVCalculationRequest, ABVCalculationResponse,
    PrimingSugarRequest, PrimingSugarResponse,
    CO2ActivityResponse,
    CERRequest, CERResponse, CERStrainOut,
    LiveCERPointOut, LiveCERStateOut, LiveCERResponse, CERParamsUpdate,
)
from app.services.calculations import calculate_abv, calculate_priming_sugar, analyze_co2_activity
from app.services.cer_engine import STRAINS, STRAIN_MAP, simulate_cer, CERState, step_cer
from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.models import User, MeasurementLog, ProjectCERState, FermentationProject
from typing import List

router = APIRouter(prefix="/calculations", tags=["Calculations"])


@router.post("/abv", response_model=ABVCalculationResponse)
def abv_calc(
    body: ABVCalculationRequest,
    current_user: User = Depends(get_current_user),
):
    return calculate_abv(body.original_gravity, body.final_gravity)


@router.post("/priming-sugar", response_model=PrimingSugarResponse)
def priming_sugar_calc(
    body: PrimingSugarRequest,
    current_user: User = Depends(get_current_user),
):
    return calculate_priming_sugar(body)


@router.post("/co2-activity", response_model=CO2ActivityResponse)
def co2_activity(
    co2_readings: List[float],
    timestamps_hours: List[float],
    fermentation_type: str = "general",
    current_user: User = Depends(get_current_user),
):
    return analyze_co2_activity(co2_readings, timestamps_hours, fermentation_type)


# ─── CER Simulation ─────────────────────────────────────────────────────────

@router.get("/cer-strains", response_model=List[CERStrainOut])
def list_cer_strains(current_user: User = Depends(get_current_user)):
    return [
        CERStrainOut(
            id=s.id,
            name=s.name,
            strain_type=s.strain_type,
            brand=s.brand,
            opt_temp_c=s.opt_temp_c,
            temp_min_c=s.temp_min_c,
            temp_max_c=s.temp_max_c,
            ethanol_tol=s.ethanol_tol,
            description=s.description,
        )
        for s in STRAINS
    ]


@router.post("/cer", response_model=CERResponse)
def run_cer_simulation(
    body: CERRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = simulate_cer(
            strain_id=body.strain_id,
            sugar_g=body.sugar_g,
            volume_ml=body.volume_ml,
            temperature_c=body.temperature_c,
            duration_hours=body.duration_hours,
            alert_threshold=body.alert_threshold,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


# ─── Live CER (stateful, persistent) ─────────────────────────────────────────

@router.get("/live-cer/{project_id}", response_model=LiveCERResponse)
def get_live_cer(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return all persisted CO₂ PSI measurements for a project plus the current
    simulation state.  The frontend polls this every 30 s to drive the live graph.
    """
    project = db.query(FermentationProject).filter_by(
        id=project_id, user_id=current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    measurements = (
        db.query(MeasurementLog)
        .filter(
            MeasurementLog.project_id == project_id,
            MeasurementLog.co2_psi.isnot(None),
        )
        .order_by(MeasurementLog.logged_at)
        .all()
    )

    start = project.start_date
    if start and start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    points: List[LiveCERPointOut] = []
    for m in measurements:
        ts = m.logged_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        hours = (ts - start).total_seconds() / 3600.0 if start else 0.0
        points.append(LiveCERPointOut(
            hours_elapsed=round(hours, 3),
            co2_psi=round(max(0.0, m.co2_psi), 3),
            timestamp=ts.isoformat(),
        ))

    state_row = db.query(ProjectCERState).filter_by(project_id=project_id).first()
    state_out = None
    if state_row:
        strain = STRAIN_MAP.get(state_row.strain_id) or STRAIN_MAP["US-05"]
        # Single tiny step to get instantaneous CER estimate
        probe_state = CERState(
            X=state_row.X, S=state_row.S, ethanol_est=state_row.ethanol_est,
            elapsed_t=state_row.elapsed_t, phase=state_row.phase,
        )
        _, cer_est = step_cer(state_row.strain_id, probe_state, state_row.temperature_c, dt=0.01)
        state_out = LiveCERStateOut(
            current_psi=round(max(0.0, state_row.psi_cumulative - state_row.psi_released), 3),
            current_phase=state_row.phase,
            current_cer_estimate=round(cer_est, 2),
            elapsed_hours=round(state_row.elapsed_t, 2),
            strain_id=state_row.strain_id,
            strain_name=strain.name,
            sugar_g=state_row.sugar_g,
            volume_ml=state_row.volume_ml,
            temperature_c=state_row.temperature_c,
            X=round(state_row.X, 4),
            S=round(state_row.S, 4),
        )

    return LiveCERResponse(
        points=points,
        state=state_out,
        start_date=start.isoformat() if start else None,
    )


@router.post("/co2-release/{project_id}")
def release_co2(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Record a CO₂ release (burp/vent) event.
    Increments psi_released so display PSI drops to 0 immediately.
    The simulation then continues from 0, creating a real new trajectory.
    """
    project = db.query(FermentationProject).filter_by(
        id=project_id, user_id=current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    state_row = db.query(ProjectCERState).filter_by(project_id=project_id).first()
    if not state_row:
        raise HTTPException(status_code=404, detail="Simulation state not initialised yet")

    current_display_psi = max(0.0, state_row.psi_cumulative - state_row.psi_released)
    state_row.psi_released += current_display_psi   # display = psi_cumulative - psi_released → 0

    now = datetime.now(timezone.utc)
    db.add(MeasurementLog(
        project_id=project_id,
        logged_at=now,
        co2_psi=0.0,
        notes="CO₂ released",
    ))
    db.commit()
    return {"released_psi": round(current_display_psi, 3), "status": "ok"}


@router.patch("/cer-params/{project_id}")
def update_cer_params(
    project_id: int,
    body: CERParamsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the simulation parameters (strain, sugar, volume, temp) without
    resetting the current biological state (X, S, ethanol).
    Future ticks will use the new params from the current fermentation state.
    """
    project = db.query(FermentationProject).filter_by(
        id=project_id, user_id=current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    state_row = db.query(ProjectCERState).filter_by(project_id=project_id).first()
    if not state_row:
        raise HTTPException(status_code=404, detail="Simulation state not initialised yet")

    if body.strain_id is not None:
        if body.strain_id not in STRAIN_MAP:
            raise HTTPException(status_code=400, detail=f"Unknown strain: {body.strain_id}")
        state_row.strain_id = body.strain_id
    if body.sugar_g is not None:
        state_row.sugar_g = body.sugar_g
    if body.volume_ml is not None:
        state_row.volume_ml = body.volume_ml
    if body.temperature_c is not None:
        state_row.temperature_c = body.temperature_c

    db.commit()
    return {"status": "ok"}
