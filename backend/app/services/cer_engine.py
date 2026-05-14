"""
CO₂ Evolution Rate (CER) simulation engine.

Governing equations (per fermentation class):

  Yeast (beer, wine):
    μ   = μ_max · S/(Ks+S) · (1 - E/E_max)^n · temp_factor · lag_adapt(t)
    dX/dt = μ·X − k_d·X
    dS/dt = −(1/Yxs)·μ·X
    dE/dt =  Yethanol·(−dS/dt)
    CER   =  Yco2·(−dS/dt)·1000          [mg CO₂/L/h]

  LAB (kimchi, lacto-fermentation):
    No ethanol inhibition; Yco2 ≈ 0.05 (heterofermentative trace CO₂)

  Kombucha (coupled yeast + acetobacter):
    Yeast produces CO₂ + ethanol; bacteria consume ethanol → acetic acid

Numerical solver: scipy.integrate.solve_ivp (Radau, stiff-safe)
Lag phase:        analytical factor  1 − exp(−t / t_lag)  (no ODE needed)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
from scipy.integrate import solve_ivp


# ─── Strain dataclass ────────────────────────────────────────────────────────

@dataclass
class YeastStrain:
    id: str
    name: str
    strain_type: str        # ale / lager / wheat / wine / champagne / saison / wild / lab / kombucha
    brand: str
    fermentation_class: str # 'yeast' | 'lab' | 'kombucha'

    # Monod kinetics
    mu_max: float           # h⁻¹   max specific growth rate
    Ks: float               # g/L   half-saturation constant for substrate

    # Yield coefficients (g product / g substrate consumed)
    Yxs: float              # g biomass / g substrate
    Yco2: float             # g CO₂    / g substrate
    Yethanol: float         # g EtOH   / g substrate

    # Ethanol inhibition
    E_max: float            # g/L   ethanol conc. where growth = 0
    inhib_n: float          # Hill exponent (1 = linear, 2 = sigmoidal)

    # Biomass
    X0: float               # g/L   initial inoculum
    X_max: float            # g/L   carrying-capacity ceiling
    k_d: float              # h⁻¹   endogenous decay / death rate

    # Lag phase
    t_lag: float            # h     time constant for lag adaptation

    # Temperature
    opt_temp_c: float
    temp_min_c: float
    temp_max_c: float

    # Display / legacy
    ethanol_tol: float      # % ABV (for UI)
    description: str = ""


# ─── Strain library ──────────────────────────────────────────────────────────
#
# Key differentiators between strain types:
#   mu_max   – lager << ale ≈ wheat < wine/champagne/saison
#   Ks       – LAB very low (efficient at low sugar); yeast moderate
#   Yco2     – yeast ~0.49; LAB ~0.05 (homo) / 0.24 (hetero); kombucha yeast ~0.45
#   E_max    – lager < ale < wine << champagne
#   inhib_n  – 1 (linear decay) for most; 2 (sigmoidal) for robust wine strains
#   t_lag    – lager long; ale moderate; wine short; saison very short

STRAINS: List[YeastStrain] = [

    # ── Ale yeasts ──────────────────────────────────────────────────────────
    YeastStrain("US-05", "Safale US-05", "ale", "Fermentis", "yeast",
                mu_max=0.38, Ks=2.0, Yxs=0.09, Yco2=0.490, Yethanol=0.460,
                E_max=87.0, inhib_n=1.0,
                X0=0.05, X_max=4.5, k_d=0.006, t_lag=4.0,
                opt_temp_c=19, temp_min_c=15, temp_max_c=24,
                ethanol_tol=11.0,
                description="Clean American ale yeast, very neutral profile"),

    YeastStrain("S-04", "Safale S-04", "ale", "Fermentis", "yeast",
                mu_max=0.43, Ks=1.8, Yxs=0.10, Yco2=0.492, Yethanol=0.455,
                E_max=83.0, inhib_n=1.0,
                X0=0.05, X_max=5.0, k_d=0.007, t_lag=3.0,
                opt_temp_c=20, temp_min_c=15, temp_max_c=24,
                ethanol_tol=10.5,
                description="English ale yeast, fruity esters, fast start"),

    YeastStrain("WY1056", "American Ale (Wyeast 1056)", "ale", "Wyeast", "yeast",
                mu_max=0.40, Ks=2.1, Yxs=0.09, Yco2=0.489, Yethanol=0.458,
                E_max=87.0, inhib_n=1.0,
                X0=0.05, X_max=4.8, k_d=0.006, t_lag=4.0,
                opt_temp_c=20, temp_min_c=16, temp_max_c=24,
                ethanol_tol=11.0,
                description="Versatile clean American ale"),

    YeastStrain("WLP001", "California Ale (WLP001)", "ale", "White Labs", "yeast",
                mu_max=0.39, Ks=2.2, Yxs=0.09, Yco2=0.488, Yethanol=0.458,
                E_max=87.0, inhib_n=1.0,
                X0=0.05, X_max=4.7, k_d=0.006, t_lag=4.0,
                opt_temp_c=20, temp_min_c=16, temp_max_c=24,
                ethanol_tol=11.0,
                description="Industry standard West Coast ale"),

    YeastStrain("WY1968", "London ESB (Wyeast 1968)", "ale", "Wyeast", "yeast",
                mu_max=0.46, Ks=1.6, Yxs=0.11, Yco2=0.493, Yethanol=0.452,
                E_max=79.0, inhib_n=1.0,
                X0=0.06, X_max=5.5, k_d=0.009, t_lag=3.0,
                opt_temp_c=20, temp_min_c=17, temp_max_c=22,
                ethanol_tol=10.0,
                description="Highly flocculent English ale, sharp peak"),

    YeastStrain("BE-134", "Safbrew BE-134", "ale", "Fermentis", "yeast",
                mu_max=0.36, Ks=2.4, Yxs=0.08, Yco2=0.486, Yethanol=0.462,
                E_max=95.0, inhib_n=1.2,
                X0=0.04, X_max=4.2, k_d=0.006, t_lag=5.0,
                opt_temp_c=22, temp_min_c=17, temp_max_c=29,
                ethanol_tol=12.0,
                description="Abbey-style Belgian ale yeast, slow but persistent"),

    YeastStrain("WLP028", "Edinburgh Ale (WLP028)", "ale", "White Labs", "yeast",
                mu_max=0.37, Ks=2.3, Yxs=0.09, Yco2=0.488, Yethanol=0.458,
                E_max=83.0, inhib_n=1.0,
                X0=0.05, X_max=4.3, k_d=0.006, t_lag=4.0,
                opt_temp_c=19, temp_min_c=15, temp_max_c=22,
                ethanol_tol=10.5,
                description="Malty Scottish ale character"),

    YeastStrain("WY1272", "American Ale II (WY1272)", "ale", "Wyeast", "yeast",
                mu_max=0.41, Ks=2.0, Yxs=0.09, Yco2=0.490, Yethanol=0.458,
                E_max=87.0, inhib_n=1.0,
                X0=0.05, X_max=4.9, k_d=0.007, t_lag=4.0,
                opt_temp_c=21, temp_min_c=16, temp_max_c=23,
                ethanol_tol=11.0,
                description="Slightly nutty, clean American ale"),

    # ── Lager yeasts ────────────────────────────────────────────────────────
    # Distinctly different: lower mu_max, higher Ks, longer lag, lower E_max
    YeastStrain("W-34/70", "Saflager W-34/70", "lager", "Fermentis", "yeast",
                mu_max=0.22, Ks=3.5, Yxs=0.07, Yco2=0.478, Yethanol=0.468,
                E_max=75.0, inhib_n=1.0,
                X0=0.04, X_max=4.0, k_d=0.004, t_lag=10.0,
                opt_temp_c=12, temp_min_c=8, temp_max_c=16,
                ethanol_tol=9.5,
                description="Classic Weihenstephan lager — slow, broad, low peak"),

    YeastStrain("S-23", "Saflager S-23", "lager", "Fermentis", "yeast",
                mu_max=0.20, Ks=3.8, Yxs=0.07, Yco2=0.475, Yethanol=0.470,
                E_max=71.0, inhib_n=1.0,
                X0=0.04, X_max=3.8, k_d=0.004, t_lag=12.0,
                opt_temp_c=13, temp_min_c=8, temp_max_c=16,
                ethanol_tol=9.0,
                description="Fruity German lager, very slow start"),

    YeastStrain("WY2124", "Bohemian Lager (WY2124)", "lager", "Wyeast", "yeast",
                mu_max=0.21, Ks=3.6, Yxs=0.07, Yco2=0.477, Yethanol=0.469,
                E_max=75.0, inhib_n=1.0,
                X0=0.04, X_max=4.1, k_d=0.004, t_lag=10.0,
                opt_temp_c=12, temp_min_c=7, temp_max_c=15,
                ethanol_tol=9.5,
                description="Classic Pilsner Urquell character"),

    YeastStrain("WLP830", "German Lager (WLP830)", "lager", "White Labs", "yeast",
                mu_max=0.21, Ks=3.6, Yxs=0.07, Yco2=0.476, Yethanol=0.469,
                E_max=75.0, inhib_n=1.0,
                X0=0.04, X_max=4.0, k_d=0.004, t_lag=10.0,
                opt_temp_c=12, temp_min_c=7, temp_max_c=15,
                ethanol_tol=9.5,
                description="Clean, malty German lager"),

    # ── Wheat yeasts ────────────────────────────────────────────────────────
    YeastStrain("WB-06", "Safbrew WB-06", "wheat", "Fermentis", "yeast",
                mu_max=0.44, Ks=1.7, Yxs=0.10, Yco2=0.491, Yethanol=0.455,
                E_max=79.0, inhib_n=1.0,
                X0=0.05, X_max=4.8, k_d=0.008, t_lag=3.0,
                opt_temp_c=21, temp_min_c=17, temp_max_c=26,
                ethanol_tol=10.0,
                description="Bavarian weizen with classic banana/clove"),

    YeastStrain("WY3068", "Weihenstephan Weizen (WY3068)", "wheat", "Wyeast", "yeast",
                mu_max=0.43, Ks=1.8, Yxs=0.10, Yco2=0.490, Yethanol=0.456,
                E_max=79.0, inhib_n=1.0,
                X0=0.05, X_max=4.7, k_d=0.008, t_lag=3.0,
                opt_temp_c=20, temp_min_c=17, temp_max_c=24,
                ethanol_tol=10.0,
                description="Authentic Hefeweizen character"),

    YeastStrain("WLP300", "Hefeweizen Ale (WLP300)", "wheat", "White Labs", "yeast",
                mu_max=0.43, Ks=1.8, Yxs=0.10, Yco2=0.490, Yethanol=0.456,
                E_max=79.0, inhib_n=1.0,
                X0=0.05, X_max=4.8, k_d=0.008, t_lag=3.0,
                opt_temp_c=20, temp_min_c=17, temp_max_c=24,
                ethanol_tol=10.0,
                description="Unfiltered wheat beer classic"),

    YeastStrain("WY3638", "Bavarian Wheat (WY3638)", "wheat", "Wyeast", "yeast",
                mu_max=0.41, Ks=1.9, Yxs=0.10, Yco2=0.489, Yethanol=0.456,
                E_max=79.0, inhib_n=1.0,
                X0=0.05, X_max=4.6, k_d=0.007, t_lag=4.0,
                opt_temp_c=21, temp_min_c=17, temp_max_c=26,
                ethanol_tol=10.0,
                description="High banana ester Bavarian wheat"),

    # ── Wine yeasts ─────────────────────────────────────────────────────────
    # High E_max and inhib_n=2 → sustains activity deep into fermentation
    YeastStrain("EC-1118", "Champagne (EC-1118)", "champagne", "Lalvin", "yeast",
                mu_max=0.46, Ks=1.2, Yxs=0.08, Yco2=0.500, Yethanol=0.468,
                E_max=150.0, inhib_n=2.0,
                X0=0.03, X_max=5.5, k_d=0.005, t_lag=3.0,
                opt_temp_c=18, temp_min_c=10, temp_max_c=30,
                ethanol_tol=18.0,
                description="Extreme ethanol tolerance — very long flat tail vs ale"),

    YeastStrain("K1-V1116", "Montpellier (K1-V1116)", "wine", "Lalvin", "yeast",
                mu_max=0.44, Ks=1.4, Yxs=0.08, Yco2=0.498, Yethanol=0.465,
                E_max=126.0, inhib_n=1.8,
                X0=0.04, X_max=5.2, k_d=0.006, t_lag=3.0,
                opt_temp_c=18, temp_min_c=10, temp_max_c=35,
                ethanol_tol=16.0,
                description="Fast fermenting, high ABV wine yeast"),

    YeastStrain("71B", "Narbonne (71B)", "wine", "Lalvin", "yeast",
                mu_max=0.38, Ks=1.6, Yxs=0.08, Yco2=0.494, Yethanol=0.462,
                E_max=110.0, inhib_n=1.5,
                X0=0.04, X_max=4.5, k_d=0.006, t_lag=4.0,
                opt_temp_c=18, temp_min_c=12, temp_max_c=30,
                ethanol_tol=14.0,
                description="Fruity, soft, ideal for young wines"),

    YeastStrain("D47", "Cote des Blancs (D47)", "wine", "Lalvin", "yeast",
                mu_max=0.34, Ks=1.8, Yxs=0.08, Yco2=0.491, Yethanol=0.460,
                E_max=110.0, inhib_n=1.5,
                X0=0.04, X_max=4.2, k_d=0.005, t_lag=5.0,
                opt_temp_c=15, temp_min_c=10, temp_max_c=20,
                ethanol_tol=14.0,
                description="Enhances fruit and floral notes, cold-sensitive"),

    YeastStrain("RC-212", "Bourgovin RC-212", "wine", "Lalvin", "yeast",
                mu_max=0.37, Ks=1.7, Yxs=0.08, Yco2=0.493, Yethanol=0.462,
                E_max=102.0, inhib_n=1.4,
                X0=0.04, X_max=4.4, k_d=0.006, t_lag=4.0,
                opt_temp_c=22, temp_min_c=15, temp_max_c=30,
                ethanol_tol=13.0,
                description="Burgundy-style Pinot Noir wines"),

    YeastStrain("WLP720", "Sweet Mead (WLP720)", "wine", "White Labs", "yeast",
                mu_max=0.33, Ks=2.0, Yxs=0.08, Yco2=0.488, Yethanol=0.458,
                E_max=118.0, inhib_n=1.5,
                X0=0.03, X_max=4.0, k_d=0.005, t_lag=5.0,
                opt_temp_c=21, temp_min_c=15, temp_max_c=27,
                ethanol_tol=15.0,
                description="Fruity, low sulfur, mead and wine"),

    YeastStrain("WY4184", "Sweet Mead (WY4184)", "wine", "Wyeast", "yeast",
                mu_max=0.32, Ks=2.2, Yxs=0.08, Yco2=0.486, Yethanol=0.456,
                E_max=87.0, inhib_n=1.3,
                X0=0.03, X_max=3.8, k_d=0.005, t_lag=5.0,
                opt_temp_c=22, temp_min_c=16, temp_max_c=27,
                ethanol_tol=11.0,
                description="Residual sweetness, low attenuation mead"),

    # ── Saison yeasts ───────────────────────────────────────────────────────
    # Highest mu_max, very short lag, high temp preference
    YeastStrain("T-58", "Safbrew T-58", "saison", "Fermentis", "yeast",
                mu_max=0.48, Ks=1.5, Yxs=0.11, Yco2=0.494, Yethanol=0.452,
                E_max=91.0, inhib_n=1.0,
                X0=0.05, X_max=5.0, k_d=0.009, t_lag=2.5,
                opt_temp_c=24, temp_min_c=18, temp_max_c=28,
                ethanol_tol=11.5,
                description="Spicy, robust Belgian — fastest start of all strains"),

    YeastStrain("WY3724", "Belgian Saison (WY3724)", "saison", "Wyeast", "yeast",
                mu_max=0.49, Ks=1.4, Yxs=0.11, Yco2=0.496, Yethanol=0.450,
                E_max=95.0, inhib_n=1.0,
                X0=0.05, X_max=5.2, k_d=0.010, t_lag=2.5,
                opt_temp_c=26, temp_min_c=18, temp_max_c=35,
                ethanol_tol=12.0,
                description="Classic Dupont saison, tallest peak"),

    YeastStrain("WLP565", "Belgian Saison (WLP565)", "saison", "White Labs", "yeast",
                mu_max=0.47, Ks=1.5, Yxs=0.11, Yco2=0.494, Yethanol=0.452,
                E_max=95.0, inhib_n=1.0,
                X0=0.05, X_max=5.0, k_d=0.009, t_lag=2.5,
                opt_temp_c=25, temp_min_c=18, temp_max_c=35,
                ethanol_tol=12.0,
                description="Dry, earthy, spicy saison"),

    # ── Wild / Belgian ──────────────────────────────────────────────────────
    YeastStrain("WY3787", "Trappist High Gravity (WY3787)", "wild", "Wyeast", "yeast",
                mu_max=0.44, Ks=1.7, Yxs=0.10, Yco2=0.492, Yethanol=0.456,
                E_max=102.0, inhib_n=1.3,
                X0=0.05, X_max=5.3, k_d=0.008, t_lag=3.5,
                opt_temp_c=22, temp_min_c=18, temp_max_c=30,
                ethanol_tol=13.0,
                description="Rich, full-bodied Trappist-style"),

    YeastStrain("WLP530", "Abbey Ale (WLP530)", "wild", "White Labs", "yeast",
                mu_max=0.42, Ks=1.8, Yxs=0.10, Yco2=0.490, Yethanol=0.456,
                E_max=102.0, inhib_n=1.3,
                X0=0.05, X_max=5.0, k_d=0.008, t_lag=4.0,
                opt_temp_c=22, temp_min_c=18, temp_max_c=30,
                ethanol_tol=13.0,
                description="Westmalle abbey ale character"),

    YeastStrain("WY1388", "Belgian Strong Ale (WY1388)", "wild", "Wyeast", "yeast",
                mu_max=0.43, Ks=1.7, Yxs=0.10, Yco2=0.491, Yethanol=0.455,
                E_max=99.0, inhib_n=1.2,
                X0=0.05, X_max=5.1, k_d=0.008, t_lag=3.5,
                opt_temp_c=23, temp_min_c=18, temp_max_c=30,
                ethanol_tol=12.5,
                description="Fruity, bold Belgian golden ale"),

    YeastStrain("WLP550", "Belgian Ale (WLP550)", "wild", "White Labs", "yeast",
                mu_max=0.41, Ks=1.8, Yxs=0.10, Yco2=0.489, Yethanol=0.455,
                E_max=95.0, inhib_n=1.2,
                X0=0.05, X_max=4.8, k_d=0.007, t_lag=4.0,
                opt_temp_c=24, temp_min_c=18, temp_max_c=29,
                ethanol_tol=12.0,
                description="Fruity, spicy Achouffe-type Belgian"),
]

STRAIN_MAP = {s.id: s for s in STRAINS}


# ─── Helper functions ────────────────────────────────────────────────────────

def _calc_temp_factor(temp_c: float, opt_temp_c: float,
                      temp_min_c: float, temp_max_c: float) -> float:
    if temp_c < temp_min_c or temp_c > temp_max_c:
        return 0.0
    sigma = (temp_max_c - temp_min_c) / 4.0
    return math.exp(-0.5 * ((temp_c - opt_temp_c) / sigma) ** 2)


def temp_factor(strain: YeastStrain, temp_c: float) -> float:
    """Gaussian bell-curve centred on opt_temp_c, zero outside viable range."""
    return _calc_temp_factor(temp_c, strain.opt_temp_c, strain.temp_min_c, strain.temp_max_c)


def _monod(S: float, Ks: float) -> float:
    return S / (Ks + S) if S > 0 else 0.0


def _ethanol_inhibition(E: float, E_max: float, n: float) -> float:
    if E <= 0:
        return 1.0
    ratio = min(E / E_max, 1.0)
    return max(0.0, (1.0 - ratio) ** n)


def _lag_adapt(t: float, t_lag: float) -> float:
    """Smooth 0→1 lag-adaptation factor.  No ODE needed — analytical."""
    if t_lag <= 0:
        return 1.0
    return 1.0 - math.exp(-t / t_lag)


# ─── ODE right-hand side ────────────────────────────────────────────────────

def _yeast_odes(t: float, y: List[float], strain: YeastStrain,
                tf: float) -> List[float]:
    """
    State y = [X, S, E]   (g/L each)
    Returns [dX/dt, dS/dt, dE/dt].
    """
    X, S, E = y
    X = max(X, 0.0)
    S = max(S, 0.0)
    E = max(E, 0.0)

    mu = (strain.mu_max
          * _monod(S, strain.Ks)
          * _ethanol_inhibition(E, strain.E_max, strain.inhib_n)
          * tf
          * _lag_adapt(t, strain.t_lag))

    # Cap biomass at X_max via logistic-style damping
    mu_net = mu * max(0.0, 1.0 - X / strain.X_max) - strain.k_d

    substrate_uptake = mu * X / strain.Yxs  # g substrate / (L·h)

    dX = mu_net * X
    dS = -substrate_uptake
    dE = strain.Yethanol * substrate_uptake

    return [dX, dS, dE]


# ─── Batch simulation (solve_ivp) ───────────────────────────────────────────

@dataclass
class CERPoint:
    t: float        # hours
    cer: float      # mg CO₂ / L / h
    phase: str      # lag / exponential / stationary / decline


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


def _classify_phase(t: float, mu: float, X: float, S: float,
                    strain: YeastStrain) -> str:
    if t < strain.t_lag * 0.7:
        return "lag"
    if X >= strain.X_max * 0.92:
        return "stationary"
    if S < strain.Ks * 0.5 and X < strain.X_max * 0.5:
        return "decline"
    return "exponential"


def simulate_cer(
    strain_id: str,
    sugar_g: float,
    volume_ml: float,
    temperature_c: float,
    duration_hours: float = 120.0,
    dt: float = 0.5,            # kept for API compatibility; sets output resolution
    alert_threshold: float = 150.0,
) -> CERResult:
    strain = STRAIN_MAP.get(strain_id)
    if strain is None:
        raise ValueError(f"Unknown strain: {strain_id}")

    volume_L = volume_ml / 1000.0
    S0 = sugar_g / volume_L

    tf = temp_factor(strain, temperature_c)

    # Initial state: [X, S, E]
    y0 = [strain.X0, S0, 0.0]

    # Output time grid (~60 points for graph, matching original resolution)
    n_points = min(max(int(duration_hours / dt), 60), 300)
    t_eval = np.linspace(0, duration_hours, n_points)

    sol = solve_ivp(
        fun=lambda t, y: _yeast_odes(t, y, strain, tf),
        t_span=(0.0, duration_hours),
        y0=y0,
        method="Radau",     # stiff-safe
        t_eval=t_eval,
        rtol=1e-4,
        atol=1e-6,
        dense_output=False,
    )

    points: List[CERPoint] = []
    total_co2 = 0.0
    peak_cer = 0.0
    peak_t = 0.0
    alert_triggered = False
    alert_t = None

    prev_t = 0.0
    for i, t in enumerate(sol.t):
        X = max(sol.y[0, i], 0.0)
        S = max(sol.y[1, i], 0.0)
        E = max(sol.y[2, i], 0.0)

        mu = (strain.mu_max
              * _monod(S, strain.Ks)
              * _ethanol_inhibition(E, strain.E_max, strain.inhib_n)
              * tf
              * _lag_adapt(t, strain.t_lag))

        substrate_uptake = mu * X / strain.Yxs           # g/L/h
        cer = strain.Yco2 * substrate_uptake * 1000.0    # mg CO₂/L/h

        step_dt = t - prev_t if i > 0 else 0.0
        total_co2 += cer * step_dt
        prev_t = t

        if cer > peak_cer:
            peak_cer = cer
            peak_t = t

        if cer >= alert_threshold and not alert_triggered:
            alert_triggered = True
            alert_t = t

        phase = _classify_phase(t, mu, X, S, strain)
        points.append(CERPoint(t=round(t, 2), cer=round(cer, 4), phase=phase))

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


# ─── Stateful simulation (tick-by-tick for live task) ───────────────────────

@dataclass
class CERState:
    X: float            # g/L biomass
    S: float            # g/L substrate
    ethanol_est: float  # g/L ethanol
    elapsed_t: float    # hours since fermentation start
    phase: str          # lag / exponential / stationary / decline


def initial_cer_state(strain_id: str, sugar_g: float, volume_ml: float) -> CERState:
    strain = STRAIN_MAP.get(strain_id) or STRAIN_MAP["US-05"]
    S0 = sugar_g / max(volume_ml / 1000.0, 0.001)
    return CERState(X=strain.X0, S=S0, ethanol_est=0.0, elapsed_t=0.0, phase="lag")


def step_cer(
    strain_id: str,
    state: CERState,
    temp_c: float,
    dt: float = 0.5,
) -> Tuple[CERState, float]:
    """
    Advance the fermentation by dt hours using the same ODE equations as
    simulate_cer (Euler step — cheap for the live tick task).
    Returns (new_state, cer_mg_L_h).
    """
    strain = STRAIN_MAP.get(strain_id) or STRAIN_MAP["US-05"]
    tf = temp_factor(strain, temp_c)

    X = max(state.X, 0.0)
    S = max(state.S, 0.0)
    E = max(state.ethanol_est, 0.0)
    t = state.elapsed_t

    mu = (strain.mu_max
          * _monod(S, strain.Ks)
          * _ethanol_inhibition(E, strain.E_max, strain.inhib_n)
          * tf
          * _lag_adapt(t, strain.t_lag))

    mu_net = mu * max(0.0, 1.0 - X / strain.X_max) - strain.k_d

    substrate_uptake = mu * X / strain.Yxs   # g/L/h

    X_new = max(0.0, X + mu_net * X * dt)
    S_new = max(0.0, S - substrate_uptake * dt)
    E_new = max(0.0, E + strain.Yethanol * substrate_uptake * dt)
    t_new = t + dt

    cer = strain.Yco2 * substrate_uptake * 1000.0   # mg CO₂/L/h

    new_state = CERState(
        X=round(X_new, 6),
        S=round(S_new, 6),
        ethanol_est=round(E_new, 6),
        elapsed_t=round(t_new, 4),
        phase=_classify_phase(t_new, mu, X_new, S_new, strain),
    )
    return new_state, round(max(0.0, cer), 4)


# ═══════════════════════════════════════════════════════════════════════════════
# KOMBUCHA MODEL — Coupled Yeast + Acetic Acid Bacteria (AAB) ODE System
# ═══════════════════════════════════════════════════════════════════════════════
#
# Scientific basis
# ────────────────
# Kombucha fermentation is driven by a SCOBY (Symbiotic Culture Of Bacteria
# and Yeast).  Two microbial guilds dominate:
#
#   Yeast guild   — Brettanomyces bruxellensis, Zygosaccharomyces bailii,
#                   Torulaspora delbrueckii (depending on SCOBY origin)
#                   Ferments sucrose → ethanol + CO₂  (Gay-Lussac pathway)
#
#   AAB guild     — Komagataeibacter xylinus (main cellulose/pellicle former),
#                   Acetobacter pasteurianus, Gluconobacter oxydans
#                   Oxidises ethanol → acetic acid at the O₂-rich pellicle
#                   surface.  This reaction produces NO CO₂.
#
# Key consequence: ethanol never accumulates to yeast-inhibiting levels because
# AAB consume it continuously → the ethanol inhibition term has a much lower
# effective ceiling than in beer (12 g/L vs 80+ g/L for ale yeast).
#
# CO₂ is produced *only* by yeast.  The resulting curve is broader and lower
# than an ale fermentation, reflecting the multi-week 1F kombucha window.
#
# References
# ──────────
# [1] Jayabalan R. et al. (2014) "A Review on Kombucha Tea — Microbiology,
#     Composition, Fermentation, Beneficial Effects, Toxicity, and Tea Fungus"
#     Compr. Rev. Food Sci. Food Saf. 13:538–550.
#     → Yeast μ_max fitted from their Fig. 2 pH/sugar curves at 25 °C
#
# [2] Chakravorty S. et al. (2016) "Kombucha tea fermentation: Microbial and
#     biochemical dynamics" J. Food Biochem. 40:220–233.
#     → Consortium composition; substrate consumption kinetics
#
# [3] Raspor P. & Goranovič D. (2008) "Biotechnological Applications of
#     Acetic Acid Bacteria" Crit. Rev. Biotechnol. 28:101–124.
#     → Komagataeibacter μ_max ~0.25 h⁻¹ in free solution; O₂ surface
#       limitation reduces effective rate 60 % → 0.10 h⁻¹ in bulk kombucha
#
# [4] Loncar E. et al. (2014) "Influence of working conditions upon kombucha
#     conducted fermentation on black tea" Chem. Ind. Chem. Eng. Q. 20:131–138.
#     → Sucrose Ks 3–4 g/L; fermentation kinetics at varying temperatures
#
# [5] Sokollek S.J. et al. (1998) "Description of two strains of Acetobacter
#     with amended descriptions of the species" Int. J. Syst. Bacteriol.
#     → Acetobacter ethanol Ks 1–4 g/L; Yxe 0.03–0.05 g/g
#
# [6] Gay-Lussac stoichiometry: C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂
#     Yco2_theoretical = 2×44/180 = 0.489 g/g glucose
#     For sucrose feed: ×0.974 (MW correction) = 0.476 g/g sucrose consumed
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class KombuchaStrain:
    id:               str
    name:             str
    brand:            str
    fermentation_class: str   # always "kombucha"
    strain_type:      str     # "SCOBY" — for UI compatibility

    # ── Yeast guild kinetics (Monod on sucrose) ──────────────────────────────
    mu_max_y:   float   # h⁻¹  max specific growth rate at opt_temp_c  [1,2]
    Ks_y:       float   # g/L  sucrose half-saturation constant        [4]
    Yxs_y:      float   # g/g  biomass yield on substrate
    Yco2_y:     float   # g/g  CO₂ yield on substrate                 [6]
    Yethanol_y: float   # g/g  ethanol yield on substrate              [6]
    E_max_y:    float   # g/L  ethanol conc. → yeast growth = 0       [1]
    X0_y:       float   # g/L  initial yeast biomass (from SCOBY)
    X_max_y:    float   # g/L  yeast carrying capacity
    k_d_y:      float   # h⁻¹  yeast decay rate
    t_lag_y:    float   # h    yeast lag-phase time constant          [1]

    # ── Acetic acid bacteria (AAB) kinetics (Monod on ethanol) ───────────────
    mu_max_b:   float   # h⁻¹  effective μ_max (O₂-surface-limited)   [3]
    Ks_b:       float   # g/L  ethanol half-saturation for AAB        [5]
    Yxe_b:      float   # g/g  AAB biomass yield on ethanol           [5]
    X0_b:       float   # g/L  initial AAB biomass (from SCOBY)
    X_max_b:    float   # g/L  AAB carrying capacity (pellicle-bound)
    k_d_b:      float   # h⁻¹  AAB decay rate
    t_lag_b:    float   # h    AAB lag (shorter; already active)

    # ── Temperature ──────────────────────────────────────────────────────────
    opt_temp_c:   float  # °C  yeast guild optimum                    [4]
    opt_temp_b_c: float  # °C  AAB guild optimum (slightly warmer)    [3]
    temp_min_c:   float
    temp_max_c:   float

    ethanol_tol:  float  # % ABV display only
    description:  str = ""


KOMBUCHA_STRAINS: List[KombuchaStrain] = [

    KombuchaStrain(
        id="SCOBY-GT",
        name="GT's Original SCOBY (Black Tea)",
        brand="GT's Kombucha Culture",
        fermentation_class="kombucha",
        strain_type="SCOBY",
        # Yeast guild — fitted from Jayabalan 2014 Fig. 2 at 25 °C [1]
        # μ_max notably lower than ale yeast (0.38) due to mixed-culture
        # competition and atypical yeast species (Brettanomyces/Zygosaccharomyces)
        mu_max_y=0.18, Ks_y=3.5,
        Yxs_y=0.07, Yco2_y=0.476, Yethanol_y=0.450,
        E_max_y=12.0,   # AAB keep bulk ethanol <3 % → inhibition ceiling ~12 g/L [1]
        X0_y=0.10,      # established SCOBY; higher than pitched dry yeast (0.05)
        X_max_y=3.0, k_d_y=0.005, t_lag_y=6.0,
        # AAB guild — Raspor & Goranovič 2008 [3]; Sokollek 1998 [5]
        # Free-solution μ_max ~0.25 h⁻¹; O₂ surface-diffusion limits effective
        # rate to ~40 % in bulk kombucha → 0.10 h⁻¹
        mu_max_b=0.10, Ks_b=2.5, Yxe_b=0.04,
        X0_b=0.03, X_max_b=1.0, k_d_b=0.006, t_lag_b=3.0,
        opt_temp_c=25, opt_temp_b_c=28, temp_min_c=18, temp_max_c=32,
        ethanol_tol=3.0,
        description=(
            "Traditional black-tea kombucha SCOBY. Broad, low CO₂ curve over 7–14 days. "
            "AAB continuously oxidise ethanol → acetic acid, keeping ABV <3 %."
        ),
    ),

    KombuchaStrain(
        id="SCOBY-JUN",
        name="Jun SCOBY (Green Tea & Honey)",
        brand="Jun Culture",
        fermentation_class="kombucha",
        strain_type="SCOBY",
        # Jun SCOBYs host Torulaspora delbrueckii and Lachancea fermentati,
        # adapted to honey (free fructose + glucose) → lower Ks than sucrose [2]
        # Slightly lower μ_max_y than GT's due to different species mix
        mu_max_y=0.16, Ks_y=2.0,   # honey is pre-inverted; Ks lower than sucrose
        Yxs_y=0.07, Yco2_y=0.476, Yethanol_y=0.448,
        E_max_y=10.0,   # slightly more sensitive to ethanol
        X0_y=0.10, X_max_y=2.8, k_d_y=0.005, t_lag_y=5.0,
        mu_max_b=0.09, Ks_b=2.2, Yxe_b=0.04,
        X0_b=0.03, X_max_b=0.9, k_d_b=0.006, t_lag_b=3.0,
        opt_temp_c=24, opt_temp_b_c=27, temp_min_c=18, temp_max_c=30,
        ethanol_tol=2.5,
        description=(
            "Jun SCOBY on green tea + honey. Faster pH drop than black-tea kombucha. "
            "Lower Ks reflects honey's pre-inverted fructose/glucose substrate."
        ),
    ),
]

KOMBUCHA_STRAIN_MAP: dict = {s.id: s for s in KOMBUCHA_STRAINS}


# ─── Kombucha ODE system ─────────────────────────────────────────────────────

def _kombucha_odes(t: float, y: List[float], strain: KombuchaStrain,
                   tf_y: float, tf_b: float) -> List[float]:
    """
    Four-dimensional ODE for kombucha SCOBY fermentation.

    State  y = [X_y, X_b, S, E]
      X_y  g/L  yeast guild biomass
      X_b  g/L  AAB guild biomass
      S    g/L  sucrose (or glucose-equiv.) remaining
      E    g/L  ethanol (produced by yeast, consumed by AAB)

    Equations
    ─────────
      μ_y  = μ_max_y · S/(Ks_y+S) · (1−E/E_max_y) · tf_y · lag_adapt(t, t_lag_y)
      μ_b  = μ_max_b · E/(Ks_b+E) · tf_b · lag_adapt(t, t_lag_b)

      dX_y/dt = [μ_y · (1−X_y/X_max_y) − k_d_y] · X_y
      dX_b/dt = [μ_b · (1−X_b/X_max_b) − k_d_b] · X_b
      dS/dt   = −(1/Yxs_y) · μ_y · X_y
      dE/dt   =  Yethanol_y · (1/Yxs_y) · μ_y · X_y   ← yeast production
                −(1/Yxe_b)  · μ_b · X_b               ← AAB consumption

    CO₂ produced by yeast only (AAB oxidation: EtOH + O₂ → AcOH + H₂O, no CO₂):
      CER = Yco2_y · (1/Yxs_y) · μ_y · X_y · 1000    [mg CO₂ / L / h]

    References: see module docstring [1]–[6].
    """
    X_y = max(y[0], 0.0)
    X_b = max(y[1], 0.0)
    S   = max(y[2], 0.0)
    E   = max(y[3], 0.0)

    lag_y = _lag_adapt(t, strain.t_lag_y)
    lag_b = _lag_adapt(t, strain.t_lag_b)

    mu_y = (strain.mu_max_y
            * _monod(S, strain.Ks_y)
            * max(0.0, 1.0 - E / strain.E_max_y)
            * tf_y * lag_y)

    mu_b = (strain.mu_max_b
            * _monod(E, strain.Ks_b)   # AAB grows on ethanol as sole C-source
            * tf_b * lag_b)

    mu_net_y = mu_y * max(0.0, 1.0 - X_y / strain.X_max_y) - strain.k_d_y
    mu_net_b = mu_b * max(0.0, 1.0 - X_b / strain.X_max_b) - strain.k_d_b

    substrate_uptake_y = mu_y * X_y / strain.Yxs_y    # g sucrose L⁻¹ h⁻¹
    ethanol_uptake_b   = mu_b * X_b / strain.Yxe_b    # g ethanol L⁻¹ h⁻¹

    dX_y = mu_net_y * X_y
    dX_b = mu_net_b * X_b
    dS   = -substrate_uptake_y
    dE   = strain.Yethanol_y * substrate_uptake_y - ethanol_uptake_b

    return [dX_y, dX_b, dS, dE]


def _kombucha_phase(t: float, X_y: float, S: float,
                    strain: KombuchaStrain) -> str:
    if t < strain.t_lag_y * 0.7:
        return "lag"
    if S > strain.Ks_y * 2 and X_y < strain.X_max_y * 0.9:
        return "exponential"
    if S < strain.Ks_y * 0.5:
        return "decline"
    return "stationary"


# ─── Batch simulation for kombucha ───────────────────────────────────────────

def simulate_cer_kombucha(
    strain_id: str,
    sugar_g: float,
    volume_ml: float,
    temperature_c: float,
    duration_hours: float = 336.0,   # 14 days — typical kombucha 1F window
    dt: float = 1.0,
    alert_threshold: float = 50.0,   # lower threshold; kombucha CER is gentler
) -> CERResult:
    """
    Batch CO₂ simulation for kombucha using the coupled yeast+AAB ODE system.
    Uses scipy Radau solver (stiff-safe) identical to simulate_cer().
    Default duration is 336 h (14 days) to cover the full 1F window.
    """
    strain = KOMBUCHA_STRAIN_MAP.get(strain_id)
    if strain is None:
        raise ValueError(f"Unknown kombucha strain: {strain_id}")

    volume_L = volume_ml / 1000.0
    S0 = sugar_g / volume_L

    tf_y = _calc_temp_factor(temperature_c, strain.opt_temp_c,
                              strain.temp_min_c, strain.temp_max_c)
    tf_b = _calc_temp_factor(temperature_c, strain.opt_temp_b_c,
                              strain.temp_min_c, strain.temp_max_c)

    y0 = [strain.X0_y, strain.X0_b, S0, 0.0]   # [X_y, X_b, S, E]

    n_points = min(max(int(duration_hours / dt), 60), 500)
    t_eval = np.linspace(0, duration_hours, n_points)

    sol = solve_ivp(
        fun=lambda t, y: _kombucha_odes(t, y, strain, tf_y, tf_b),
        t_span=(0.0, duration_hours),
        y0=y0,
        method="Radau",
        t_eval=t_eval,
        rtol=1e-4,
        atol=1e-6,
        dense_output=False,
    )

    points: List[CERPoint] = []
    total_co2 = 0.0
    peak_cer  = 0.0
    peak_t    = 0.0
    alert_triggered = False
    alert_t   = None
    prev_t    = 0.0

    for i, t in enumerate(sol.t):
        X_y = max(sol.y[0, i], 0.0)
        X_b = max(sol.y[1, i], 0.0)  # noqa: F841 (stored for completeness)
        S   = max(sol.y[2, i], 0.0)
        E   = max(sol.y[3, i], 0.0)

        lag_y = _lag_adapt(t, strain.t_lag_y)
        mu_y  = (strain.mu_max_y
                 * _monod(S, strain.Ks_y)
                 * max(0.0, 1.0 - E / strain.E_max_y)
                 * tf_y * lag_y)

        substrate_uptake_y = mu_y * X_y / strain.Yxs_y
        cer = strain.Yco2_y * substrate_uptake_y * 1000.0   # mg CO₂/L/h

        step_dt = t - prev_t if i > 0 else 0.0
        total_co2 += cer * step_dt
        prev_t = t

        if cer > peak_cer:
            peak_cer = cer
            peak_t   = t

        if cer >= alert_threshold and not alert_triggered:
            alert_triggered = True
            alert_t = t

        points.append(CERPoint(
            t=round(t, 2),
            cer=round(cer, 4),
            phase=_kombucha_phase(t, X_y, S, strain),
        ))

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


# ─── Stateful kombucha step (live tick) ──────────────────────────────────────

@dataclass
class KombuchaCERState:
    X_y:       float   # g/L  yeast biomass
    X_b:       float   # g/L  AAB biomass
    S:         float   # g/L  substrate remaining
    E:         float   # g/L  ethanol
    elapsed_t: float   # h    hours since fermentation start
    phase:     str


def initial_kombucha_cer_state(strain_id: str, sugar_g: float,
                                volume_ml: float) -> KombuchaCERState:
    strain = KOMBUCHA_STRAIN_MAP.get(strain_id) or KOMBUCHA_STRAINS[0]
    S0 = sugar_g / max(volume_ml / 1000.0, 0.001)
    return KombuchaCERState(
        X_y=strain.X0_y, X_b=strain.X0_b,
        S=S0, E=0.0, elapsed_t=0.0, phase="lag",
    )


def step_cer_kombucha(
    strain_id: str,
    state: KombuchaCERState,
    temp_c: float,
    dt: float = 0.5,
) -> Tuple[KombuchaCERState, float]:
    """
    Euler step for the live kombucha CER simulation.
    Mirrors step_cer() but uses the 4-state (X_y, X_b, S, E) system.
    Returns (new_state, cer_mg_L_h).
    """
    strain = KOMBUCHA_STRAIN_MAP.get(strain_id) or KOMBUCHA_STRAINS[0]

    tf_y = _calc_temp_factor(temp_c, strain.opt_temp_c,
                              strain.temp_min_c, strain.temp_max_c)
    tf_b = _calc_temp_factor(temp_c, strain.opt_temp_b_c,
                              strain.temp_min_c, strain.temp_max_c)

    X_y = max(state.X_y, 0.0)
    X_b = max(state.X_b, 0.0)
    S   = max(state.S,   0.0)
    E   = max(state.E,   0.0)
    t   = state.elapsed_t

    lag_y = _lag_adapt(t, strain.t_lag_y)
    lag_b = _lag_adapt(t, strain.t_lag_b)

    mu_y = (strain.mu_max_y
            * _monod(S, strain.Ks_y)
            * max(0.0, 1.0 - E / strain.E_max_y)
            * tf_y * lag_y)

    mu_b = (strain.mu_max_b
            * _monod(E, strain.Ks_b)
            * tf_b * lag_b)

    mu_net_y = mu_y * max(0.0, 1.0 - X_y / strain.X_max_y) - strain.k_d_y
    mu_net_b = mu_b * max(0.0, 1.0 - X_b / strain.X_max_b) - strain.k_d_b

    substrate_uptake_y = mu_y * X_y / strain.Yxs_y
    ethanol_uptake_b   = mu_b * X_b / strain.Yxe_b

    X_y_new = max(0.0, X_y + mu_net_y * X_y * dt)
    X_b_new = max(0.0, X_b + mu_net_b * X_b * dt)
    S_new   = max(0.0, S - substrate_uptake_y * dt)
    E_new   = max(0.0, E + (strain.Yethanol_y * substrate_uptake_y
                             - ethanol_uptake_b) * dt)
    t_new   = t + dt

    cer = strain.Yco2_y * substrate_uptake_y * 1000.0   # mg CO₂/L/h

    return (
        KombuchaCERState(
            X_y=round(X_y_new, 6), X_b=round(X_b_new, 6),
            S=round(S_new, 6),     E=round(E_new, 6),
            elapsed_t=round(t_new, 4),
            phase=_kombucha_phase(t_new, X_y_new, S_new, strain),
        ),
        round(max(0.0, cer), 4),
    )
