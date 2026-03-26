"""
CO₂ Evolution Rate (CER) simulation engine.

CER(t) = μ(t) × X(t) × 0.49 × 1000  [mg CO₂ / L / h]

Growth phases:
  Lag        (0 ≤ t < tLag)  : X = X0, μ = 0
  Exponential (tLag ≤ t < tExp): X grows, μ = muEff
  Stationary  (tExp ≤ t < tStat): X = Xmax, μ = 0
  Decline     (t ≥ tStat)    : X decays, μ = 0
"""

import math
from typing import List, Optional
from dataclasses import dataclass, field


@dataclass
class YeastStrain:
    id: str
    name: str
    strain_type: str          # ale, lager, wheat, wine, champagne, saison, wild
    brand: str
    mu_max: float             # h⁻¹  max specific growth rate
    X0: float                 # g/L  initial biomass
    X_max: float              # g/L  max biomass
    t_lag: float              # h    end of lag phase
    t_exp: float              # h    end of exponential phase (approx)
    t_stat: float             # h    end of stationary phase
    k_d: float                # h⁻¹  decline rate
    ethanol_tol: float        # % ABV at which growth is inhibited
    opt_temp_c: float         # °C   optimal temperature
    temp_min_c: float         # °C
    temp_max_c: float         # °C
    description: str = ""


# ─── 30-strain library ───────────────────────────────────────────────────────

STRAINS: List[YeastStrain] = [

    # ── Ale yeasts ──────────────────────────────────────────────────────────
    YeastStrain("US-05",      "Safale US-05",            "ale",      "Fermentis",
                mu_max=0.38, X0=0.05, X_max=4.5, t_lag=4,  t_exp=30, t_stat=60,  k_d=0.008, ethanol_tol=11.0, opt_temp_c=19, temp_min_c=15, temp_max_c=24,
                description="Clean American ale yeast, very neutral profile"),

    YeastStrain("S-04",       "Safale S-04",             "ale",      "Fermentis",
                mu_max=0.42, X0=0.05, X_max=5.0, t_lag=3,  t_exp=26, t_stat=55,  k_d=0.009, ethanol_tol=10.5, opt_temp_c=20, temp_min_c=15, temp_max_c=24,
                description="English ale yeast, fruity esters"),

    YeastStrain("WY1056",     "American Ale (Wyeast 1056)", "ale",   "Wyeast",
                mu_max=0.40, X0=0.05, X_max=4.8, t_lag=4,  t_exp=28, t_stat=58,  k_d=0.008, ethanol_tol=11.0, opt_temp_c=20, temp_min_c=16, temp_max_c=24,
                description="Versatile clean American ale"),

    YeastStrain("WLP001",     "California Ale (WLP001)",  "ale",     "White Labs",
                mu_max=0.39, X0=0.05, X_max=4.7, t_lag=4,  t_exp=29, t_stat=58,  k_d=0.008, ethanol_tol=11.0, opt_temp_c=20, temp_min_c=16, temp_max_c=24,
                description="Industry standard West Coast ale"),

    YeastStrain("WY1968",     "London ESB (Wyeast 1968)", "ale",     "Wyeast",
                mu_max=0.45, X0=0.06, X_max=5.5, t_lag=3,  t_exp=22, t_stat=50,  k_d=0.010, ethanol_tol=10.0, opt_temp_c=20, temp_min_c=17, temp_max_c=22,
                description="Highly flocculent English ale"),

    YeastStrain("BE-134",     "Safbrew BE-134",           "ale",     "Fermentis",
                mu_max=0.36, X0=0.04, X_max=4.2, t_lag=5,  t_exp=32, t_stat=65,  k_d=0.007, ethanol_tol=12.0, opt_temp_c=22, temp_min_c=17, temp_max_c=29,
                description="Abbey-style Belgian ale yeast"),

    YeastStrain("WLP028",     "Edinburgh Ale (WLP028)",   "ale",     "White Labs",
                mu_max=0.37, X0=0.05, X_max=4.3, t_lag=4,  t_exp=30, t_stat=62,  k_d=0.007, ethanol_tol=10.5, opt_temp_c=19, temp_min_c=15, temp_max_c=22,
                description="Malty Scottish ale character"),

    YeastStrain("WY1272",     "American Ale II (WY1272)", "ale",     "Wyeast",
                mu_max=0.41, X0=0.05, X_max=4.9, t_lag=4,  t_exp=27, t_stat=56,  k_d=0.008, ethanol_tol=11.0, opt_temp_c=21, temp_min_c=16, temp_max_c=23,
                description="Slightly nutty, clean American ale"),

    # ── Lager yeasts ────────────────────────────────────────────────────────
    YeastStrain("W-34/70",    "Saflager W-34/70",         "lager",   "Fermentis",
                mu_max=0.28, X0=0.04, X_max=4.0, t_lag=8,  t_exp=48, t_stat=90,  k_d=0.005, ethanol_tol=9.5,  opt_temp_c=12, temp_min_c=8,  temp_max_c=16,
                description="Classic Weihenstephan lager yeast"),

    YeastStrain("S-23",       "Saflager S-23",            "lager",   "Fermentis",
                mu_max=0.26, X0=0.04, X_max=3.8, t_lag=9,  t_exp=52, t_stat=96,  k_d=0.005, ethanol_tol=9.0,  opt_temp_c=13, temp_min_c=8,  temp_max_c=16,
                description="Fruity German lager character"),

    YeastStrain("WY2124",     "Bohemian Lager (WY2124)",  "lager",   "Wyeast",
                mu_max=0.27, X0=0.04, X_max=4.1, t_lag=8,  t_exp=50, t_stat=92,  k_d=0.005, ethanol_tol=9.5,  opt_temp_c=12, temp_min_c=7,  temp_max_c=15,
                description="Classic Pilsner Urquell character"),

    YeastStrain("WLP830",     "German Lager (WLP830)",    "lager",   "White Labs",
                mu_max=0.27, X0=0.04, X_max=4.0, t_lag=8,  t_exp=50, t_stat=94,  k_d=0.005, ethanol_tol=9.5,  opt_temp_c=12, temp_min_c=7,  temp_max_c=15,
                description="Clean, malty German lager"),

    # ── Wheat yeasts ────────────────────────────────────────────────────────
    YeastStrain("WB-06",      "Safbrew WB-06",            "wheat",   "Fermentis",
                mu_max=0.44, X0=0.05, X_max=4.8, t_lag=3,  t_exp=24, t_stat=52,  k_d=0.009, ethanol_tol=10.0, opt_temp_c=21, temp_min_c=17, temp_max_c=26,
                description="Bavarian weizen with classic banana/clove"),

    YeastStrain("WY3068",     "Weihenstephan Weizen (WY3068)", "wheat", "Wyeast",
                mu_max=0.43, X0=0.05, X_max=4.7, t_lag=3,  t_exp=25, t_stat=53,  k_d=0.009, ethanol_tol=10.0, opt_temp_c=20, temp_min_c=17, temp_max_c=24,
                description="Authentic Hefeweizen character"),

    YeastStrain("WLP300",     "Hefeweizen Ale (WLP300)",  "wheat",   "White Labs",
                mu_max=0.43, X0=0.05, X_max=4.8, t_lag=3,  t_exp=25, t_stat=54,  k_d=0.009, ethanol_tol=10.0, opt_temp_c=20, temp_min_c=17, temp_max_c=24,
                description="Unfiltered wheat beer classic"),

    YeastStrain("WY3638",     "Bavarian Wheat (WY3638)",  "wheat",   "Wyeast",
                mu_max=0.41, X0=0.05, X_max=4.6, t_lag=4,  t_exp=28, t_stat=56,  k_d=0.008, ethanol_tol=10.0, opt_temp_c=21, temp_min_c=17, temp_max_c=26,
                description="High banana ester Bavarian wheat"),

    # ── Wine yeasts ─────────────────────────────────────────────────────────
    YeastStrain("EC-1118",    "Champagne (EC-1118)",      "champagne", "Lalvin",
                mu_max=0.46, X0=0.03, X_max=5.5, t_lag=3,  t_exp=28, t_stat=60,  k_d=0.006, ethanol_tol=18.0, opt_temp_c=18, temp_min_c=10, temp_max_c=30,
                description="Very high alcohol tolerance, neutral profile"),

    YeastStrain("K1-V1116",   "Montpellier (K1-V1116)",   "wine",    "Lalvin",
                mu_max=0.44, X0=0.04, X_max=5.2, t_lag=3,  t_exp=26, t_stat=58,  k_d=0.007, ethanol_tol=16.0, opt_temp_c=18, temp_min_c=10, temp_max_c=35,
                description="Fast fermenting, high ABV wine yeast"),

    YeastStrain("71B",        "Narbonne (71B)",            "wine",    "Lalvin",
                mu_max=0.38, X0=0.04, X_max=4.5, t_lag=4,  t_exp=30, t_stat=62,  k_d=0.007, ethanol_tol=14.0, opt_temp_c=18, temp_min_c=12, temp_max_c=30,
                description="Fruity, soft, ideal for young wines"),

    YeastStrain("D47",        "Cote des Blancs (D47)",     "wine",    "Lalvin",
                mu_max=0.35, X0=0.04, X_max=4.2, t_lag=5,  t_exp=34, t_stat=66,  k_d=0.006, ethanol_tol=14.0, opt_temp_c=15, temp_min_c=10, temp_max_c=20,
                description="Enhances fruit and floral notes"),

    YeastStrain("RC-212",     "Bourgovin RC-212",          "wine",    "Lalvin",
                mu_max=0.37, X0=0.04, X_max=4.4, t_lag=4,  t_exp=32, t_stat=64,  k_d=0.007, ethanol_tol=13.0, opt_temp_c=22, temp_min_c=15, temp_max_c=30,
                description="Burgundy-style Pinot Noir wines"),

    YeastStrain("WLP720",     "Sweet Mead (WLP720)",       "wine",    "White Labs",
                mu_max=0.34, X0=0.03, X_max=4.0, t_lag=5,  t_exp=35, t_stat=70,  k_d=0.006, ethanol_tol=15.0, opt_temp_c=21, temp_min_c=15, temp_max_c=27,
                description="Fruity, low sulfur, mead and wine"),

    YeastStrain("WY4184",     "Sweet Mead (WY4184)",       "wine",    "Wyeast",
                mu_max=0.33, X0=0.03, X_max=3.8, t_lag=5,  t_exp=36, t_stat=72,  k_d=0.006, ethanol_tol=11.0, opt_temp_c=22, temp_min_c=16, temp_max_c=27,
                description="Residual sweetness, low attenuation mead"),

    # ── Saison yeasts ───────────────────────────────────────────────────────
    YeastStrain("T-58",       "Safbrew T-58",              "saison",  "Fermentis",
                mu_max=0.47, X0=0.05, X_max=5.0, t_lag=3,  t_exp=23, t_stat=50,  k_d=0.010, ethanol_tol=11.5, opt_temp_c=24, temp_min_c=18, temp_max_c=28,
                description="Spicy, robust Belgian character"),

    YeastStrain("WY3724",     "Belgian Saison (WY3724)",   "saison",  "Wyeast",
                mu_max=0.48, X0=0.05, X_max=5.2, t_lag=3,  t_exp=22, t_stat=48,  k_d=0.011, ethanol_tol=12.0, opt_temp_c=26, temp_min_c=18, temp_max_c=35,
                description="Classic Dupont saison character"),

    YeastStrain("WLP565",     "Belgian Saison (WLP565)",   "saison",  "White Labs",
                mu_max=0.46, X0=0.05, X_max=5.0, t_lag=3,  t_exp=24, t_stat=52,  k_d=0.010, ethanol_tol=12.0, opt_temp_c=25, temp_min_c=18, temp_max_c=35,
                description="Dry, earthy, spicy saison"),

    # ── Wild / Belgian ──────────────────────────────────────────────────────
    YeastStrain("WY3787",     "Trappist High Gravity (WY3787)", "wild", "Wyeast",
                mu_max=0.44, X0=0.05, X_max=5.3, t_lag=4,  t_exp=27, t_stat=58,  k_d=0.009, ethanol_tol=13.0, opt_temp_c=22, temp_min_c=18, temp_max_c=30,
                description="Rich, full-bodied Trappist-style"),

    YeastStrain("WLP530",     "Abbey Ale (WLP530)",         "wild",    "White Labs",
                mu_max=0.42, X0=0.05, X_max=5.0, t_lag=4,  t_exp=28, t_stat=60,  k_d=0.009, ethanol_tol=13.0, opt_temp_c=22, temp_min_c=18, temp_max_c=30,
                description="Westmalle abbey ale character"),

    YeastStrain("WY1388",     "Belgian Strong Ale (WY1388)", "wild",  "Wyeast",
                mu_max=0.43, X0=0.05, X_max=5.1, t_lag=4,  t_exp=27, t_stat=57,  k_d=0.009, ethanol_tol=12.5, opt_temp_c=23, temp_min_c=18, temp_max_c=30,
                description="Fruity, bold Belgian golden ale"),

    YeastStrain("WLP550",     "Belgian Ale (WLP550)",       "wild",    "White Labs",
                mu_max=0.41, X0=0.05, X_max=4.8, t_lag=4,  t_exp=29, t_stat=60,  k_d=0.008, ethanol_tol=12.0, opt_temp_c=24, temp_min_c=18, temp_max_c=29,
                description="Fruity, spicy Achouffe-type Belgian"),
]

STRAIN_MAP = {s.id: s for s in STRAINS}


# ─── Temperature factor ────────────────────────────────────────────────────

def temp_factor(strain: YeastStrain, temp_c: float) -> float:
    """Bell-curve response around optimal temp, clamps to 0 outside viable range."""
    if temp_c < strain.temp_min_c or temp_c > strain.temp_max_c:
        return 0.0
    sigma = (strain.temp_max_c - strain.temp_min_c) / 4.0
    return math.exp(-0.5 * ((temp_c - strain.opt_temp_c) / sigma) ** 2)


# ─── Sugar (substrate) factor using Monod kinetics ────────────────────────

def sugar_factor(S: float, Ks: float = 20.0) -> float:
    """Monod saturation kinetics. S in g/L, Ks ≈ 20 g/L."""
    if S <= 0:
        return 0.0
    return S / (Ks + S)


# ─── CER simulation ─────────────────────────────────────────────────────────

@dataclass
class CERPoint:
    t: float           # hours
    cer: float         # mg CO₂ / L / h
    phase: str         # lag / exponential / stationary / decline


@dataclass
class CERResult:
    points: List[CERPoint]
    peak_cer: float
    peak_t: float
    alert_triggered: bool
    alert_t: Optional[float]
    strain_id: str
    strain_name: str
    total_co2_mg_per_L: float


def simulate_cer(
    strain_id: str,
    sugar_g: float,
    volume_ml: float,
    temperature_c: float,
    duration_hours: float = 120.0,
    dt: float = 0.5,
    alert_threshold: float = 150.0,
) -> CERResult:
    strain = STRAIN_MAP.get(strain_id)
    if strain is None:
        raise ValueError(f"Unknown strain: {strain_id}")

    volume_L = volume_ml / 1000.0
    S0 = sugar_g / volume_L          # g/L initial substrate

    tf = temp_factor(strain, temperature_c)
    mu_eff_base = strain.mu_max * tf  # effective μMax at this temperature

    # Estimate how long exponential phase lasts based on mu_max
    # (if temp factor is low, extend the phase durations proportionally)
    scale = tf if tf > 0.05 else 0.05
    t_lag  = strain.t_lag
    t_exp  = strain.t_lag + (strain.t_exp - strain.t_lag) / scale
    t_stat = t_exp + (strain.t_stat - strain.t_exp) * 1.0
    # Don't scale decline phase

    X = strain.X0
    S = S0
    total_co2 = 0.0
    ethanol_est = 0.0   # g/L estimated ethanol (Embden–Meyerhof: 0.51 g EtOH per g glucose)
    EtOH_tol_g_L = strain.ethanol_tol * 0.789 * 10.0  # % ABV → g/L (approx)

    points: List[CERPoint] = []
    alert_triggered = False
    alert_t = None
    peak_cer = 0.0
    peak_t = 0.0

    t = 0.0
    while t <= duration_hours:
        # Determine phase
        if t < t_lag:
            phase = "lag"
            mu = 0.0
            dX = 0.0
        elif t < t_exp:
            phase = "exponential"
            sf = sugar_factor(S, Ks=20.0)
            mu = mu_eff_base * sf
            # Ethanol inhibition
            if ethanol_est > EtOH_tol_g_L:
                mu *= 0.05
            dX = mu * X * dt
            # Clamp to Xmax
            X_new = X + dX
            if X_new > strain.X_max:
                dX = strain.X_max - X
                X_new = strain.X_max
            # Sugar consumption: Yxs ≈ 0.5 g biomass per g sugar
            dS = -dX / 0.5
            S = max(0.0, S + dS)
            # Ethanol: 0.51 g per g sugar consumed
            ethanol_est += abs(dS) * 0.51
            X = X_new
        elif t < t_stat:
            phase = "stationary"
            mu = 0.0
            X = strain.X_max
        else:
            phase = "decline"
            mu = 0.0
            X = strain.X_max * math.exp(-strain.k_d * (t - t_stat))

        cer = mu * X * 0.49 * 1000.0  # mg/L/h

        total_co2 += cer * dt

        if cer > peak_cer:
            peak_cer = cer
            peak_t = t

        if cer >= alert_threshold and not alert_triggered:
            alert_triggered = True
            alert_t = t

        points.append(CERPoint(t=round(t, 2), cer=round(cer, 4), phase=phase))
        t += dt

    return CERResult(
        points=points,
        peak_cer=round(peak_cer, 4),
        peak_t=round(peak_t, 2),
        alert_triggered=alert_triggered,
        alert_t=round(alert_t, 2) if alert_t is not None else None,
        strain_id=strain_id,
        strain_name=strain.name,
        total_co2_mg_per_L=round(total_co2, 2),
    )
