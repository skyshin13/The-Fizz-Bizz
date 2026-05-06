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

def temp_factor(strain: YeastStrain, temp_c: float) -> float:
    """Gaussian bell-curve centred on opt_temp_c, zero outside viable range."""
    if temp_c < strain.temp_min_c or temp_c > strain.temp_max_c:
        return 0.0
    sigma = (strain.temp_max_c - strain.temp_min_c) / 4.0
    return math.exp(-0.5 * ((temp_c - strain.opt_temp_c) / sigma) ** 2)


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
