# Fizz Bizz — Final Write-Up

**Live App:** https://the-fizz-bizz.vercel.app/
**Repository:** https://github.com/skyshin13/The-Fizz-Bizz

---

## 1. Mission

Home fermenters like brewers, kombucha makers, food fermenters, wine makers, track their batches across notebooks, spreadsheets, and memory. There is no single place to log measurements over time, visualize fermentation progress, set automated reminders, or share a batch with the community.

Fizz Bizz is a full-stack fermentation management platform that solves exactly that. Users create projects for any of 12 fermentation types, log pH, specific gravity, CO₂ pressure, temperature, and ABV over time, view live trend charts, and receive automated SMS/email reminders. A social layer including follows, likes, comments, and a public Explore feed, lets the fermentation community share and discover each other's batches. The platform also runs a continuous physics-based CO₂ simulation for alcohol fermentations so the chart updates even when no manual readings have been logged.

---

## 2. Schema

### Core Tables

| Table | Purpose |
|---|---|
| `users` | Accounts, auth, preferences, notification settings |
| `fermentation_projects` | One row per batch; holds type, status, dates, gravity, pH, visibility |
| `measurement_logs` | Time-series readings (SG, pH, temp, CO₂, ABV) — both manual and simulation-generated |
| `observation_notes` | Timestamped text notes with optional photo and JSON tag array |
| `project_photos` | Additional gallery photos per project |
| `yeast_profiles` | Strain library (user-created or system); stores attenuation, temp range, flavor notes |
| `project_yeast_connections` | Many-to-many join between projects and yeast strains |
| `recipes` | Starter recipes with difficulty, duration, instructions |
| `recipe_ingredients` | Ordered ingredient list per recipe; links to yeast_profiles when relevant |
| `reminders` | Scheduled (time-based) and threshold-based (CO₂ PSI) alerts per project |
| `project_cer_states` | Persistent simulation state for the live CO₂ engine (one row per project) |
| `fermentation_type_configs` | Lookup table: type slug → display label, emoji, color |
| `sugar_types` | Lookup table for priming sugar calculator |
| `friendships` | Bidirectional friend requests with PENDING / ACCEPTED status |
| `user_follows` | Directed follower graph |
| `project_likes` | Per-user likes on public projects |
| `project_comments` | Threaded comments (self-referential `parent_id`) on public projects |

### Key Relationships

```
users ──< fermentation_projects ──< measurement_logs
                │                ──< observation_notes
                │                ──< project_photos
                │                ──< reminders
                │                ──< project_yeast_connections >── yeast_profiles
                │                ──  project_cer_states (1:1)
                │                ──< project_likes
                │                ──< project_comments (self-ref via parent_id)
users ──< friendships >── users
users ──< user_follows >── users
recipes ──< recipe_ingredients >── yeast_profiles
```

Schema definitions: [`backend/app/models/models.py`](backend/app/models/models.py)

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                               │
│   React + TypeScript + Vite (Vercel CDN)                    │
│   Recharts  •  Axios  •  React Router  •  date-fns          │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTPS / REST  (VITE_API_URL)
┌───────────────▼─────────────────────────────────────────────┐
│                     FastAPI  (Railway)                       │
│  ┌──────────────────┐   ┌─────────────────────────────────┐  │
│  │  REST API Routes │   │  Background Tasks (asyncio)     │  │
│  │  /auth  /users   │   │  live_cer_loop  – every 60 s   │  │
│  │  /projects       │   │  reminder_loop  – every 60 s   │  │
│  │  /explore        │   └─────────────────────────────────┘  │
│  │  /calculations   │                                        │
│  │  /reminders      │                                        │
│  └────────┬─────────┘                                        │
└───────────┼──────────────────────────────────────────────────┘
            │ SQLAlchemy ORM
┌───────────▼──────────────────────────────────────────────────┐
│              Supabase  (PostgreSQL)                          │
│              Supabase Storage  (project / observation photos)│
└──────────────────────────────────────────────────────────────┘
            │ Third-party notifications
┌───────────▼──────────────────────────────────────────────────┐
│   SendGrid  (transactional email)                            │
│   Twilio    (SMS)                                            │
└──────────────────────────────────────────────────────────────┘
```

### How the database was loaded

All data was created through the live application and API — no external dataset was imported. Seed accounts for demo and presentation purposes were inserted via two custom Python scripts (`backend/seed_cooper_users.py`, `backend/duplicate_project.py`) that call SQLAlchemy directly. The `duplicate_project.py` script copies a project and all its child rows (measurements, observations, photos, yeast connections) to a different user account as fully independent rows, intentionally omitting reminders which are personal.

Supabase Storage holds binary photo assets; only the public URL is stored in the database (`cover_photo_url`, `photo_url`). The frontend uploads directly to the Supabase bucket using the anon key and then POSTs the resulting URL to the API.

---

## 4. Key Queries

### Query 1 — Batch yeast-strain loading (N+1 elimination)

When listing a user's projects, each project may reference a yeast strain via `project_yeast_connections`. A naïve implementation would issue one query per project (going through each project as one query and running another query to get the yeast). Instead, `_attach_yeast_strains_batch()` in [`backend/app/api/routes/projects.py`](backend/app/api/routes/projects.py) resolves all strains in exactly two queries regardless of how many projects are returned: one to get all the yeast connections, one to get all the yeast profiles.

```python
# Query 1: all connections for the project set
connections = db.query(ProjectYeastConnection).filter(
    ProjectYeastConnection.project_id.in_(project_ids)
).all()

# Query 2: all yeast profiles referenced by those connections
yeasts = db.query(YeastProfile).filter(
    YeastProfile.id.in_(yeast_ids)
).all()
```

Results are assembled in Python dicts keyed by ID, so each project lookup is O(1). The `project_yeast_connections.project_id` column carries an index, making the first query a fast index scan; `yeast_profiles.id` is the primary key.

---

### Query 2 — Separating simulation data from user data

The `measurement_logs` table stores both user-entered readings (pH, ABV, etc) and auto-generated CO₂/temperature points from the live simulation (live CO₂ production graph). Mixing them on the dashboard would show thousands of machine rows where users expect to see their manual entries on the fermentation trends section. The filter `_USER_MEAS_FILTER` selects only meaningful records:

```python
_USER_MEAS_FILTER = or_(
    MeasurementLog.ph.isnot(None),
    MeasurementLog.specific_gravity.isnot(None),
    MeasurementLog.alcohol_by_volume.isnot(None),
    MeasurementLog.brix.isnot(None),
    MeasurementLog.notes.isnot(None),
)
```

Simulation rows only populate `co2_psi` and `temperature_celsius`, so they are excluded. This filter is applied during the batch load in `list_projects` and is supported by the compound index on `(project_id, logged_at)` together with partial scans on the nullable columns. The CO₂ chart queries separately against `co2_psi IS NOT NULL`.

**Indexing strategy:** `measurement_logs` carries indexes on `project_id` (foreign key), `logged_at` (range scans for charts), and `co2_psi` (not-null checks by the reminder loop). The combination of `project_id` + `logged_at` is the most common access pattern and benefits from a composite index that PostgreSQL can use for both filtering and ordering in a single pass.

---

### Query 3 — Explore feed with multi-mode visibility

The Explore feed must surface public projects while respecting four visibility levels: `everyone`, `friends`, `followers`, and `private`. The query builds the visibility predicate dynamically based on the requesting user's social graph:

```python
friend_ids = db.query(Friendship.requester_id, Friendship.receiver_id).filter(
    or_(
        Friendship.requester_id == current_user.id,
        Friendship.receiver_id == current_user.id,
    ),
    Friendship.status == FriendshipStatus.ACCEPTED,
).all()

followed_ids = db.query(UserFollow.followed_id).filter(
    UserFollow.follower_id == current_user.id
).all()

projects = db.query(FermentationProject).filter(
    FermentationProject.user_id != current_user.id,
    or_(
        FermentationProject.visibility == "everyone",
        and_(FermentationProject.visibility == "friends",
             FermentationProject.user_id.in_(mutual_friend_ids)),
        and_(FermentationProject.visibility == "followers",
             FermentationProject.user_id.in_(followed_ids)),
    )
).order_by(FermentationProject.created_at.desc()).all()
```

`fermentation_projects.visibility` and `fermentation_projects.is_public` are both indexed. The friendship and follow tables are indexed on their respective `requester_id`/`receiver_id` and `follower_id` columns to keep those subqueries fast even as the social graph grows.

---

## 5. Complexity Component — Live CO₂ Simulation Engine

The most technically distinctive part of Fizz Bizz is the live fermentation simulation that drives the CO₂ chart for alcoholic beverages (beer, wine, kombucha, cider) projects without requiring any user action. This components would be useful for homebrewers who do not have access to CO₂ sensors because of expenses, and it a great way for users to be able to have estimated CO₂ limitations to know if their project is overproducing and CO₂ must be released ("burped").

### The problem

Fermentation produces CO₂ continuously, but users only log measurements occasionally. A chart with three manual data points over fourteen days is not useful for understanding fermentation progress. The goal was to show a biologically realistic CO₂ pressure curve that updates in real time.

### The solution: a stateful ODE model persisted in PostgreSQL

The system models yeast kinetics using a modified Monod growth model with three phases:

- **Lag phase** — adaptation; no growth
- **Exponential phase** — logistic biomass growth consuming substrate (sugar), CO₂ production proportional to `μ(S) · X`
- **Stationary/declining phase** — substrate exhaustion, slowing CO₂ production

The coupled ODEs (in [`backend/app/services/cer_engine.py`](backend/app/services/cer_engine.py)):

```
dX/dt = μ(S, T) · X · (1 - X/X_max)
dS/dt = -(1/Y_xs) · dX/dt
CER   = Y_co2 · μ(S, T) · X
```

where `μ(S, T) = μ_max · S/(K_s + S) · f(T)` is the temperature-corrected specific growth rate.

Kombucha projects use a separate two-population model that adds acetic acid bacteria (`X_bact`) alongside the yeast population, since kombucha SCOBYs contain both organisms.

### Persistence across server restarts

The simulation state (`X`, `S`, `ethanol_est`, `elapsed_t`, `phase`, `psi_cumulative`, `psi_released`) is stored in the `project_cer_states` table — one row per project. Every 60 seconds, `live_cer_task._tick()` loads all active projects, checks the gap between `last_tick_at` and `now`, and advances the simulation by that exact duration using `SIM_DT = 0.5 h` substeps. This means a server restart of any length is automatically recovered: the next tick backfills every missing hour as a stored `MeasurementLog` point, so the chart never shows a gap.

### CO₂ pressure accounting

The display PSI is `max(0, psi_cumulative - psi_released)`. When a user logs a "CO₂ release" event (burping a jar, venting a keg), `psi_released` is incremented by the current display value. The next tick continues accumulating from zero on a new trajectory — the same physics, restarted from the post-release pressure — exactly mirroring what happens physically when gas is vented.

### Strain-aware parameters

Each project resolves a yeast strain from its `ProjectYeastConnection`. The strain lookup cascades: exact `strain_code` match → name substring match → `yeast_type` default → global fallback (`US-05`). Fifteen real yeast strains are parameterized with measured `μ_max`, `K_s`, `Y_xs`, `Y_co2`, `X_max`, and `T_opt` values sourced from fermentation science literature (e.g. Boulton & Quain, White & Zainasheff). Two SCOBY strains model green-tea Jun and classic black-tea kombucha separately.

---

## 6. The Journey

### What was harder than expected

**Timezone arithmetic** was a consistent source of subtle bugs. The frontend converts the user's preferred reminder time to UTC before sending it to the API. The backend stores and schedules in UTC throughout. Adding "display in Eastern time" for email notifications required carefully isolating the conversion to a single `_fmt_time()` helper — every earlier attempt at converting earlier in the pipeline introduced double-conversion bugs where reminders would fire 4–5 hours off or not at all.

**Separating simulation writes from user reads** was not anticipated at the start. Once the CER background task began writing thousands of rows per day into `measurement_logs`, every dashboard query started returning machine-generated data mixed with the user's three carefully logged readings. Adding `_USER_MEAS_FILTER` cleanly solved it, but it required going back and auditing every query in the codebase.

**The background task resilience problem** emerged in production: a single database hiccup during a reminder check would kill the asyncio coroutine permanently (because `db = SessionLocal()` was outside the `try` block). The fix — moving session creation inside `try`, wrapping each project iteration in its own exception handler, and catching unhandled exceptions in the outer loop — turned a fragile task into one that survives transient DB errors.

### What was easier than expected

**FastAPI + SQLAlchemy** made adding new endpoints fast. Pydantic schemas provided free request validation and clear error messages. The combination meant new features (explore feed, comment threads, share links) took hours rather than days.

**Supabase Storage** for photo uploads required minimal backend work — the frontend uploads directly to the bucket using the anon key and returns a URL. The backend stores only the string. No file-handling code on the server.

### AI-assisted development

Claude Code was used throughout the project for implementation, schema design, debugging, and aesthetics. It was most helpful for tracing bugs when managing multiple files (friendship relationships; yeast, recipe, project relationships), generating the ORM query patterns for the social graph visibility filter, and web scraping for the yeast and recipes libraries. 

It had difficulty in judgement call for the complexity component, as it was not able to fully grasp the live simulation behavior and how it was supposed to run. It required specific information on how the graph must behave online and offline, how the graph should look (axis, sectioning custom time intervals), and needed explanations on why the live behavior was incorrect.

---

## 7. Scaling to 1 Million Active Users

### Current bottlenecks

The single Railway instance runs the API, the CER simulation loop, and the reminder loop in one process. The PostgreSQL instance on Supabase handles all reads and writes. Both become constraints at scale.

### Evolution path

**Database layer**
- Move to a connection pool manager (PgBouncer) in front of PostgreSQL immediately. SQLAlchemy's default pool is insufficient under concurrent load.
- Add read replicas. The Explore feed, public project views, and profile pages are all read-heavy and can be served from replicas. Only writes (measurements, notes, likes) need the primary.
- Partition `measurement_logs` by `project_id` or time range. At 1M users with dozens of active projects each, this table becomes the largest by far. Partitioning keeps index sizes manageable and enables archiving old data to cheaper storage.
- Add a Redis cache in front of the Explore feed and yeast library. These are shared reads with low write frequency — ideal candidates.

**Application layer**
- Separate the CER simulation and reminder background tasks into dedicated worker processes (Celery workers backed by Redis or RabbitMQ). This removes them from the API process and makes both independently scalable.
- Horizontally scale the FastAPI API behind a load balancer. The API is already stateless (JWT auth, no in-process session state) so this requires no code changes.
- Move reminder scheduling to a proper task queue with at-least-once delivery guarantees (e.g. Celery + Redis Streams). The current asyncio loop can miss a window if the process restarts mid-minute.

**Storage and CDN**
- Photo uploads already go to Supabase Storage. At scale, put a CDN (Cloudflare, AWS CloudFront) in front of the storage bucket so image loads do not hit the origin for every request.
- For the CO₂ chart, consider downsampling old measurement points server-side before sending them to the client. A project with two years of 60-second readings would have ~1M rows; the chart only renders ~300 pixels wide.

**Schema changes**
- Add a `(project_id, logged_at DESC)` composite index on `measurement_logs` if not already present — this is the primary access pattern for chart queries and becomes critical at scale.
- Add a partial index on `fermentation_projects (created_at DESC) WHERE visibility = 'everyone'` to serve the Explore feed without a full table scan.
- Denormalize like counts into `fermentation_projects.like_count` and update it via triggers or application-level increments to avoid `COUNT(*)` aggregations on the hot feed path.
