from fastapi import APIRouter, Depends
from app.schemas.schemas import (
    ABVCalculationRequest, ABVCalculationResponse,
    PrimingSugarRequest, PrimingSugarResponse,
    CO2ActivityResponse,
)
from app.services.calculations import calculate_abv, calculate_priming_sugar, analyze_co2_activity
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
