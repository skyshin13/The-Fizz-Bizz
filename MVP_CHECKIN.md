# ECE 464: Databases — Final Project MVP Check-In

---

## 1. The Abstract

**Fizz Bizz** is a full-stack fermentation management platform for homebrewers, kombucha makers, and fermented-food hobbyists. Users create fermentation projects, log timestamped sensor measurements (specific gravity, pH, temperature, CO₂ pressure), and receive analytical feedback on fermentation health. The application also provides a shared yeast-strain library, starter recipes, biochemical calculators, and a social layer for discovering and following other brewers' public batches.

---

## 2. Current State of the Application

The following features are fully operational end-to-end:

- **Database deployed and accessible** — PostgreSQL via Supabase is live with real project data. SQLite is used locally for development.
- **JWT authentication** — register and login endpoints issue signed tokens; all project and user routes are protected behind a `get_current_user` dependency.
- **Full CRUD on core tables** — users, fermentation projects, measurement logs, observation notes, yeast profiles, and recipes are all readable, creatable, updatable, and deletable through REST endpoints documented in the Swagger UI (`/api/docs`). These tables are also relational in practice: when a user adds a yeast strain to a project, that connection is recorded and reflected in the yeast library, showing which projects have used that strain.
- **Frontend connected to API** — the React/TypeScript SPA communicates with the FastAPI backend through an Axios client with JWT interceptors. Pages include: Dashboard, Projects, Project Detail, Yeasts, Recipes, Calculators, Explore, and Profile.
- **Live measurement charts** — Project Detail renders time-series graphs (pH, specific gravity, ABV, CO₂) using Recharts, with data fetched from the API on load.
- **Fermentation calculators** — ABV (standard and high-gravity formula), priming sugar (multi-sugar-type, temperature-adjusted dissolved-CO₂ correction), and CO₂ trend analysis (linear regression on recent readings to classify fermentation as active, stalling, ready-to-bottle, or ready-to-burp) are all working.
- **Friendship / social schema** — the `friendships` table and the `/api/friends` and `/api/explore` routes are wired; public project discovery is functional through the Explore page.

---

## 3. Schema & Architecture Check-In

**13 tables** are implemented and tracked through Alembic:

| Table | Purpose |
|---|---|
| `users` | Accounts with optional Supabase ID for production auth |
| `fermentation_projects` | Core entity; 12 fermentation type variants via Enum |
| `measurement_logs` | SG, pH, temperature, CO₂, Brix, calculated ABV |
| `observation_notes` | Timestamped notes with a JSON `tags` column |
| `project_photos` | URLs for batch photos (storage backend TBD) |
| `reminders` | SMS/in-app reminders with `interval_hours` scheduling |
| `yeast_profiles` | Strain library; scraped and enriched from lab websites |
| `project_yeast_connections` | Many-to-many between projects and yeast strains |
| `recipes` | Starter recipes linked to projects |
| `recipe_ingredients` | Normalized ingredient list with quantity/unit |
| `friendships` | Bidirectional friend requests with PENDING/ACCEPTED status |
| `fermentation_type_configs` | DB-driven metadata (emoji, color) for the 12 types |
| `sugar_types` | Lookup table for priming sugar calculator options |

**Four Alembic migrations** have been applied: initial schema (March 11), social features (friendships), `best_for` field on yeasts, and lab-enrichment columns.

The `yeast_profiles` table is populated by two scrapers rather than hand-entered data: `scrape_yeasts.py` pulls hundreds of commercial strains from brewunited.com, and `scrape_labs.py` then enriches each strain with official descriptions and recommended styles scraped directly from the White Labs, Wyeast, and Fermentis websites.

No major relational bottlenecks have been encountered. Foreign keys and unique indexes are in place on high-lookup columns (`users.email`, `users.username`, `yeast_profiles.strain_code`). One anticipated indexing need: `measurement_logs.project_id` combined with `logged_at` for time-series queries will likely need a composite index before production load testing.

---

## 4. The Pivot

Two significant deviations from the original proposal:

**1. Complexity Component: CER Simulation Engine instead of ML predictions.**
The original proposal outlined an ML-based fermentation outcome predictor. This was replaced with a deterministic **CO₂ Evolution Rate (CER) simulation engine** (`cer_engine.py`), which models yeast growth through lag, exponential, stationary, and decline phases using Monod saturation kinetics. The engine carries a 30-strain library (ale, lager, wheat, wine, saison, wild) with per-strain biophysical parameters (μ_max, X₀, X_max, ethanol tolerance, temperature range). A bell-curve temperature response function and Embden–Meyerhof stoichiometry (0.51 g ethanol per g sugar consumed) are applied at each simulation step. This pivot was taken because the CER model produces deterministic, interpretable outputs without requiring labeled training data, and it is directly grounded in the domain science rather than a black box.

**2. Local-first development with SQLite.**
The proposal assumed Supabase/PostgreSQL from day one. The actual build uses SQLite locally (zero-config, no Docker required) with the Supabase PostgreSQL connection string dropped in via `DATABASE_URL` for production. SQLAlchemy's dialect abstraction made this seamless, and Alembic migrations work identically against both backends.

---

## 5. Blockers & Next Steps

**Current blockers:**

- **Photo storage** — `ProjectPhoto` and `ObservationNote.photo_url` models and routes are wired, but no storage backend is configured. Supabase Storage buckets or S3-compatible hosting needs to be set up before photo upload is usable.
- **Twilio SMS scheduling** — `Reminder` rows are being written to the database, but the background job that polls `next_trigger_at` and dispatches SMS via Twilio does not exist yet. A simple polling loop or APScheduler task inside FastAPI startup needs to be added.
- **CER frontend integration** — The CER simulator is live on the Calculators page and fully functional. A stretch goal is surfacing it contextually inside Project Detail, pre-filled with the project's strain and batch parameters.
- **Production deployment** — Railway (backend) and Vercel (frontend) are configured but the live deployment has not been validated end-to-end with the Supabase PostgreSQL connection string yet.

**Next milestones before the final presentation:**

1. Wire the Twilio background job for SMS reminders.
2. Surface the CER simulator contextually inside Project Detail, pre-filled with project data.
3. Stand up the Railway + Vercel + Supabase production environment and validate end-to-end.
4. Add a composite index on `(measurement_logs.project_id, logged_at)` to optimize time-series chart queries at scale.
