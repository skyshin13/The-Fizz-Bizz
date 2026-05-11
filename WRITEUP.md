# Fizz Bizz — Final Project Write-up
### ECE 464 | Spring 2026

---

## Mission

Home fermenters — kombucha brewers, homebrewers, kimchi makers, mead crafters — have no purpose-built tool that treats fermentation as a living process. Most use spreadsheets or paper logs, miss critical windows to take readings, and have no way to visualize what's happening inside a sealed vessel.

Fizz Bizz is a cloud-native fermentation management platform that solves this. Users track every batch from pitch to completion: logging pH, gravity, and CO₂ pressure; receiving automatic SMS reminders to take readings; watching a physics-based CO₂ pressure simulation update in near real-time; and sharing their fermentation journals publicly or with friends. The goal is to make rigorous fermentation tracking accessible without requiring a chemistry degree.

---

## Schema

The database has **17 tables** organized into four functional domains.

### Core Fermentation
| Table | Role |
|---|---|
| `users` | Account records with Supabase auth linkage, phone number for SMS |
| `fermentation_projects` | One row per batch; holds type, status, gravity, pH, visibility, dates |
| `measurement_logs` | Time-series readings (SG, pH, temp, CO₂ PSI, ABV, Brix) per project |
| `observation_notes` | Free-text notes with optional photo URL and JSON tags |
| `project_photos` | Supabase Storage–backed photo gallery entries |
| `project_cer_states` | Persistent CO₂ simulation state — one row per active project |
| `reminders` | Scheduled (pH/SG) and threshold-triggered (CO₂ PSI) SMS alerts |

### Yeast & Recipes
| Table | Role |
|---|---|
| `yeast_profiles` | Strain library (public + user-created) with full kinetic parameters |
| `project_yeast_connections` | Many-to-many: which yeast strain is pitched in which project |
| `recipes` | Community and personal fermentation recipes |
| `recipe_ingredients` | Ordered ingredient list per recipe, optionally linked to a yeast profile |

### Social
| Table | Role |
|---|---|
| `friendships` | Bidirectional friend requests with pending/accepted status |
| `user_follows` | Unidirectional follow graph |
| `project_likes` | Per-user like on a public project |
| `project_comments` | Text comments on public projects |

### Lookup / Config
| Table | Role |
|---|---|
| `fermentation_type_configs` | Canonical list of fermentation types with emoji, color, sort order |
| `sugar_types` | Reference table for sugar choices in CO₂ calculations |

**Key relationships:**
- `fermentation_projects` → `users` (owner), `recipes` (optional template), `project_cer_states` (1:1 simulation state)
- `measurement_logs` → `fermentation_projects` (time-series child)
- `reminders` → `fermentation_projects` + `users` (triggers against the project, owned by the user)
- `project_yeast_connections` bridges `fermentation_projects` ↔ `yeast_profiles`

Schema definitions: [`backend/app/models/models.py`](backend/app/models/models.py)
Migration history: [`backend/alembic/versions/`](backend/alembic/versions/)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                               │
│   React 18 + TypeScript + Vite  (Vercel)                    │
│   React Router v6 · Recharts · Supabase JS SDK              │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS / REST
┌──────────────────────▼──────────────────────────────────────┐
│                      BACKEND  (Railway)                     │
│   FastAPI + SQLAlchemy ORM + Pydantic v2                    │
│                                                             │
│   ┌─────────────────┐   ┌──────────────────────────────┐   │
│   │  REST API        │   │  Background Tasks (asyncio)  │   │
│   │  /api/projects   │   │                              │   │
│   │  /api/explore    │   │  live_cer_loop  (every 30s)  │   │
│   │  /api/reminders  │   │  reminder_loop  (every 60s)  │   │
│   │  /api/yeasts     │   │                              │   │
│   │  /api/recipes    │   └──────────────────────────────┘   │
│   │  /api/auth       │                                      │
│   └─────────────────┘                                       │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
┌────────────▼──────────┐   ┌────────────▼───────────────────┐
│  Supabase (PostgreSQL) │   │  Twilio                        │
│  via connection pooler │   │  Outbound SMS for reminders    │
│                        │   │  and CO₂ PSI alerts            │
│  + Supabase Auth (JWT) │   └────────────────────────────────┘
│  + Supabase Storage    │
│    (photo uploads)     │
└────────────────────────┘
```

**Data flow:**
1. The React frontend authenticates via Supabase Auth and receives a JWT.
2. Every API request carries that JWT in the `Authorization` header; FastAPI's `get_current_user` dependency verifies it against the Supabase JWT secret and resolves the internal `User` row.
3. Photos upload directly from the browser to Supabase Storage; the public URL is stored in the database.
4. Two asyncio background tasks run for the lifetime of the FastAPI process: `live_cer_loop` advances the CO₂ simulation and writes measurement rows every 30 seconds; `reminder_loop` scans for due reminders every 60 seconds and dispatches SMS via Twilio.

**Database seeding:** The yeast strain library (`yeast_profiles`) was populated programmatically using a seed script that imported 40+ strains from documented lab data (White Labs, Wyeast, Fermentis). Fermentation type configs and sugar type reference data were seeded the same way. Recipes were authored manually and inserted via the API. All seed scripts live in [`backend/app/db/seed.py`](backend/app/db/seed.py).

---

## Key Queries

### 1. Visibility-aware Explore Feed

The explore feed must respect four visibility levels (public, friends-only, followers-only, private) and attach like counts, comment counts, and "liked by me" in a single response — without N+1 queries.

```python
# One query for candidates with eager-loaded owner + measurements
candidates = (
    db.query(FermentationProject)
    .options(
        joinedload(FermentationProject.measurements),
        joinedload(FermentationProject.owner),
    )
    .filter(FermentationProject.user_id != current_user.id)
    .filter(or_(
        FermentationProject.is_public == True,
        FermentationProject.visibility.in_(["everyone", "friends", "followers"]),
    ))
    .order_by(FermentationProject.created_at.desc())
    .all()
)

# Two aggregate queries — not one per project
like_counts = dict(
    db.query(ProjectLike.project_id, func.count(ProjectLike.id))
    .filter(ProjectLike.project_id.in_(project_ids))
    .group_by(ProjectLike.project_id)
    .all()
)
comment_counts = dict(
    db.query(ProjectComment.project_id, func.count(ProjectComment.id))
    .filter(ProjectComment.project_id.in_(project_ids))
    .group_by(ProjectComment.project_id)
    .all()
)
```

**Indexing:** `ix_fp_public_vis (is_public, visibility)` is a composite index that lets the database evaluate the visibility filter without a full table scan. `ix_fp_created_at` covers the `ORDER BY created_at DESC`. `ix_pl_project_user (project_id, user_id)` on `project_likes` serves the "liked by me" lookup and the aggregate count in one index.

---

### 2. CO₂ PSI Alert Trigger on Measurement Insert

When a user logs a measurement, the backend checks all active CO₂ PSI reminders for that project, compares the logged PSI against each reminder's threshold (stored in `interval_hours`), and fires an SMS if the threshold is exceeded — with a 4-hour cooldown enforced in the database.

```python
if body.co2_psi is not None:
    co2_reminders = db.query(Reminder).filter(
        Reminder.project_id    == project_id,
        Reminder.reminder_type == 'co2_limit',
        Reminder.is_active     == True,
        Reminder.sms_enabled   == True,
    ).all()
    for r in co2_reminders:
        threshold = r.interval_hours  # PSI stored in interval_hours for co2_limit type
        cooldown_ok = (
            r.next_trigger_at is None or
            r.next_trigger_at <= datetime.now(timezone.utc)
        )
        if body.co2_psi >= threshold and cooldown_ok:
            phone = r.phone_number or (user.phone_number if user else None)
            if phone:
                send_sms(phone, f'Fizz Bizz: CO₂ on "{project.name}" hit {body.co2_psi} PSI. {r.message}')
                r.next_trigger_at = datetime.now(timezone.utc) + timedelta(hours=4)
```

**Indexing:** `ix_ml_project (project_id)` on `measurement_logs` makes the measurement insert context fast. The reminder lookup is narrow by design (few reminders per project) so no additional index is needed beyond the FK.

---

### 3. Yeast Batch Attachment (N+1 Prevention)

Loading a user's project list naively would fire one query per project to resolve the yeast strain. The `_attach_yeast_strains_batch` function collapses this to two queries regardless of project count.

```python
def _attach_yeast_strains_batch(projects, db):
    project_ids = [p.id for p in projects]

    # Query 1: all yeast connections for these projects
    connections = db.query(ProjectYeastConnection).filter(
        ProjectYeastConnection.project_id.in_(project_ids)
    ).all()

    yeast_ids = [c.yeast_id for c in connections]

    # Query 2: all referenced yeast profiles in one shot
    yeasts = {
        y.id: y for y in
        db.query(YeastProfile).filter(YeastProfile.id.in_(yeast_ids)).all()
    }

    conn_map = {c.project_id: c for c in connections}
    for p in projects:
        c = conn_map.get(p.id)
        p.yeast_strain = build_yeast_out(yeasts[c.yeast_id]) if c and c.yeast_id in yeasts else None
    return projects
```

**Indexing:** `project_yeast_connections` has an index on `project_id` (via FK), making the `.in_()` filter efficient.

---

## Complexity Component: Live CO₂ Simulation Engine

The technically unique part of Fizz Bizz is the real-time CO₂ pressure simulation that runs continuously in the background for every active fermentation project.

**The problem:** CO₂ pressure inside a sealed fermentation vessel changes every hour, but users don't log it that frequently. Simply graphing user-entered readings would produce sparse, meaningless charts. The simulation fills in the physics between readings, giving users a continuous, scientifically grounded CO₂ curve.

**The model:** The `cer_engine.py` implements a system of coupled ODEs solved with `scipy.integrate.solve_ivp` (Radau method, stiff-safe):

```
μ   = μ_max · S/(Ks+S) · (1 − E/E_max)ⁿ · temp_factor · lag_adapt(t)
dX/dt = μ·X − k_d·X        (biomass)
dS/dt = −(1/Yxs)·μ·X       (substrate consumption)
dE/dt = Yethanol·(−dS/dt)  (ethanol production)
CER   = Yco2·(−dS/dt)·1000  (CO₂ evolution rate, mg CO₂/L/h)
```

This is the Monod growth model with ethanol inhibition (Hill kinetics). Each yeast strain in the database has its own calibrated kinetic parameters (μ_max, Ks, Yxs, Yco2, E_max, etc.).

**The persistence challenge:** A naive implementation would replay the entire simulation from day zero on every tick. Instead, `project_cer_states` persists the simulation's state variables (biomass X, substrate S, ethanol estimate, elapsed time, fermentation phase) after every tick. The next tick loads those values and advances only the delta — typically 30 seconds of simulation time.

**Server restart recovery:** If the server goes down for hours, the next tick sees a large `gap_hours` between `last_tick_at` and `now`. The loop advances the ODE through the full gap and backfills one `MeasurementLog` row per hour, so the graph shows continuous history even across outages.

**CO₂ release events:** When a user vents their vessel (logs a "CO₂ release" event), `psi_released` is incremented by the current cumulative PSI. The displayed pressure is `psi_cumulative − psi_released`, which resets to near zero and then begins growing again from the new baseline — accurately modeling what happens when a pressure-release valve is opened.

**Strain awareness:** The simulation resolves the correct yeast strain by matching the project's linked `YeastProfile` against the `STRAIN_MAP` by strain code, then by name substring, then by yeast type — so a project using "Safale US-05" automatically gets US-05 kinetics without the user configuring anything.

For milk kefir projects, a separate exponential saturation model is used (Gorček et al., 2018): `C(t) = Ks · (1 − e^(−t/τs))`, with Ks and τs interpolated from experimental data across 17–27°C.

---

## The Journey

**What was harder than expected:**

*Stateful simulation persistence.* The original design assumed the simulation could be recomputed from scratch on each page load. In practice, advancing the full ODE from day zero for every API request took hundreds of milliseconds and introduced drift when parameters changed mid-fermentation. Designing the `project_cer_states` table and the tick-based persistence model required rethinking the entire data flow.

*Visibility access control.* The four-level visibility system (public, friends, followers, private) sounds simple until you realize the explore feed must filter candidates in Python after the DB query because the "is this user a friend/follower" check requires joins that would make the SQL unwieldy at query time. Getting the balance right between what to filter in SQL vs. in-memory took several iterations.

*Background task coordination.* FastAPI's lifespan context runs asyncio tasks alongside the web server. Ensuring the `live_cer_loop` and `reminder_loop` don't hold open database sessions across ticks (which would block other requests on SQLite, and waste connections on PostgreSQL) required careful scoping of `SessionLocal()` to the tick function, not the loop.

**What was easier than expected:**

Supabase Auth integration was straightforward — verifying JWTs server-side requires only the JWT secret and a few lines of PyJWT. Supabase Storage for photo uploads was similarly clean: the frontend uploads directly to storage and the backend only ever sees the resulting public URL.

Twilio SMS required almost no code. Once the credentials are in `.env`, `send_sms(phone, message)` is two API calls. The complexity is entirely in the scheduling logic, not the integration itself.

**On AI-assisted development:**

AI assistance was used throughout the project for scaffolding, debugging, and iterative UI refinement. The workflow that worked best was writing the intent and schema design by hand, then using AI to generate the boilerplate (route handlers, Pydantic schemas, React components) and refine it through conversation. The AI was consistently useful for catching N+1 query patterns, suggesting index strategies, and translating scientific papers (Monod kinetics, the Gorček kefir CO₂ model) into working code. It was less reliable for complex stateful logic — the CER persistence model and backfill algorithm required careful human review to ensure correctness across edge cases (timezone-naive datetimes, server restart gaps, CO₂ release event accounting).

---

## Scaling to 1 Million Active Users

The current architecture is single-instance FastAPI on Railway with a single PostgreSQL connection pool. Here is how it would need to evolve:

**Database:**
- Move from a single Supabase instance to a read-replica setup. The explore feed, project detail reads, and yeast library queries are all read-heavy and can be served from replicas.
- Partition `measurement_logs` by `project_id` or by time range. At scale, this table grows without bound (the CER simulation writes a row every 30 seconds per active project — 1M users × 1 batch each = ~120M rows/day).
- Add a time-series database (TimescaleDB or InfluxDB) specifically for `measurement_logs`. The current PostgreSQL schema works but a time-series engine gives better compression and range query performance for the chart data.

**Background tasks:**
- The `live_cer_loop` currently runs inside the web server process. At scale, move it to a dedicated worker tier (Celery + Redis, or a separate Railway service). The tick logic is stateless beyond what's in `project_cer_states`, so workers can be scaled horizontally.
- The `reminder_loop` should move to a proper job queue (Celery Beat or a cron-based system) rather than a tight async loop. This allows retry logic, dead-letter queuing for failed SMS sends, and independent scaling from the API tier.

**API:**
- Add a CDN (Cloudflare) in front of Vercel for static assets and API response caching for public explore endpoints.
- Cache the explore feed results in Redis with a short TTL (30–60 seconds). The visibility filtering can stay server-side; only the candidate query result needs caching.
- Rate-limit measurement submissions per user to prevent the CER simulation from being flooded with artificial readings.

**SMS:**
- At high volume, Twilio costs become significant. Implement per-user opt-in rate limiting and a preference for daily digest SMS rather than per-event for non-safety reminders. CO₂ PSI alerts remain immediate (safety-critical).

**Auth:**
- Supabase Auth scales well independently. No changes needed until ~10M users.
