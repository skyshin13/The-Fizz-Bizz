from fastapi import APIRouter, Depends, HTTPException
from app.schemas.schemas import (
    ABVCalculationRequest, ABVCalculationResponse,
    PrimingSugarRequest, PrimingSugarResponse,
    CO2ActivityResponse,
    CERRequest, CERResponse, CERStrainOut,
)
from app.services.calculations import calculate_abv, calculate_priming_sugar, analyze_co2_activity
from app.services.cer_engine import STRAINS, simulate_cer
from app.api.deps import get_current_user
from app.models.models import User
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
