"""
Fermentation Math Engine
========================
ABV, CO2 activity analysis, and priming sugar calculations.
"""
from typing import List, Optional
from app.schemas.schemas import (
    ABVCalculationResponse, PrimingSugarRequest, PrimingSugarResponse, CO2ActivityResponse
)


def calculate_abv(original_gravity: float, final_gravity: float) -> ABVCalculationResponse:
    """
    Standard ABV formula: ABV = (OG - FG) × 131.25
    Alternate (more accurate for high-gravity): ABV = (76.08 * (OG - FG) / (1.775 - OG)) * (FG / 0.794)
    """
    simple_abv = (original_gravity - final_gravity) * 131.25

    # More accurate formula for higher gravity brews
    if original_gravity > 1.060:
        accurate_abv = (76.08 * (original_gravity - final_gravity) / (1.775 - original_gravity)) * (final_gravity / 0.794)
        abv = accurate_abv
    else:
        abv = simple_abv

    abv = max(0.0, round(abv, 2))

    # Apparent attenuation
    attenuation = round(((original_gravity - final_gravity) / (original_gravity - 1.0)) * 100, 1)

    # Rough calorie estimate per 12 oz
    calories = round((6.9 * abv + 4.0 * (0.1808 * original_gravity * 1000 + 0.8192 * final_gravity * 1000 - 1000)) * 3.55, 0)

    return ABVCalculationResponse(
        abv_percent=abv,
        attenuation_percent=max(0, attenuation),
        calories_per_12oz=max(0, calories),
    )


def calculate_priming_sugar(req: PrimingSugarRequest) -> PrimingSugarResponse:
    """
    Calculates priming sugar needed for bottle carbonation.
    Based on the dissolved CO2 already in solution at fermentation temp.
    """
    # CO2 already dissolved at fermentation temperature (Noonan formula)
    temp_f = req.fermentation_temp_celsius * 9 / 5 + 32
    dissolved_co2 = 3.0378 - (0.050062 * temp_f) + (0.00026555 * temp_f ** 2)
    co2_needed = req.target_co2_volumes - dissolved_co2

    # Sugar factors (grams of sugar per liter per CO2 volume)
    sugar_factors = {
        "table_sugar": 2.0,     # sucrose
        "corn_sugar": 2.1,      # dextrose (slightly less fermentable by weight)
        "honey": 2.6,           # ~78% fermentable sugars
        "DME": 2.7,             # dry malt extract
    }

    factor = sugar_factors.get(req.sugar_type, 2.0)
    sugar_grams = round(co2_needed * factor * req.batch_size_liters, 1)
    sugar_oz = round(sugar_grams / 28.35, 2)

    notes_map = {
        "table_sugar": "Dissolve in ~250ml boiling water before adding to fermenter.",
        "corn_sugar": "Corn sugar ferments cleanly. Dissolve in warm water first.",
        "honey": "Gently warm honey to make it easier to mix. May add subtle flavor.",
        "DME": "Creates very clean carbonation with slight malt contribution.",
    }

    return PrimingSugarResponse(
        sugar_grams=max(0, sugar_grams),
        sugar_oz=max(0, sugar_oz),
        sugar_type=req.sugar_type,
        notes=notes_map.get(req.sugar_type, ""),
    )


def analyze_co2_activity(
    co2_readings: List[float],
    timestamps_hours: List[float],
    fermentation_type: str = "general",
) -> CO2ActivityResponse:
    """
    Analyzes CO2 trend to detect fermentation stage.
    Uses linear regression on recent readings to compute slope.
    """
    if len(co2_readings) < 2:
        return CO2ActivityResponse(
            status="insufficient_data",
            message="Not enough data points to analyze CO2 activity.",
            slope=None,
            recommendation="Add more CO2 readings over time to enable trend analysis.",
        )

    # Linear regression on last 5 points
    n = min(5, len(co2_readings))
    recent_co2 = co2_readings[-n:]
    recent_t = timestamps_hours[-n:]

    mean_t = sum(recent_t) / n
    mean_co2 = sum(recent_co2) / n
    num = sum((t - mean_t) * (c - mean_co2) for t, c in zip(recent_t, recent_co2))
    den = sum((t - mean_t) ** 2 for t in recent_t)
    slope = num / den if den != 0 else 0.0

    latest = recent_co2[-1]

    # CO2 thresholds (psi) - adjust for fermentation type
    high_threshold = 12.0 if fermentation_type in ["kombucha", "probiotic_soda"] else 15.0
    bottle_ready = 8.0

    if latest > high_threshold:
        return CO2ActivityResponse(
            status="ready_to_burp",
            message=f"⚠️ CO2 pressure at {latest:.1f} PSI — time to burp your vessel!",
            slope=round(slope, 3),
            recommendation="Open lids briefly to release pressure. Check again in 12–24 hours.",
        )

    if slope > 0.3:
        return CO2ActivityResponse(
            status="active",
            message="Fermentation is actively producing CO2.",
            slope=round(slope, 3),
            recommendation="Let fermentation continue. Monitor pressure daily.",
        )
    elif slope < -0.1:
        return CO2ActivityResponse(
            status="stalling",
            message="CO2 production appears to be slowing down.",
            slope=round(slope, 3),
            recommendation="Check temperature, nutrient levels, and yeast health. Consider gentle agitation.",
        )
    elif abs(slope) <= 0.1 and latest >= bottle_ready:
        return CO2ActivityResponse(
            status="ready_to_bottle",
            message="Fermentation stable — good carbonation for bottling.",
            slope=round(slope, 3),
            recommendation="Take a final gravity reading. If stable for 48h, proceed to bottling.",
        )
    else:
        return CO2ActivityResponse(
            status="monitoring",
            message="Fermentation in progress — activity is moderate.",
            slope=round(slope, 3),
            recommendation="Continue monitoring. No action needed yet.",
        )
