# Fizz Bizz — Fermentation Management Studio

A full-stack fermentation tracking platform for homebrewers, kombucha makers, and fermented food enthusiasts. Log measurements, track CO₂ activity, set reminders, share projects, and connect with other fermenters.

## Live Application

**https://the-fizz-bizz.vercel.app/**

## Demo Video

**https://cooperunion-my.sharepoint.com/:v:/g/personal/skyler_shin_cooper_edu/IQCQhBdaYjYeRLxr1SM6pCPEAURiq6B0yuq-fdyoNPL8d-U?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=9aYTBb**

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Framework | FastAPI (Python 3.12) |
| ORM | SQLAlchemy 2.0 |
| Auth | Supabase JWT (production) / local JWT (dev) |
| Database — local | SQLite |
| Database — prod | PostgreSQL via Supabase |
| File Storage | Supabase Storage |
| Frontend | React + TypeScript + Vite |
| Charts | Recharts |
| Backend hosting | Railway (Docker) |
| Frontend hosting | Vercel |
| Email reminders | SendGrid |
| SMS reminders | Twilio |

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Clone

```bash
git clone <repo>
cd fizz-bizz
```

### 2. Start the Backend

```bash
cd backend
chmod +x start.sh
./start.sh
```

Or manually:

```bash
cd backend
pip install .
python -m app.db.seed
uvicorn app.main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**
API docs (Swagger): **http://localhost:8000/api/docs**

### 3. Start the Frontend

In a new terminal:

```bash
cd frontend
chmod +x start.sh
./start.sh
```

Or manually:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Features

### Projects
- 12 fermentation types: kombucha, beer, wine, mead, cider, kimchi, water kefir, milk kefir, lacto-fermentation, probiotic soda, alcohol brewing, general
- Log measurements: pH, specific gravity, temperature, CO₂ PSI, ABV (auto-calculated), Brix
- Observation notes with photo attachments
- Photo album per project
- Project visibility: public, friends-only, or private
- Share link for non-logged-in viewers
- Mark projects complete with final gravity entry

### CO₂ Modeling (CER Engine)
- Live background simulation models CO₂ pressure over time using yeast strain kinetics
- Strain-specific parameters (US-05, WLP001, EC-1118, W-34/70, SCOBY strains, and more)
- Automatically backfills simulation data across server restarts
- CO₂ PSI alert reminders trigger when live pressure hits a user-defined threshold

### Reminders
- Scheduled email and/or SMS reminders per project (pH check, gravity check, general check-in)
- Preferred time-of-day support with timezone conversion
- CO₂ PSI threshold alerts
- Confirmation email on reminder creation

### Social
- Explore feed: browse public projects by fermentation type, status, or search
- Like and comment on public projects (threaded replies)
- Friend requests: auto-follow on request, mutual follow on accept; requester stays as follower after unfriend
- Public user profiles with project and activity feeds; followers/following lists on each profile
- Friend activity feed showing recent likes and comments

### Yeast Library
- Searchable strain database with attenuation, flocculation, temperature range, alcohol tolerance
- Link strains to projects and recipes
- Automatic yeast matching from recipe ingredients

### Recipes
- Community recipe browser with ingredients, instructions, and tips
- Difficulty, batch size, estimated duration
- Link yeast profiles to ingredients

### Calculators
- ABV (standard + high-gravity Brix correction)
- Priming sugar (multi-sugar-type, temperature-adjusted)
- CO₂ activity trend analysis

---

## Project Structure

```
fizz-bizz/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py                  # Auth dependency injection
│   │   │   └── routes/
│   │   │       ├── auth.py              # Register / login
│   │   │       ├── users.py             # User profile + avatar
│   │   │       ├── projects.py          # Projects, measurements, observations, likes, comments
│   │   │       ├── explore.py           # Public feed, search, share links
│   │   │       ├── friends.py           # Friend requests + follow management
│   │   │       ├── reminders.py         # Scheduled reminders
│   │   │       ├── yeasts.py            # Yeast strain library
│   │   │       ├── recipes.py           # Recipe library
│   │   │       ├── calculations.py      # ABV, priming sugar, CO₂ analysis
│   │   │       └── lookup.py            # Fermentation types + sugar types
│   │   ├── core/
│   │   │   ├── config.py                # Settings (env vars via pydantic-settings)
│   │   │   └── security.py              # Supabase JWT verification
│   │   ├── db/
│   │   │   ├── database.py              # SQLAlchemy engine + session
│   │   │   └── seed.py                  # Demo data seeder
│   │   ├── models/
│   │   │   └── models.py                # All SQLAlchemy ORM models
│   │   ├── schemas/
│   │   │   └── schemas.py               # All Pydantic v2 schemas
│   │   ├── services/
│   │   │   ├── cer_engine.py            # CO₂ production kinetics model
│   │   │   ├── live_cer_task.py         # Background CER simulation loop
│   │   │   ├── reminder_task.py         # Background reminder firing loop
│   │   │   ├── sendgrid_service.py      # Email delivery
│   │   │   ├── twilio_service.py        # SMS delivery
│   │   │   └── yeast_matcher.py         # Recipe ingredient → yeast profile linker
│   │   └── main.py                      # FastAPI app, lifespan, background tasks
│   ├── Dockerfile
│   ├── docker_start.sh                  # Entrypoint: runs uvicorn with $PORT expansion
│   ├── pyproject.toml                   # Python dependencies
│   └── railway.toml                     # Railway deployment config
│
└── frontend/
    ├── src/
    │   ├── components/layout/
    │   │   ├── Layout.tsx               # Sidebar + main layout
    │   │   └── Layout.module.css
    │   ├── hooks/
    │   │   ├── useAuth.tsx              # Supabase auth context
    │   │   └── useLookups.ts            # Fermentation type / sugar type lookups
    │   ├── lib/
    │   │   └── api.ts                   # Axios client with auth interceptors
    │   ├── pages/
    │   │   ├── DashboardPage.tsx
    │   │   ├── ProjectsPage.tsx
    │   │   ├── ProjectDetailPage.tsx    # Charts, logs, album, reminders, community
    │   │   ├── PublicProjectViewPage.tsx
    │   │   ├── ShareProjectPage.tsx     # Unauthenticated share view
    │   │   ├── ExplorePage.tsx
    │   │   ├── ProfilePage.tsx
    │   │   ├── YeastsPage.tsx
    │   │   ├── RecipesPage.tsx
    │   │   ├── CalculatorsPage.tsx
    │   │   ├── LoginPage.tsx
    │   │   └── RegisterPage.tsx
    │   ├── types/
    │   │   └── index.ts                 # TypeScript interfaces
    │   ├── App.tsx                      # Router setup
    │   ├── main.tsx                     # React entry point
    │   └── index.css                    # Global styles + CSS variables
    ├── vite.config.ts
    ├── railway.toml                     # Railway deployment config
    └── package.json
```

---

## Production Deployment

Both services deploy automatically from the `main` branch via Railway.

### Backend (Railway — Docker)

Environment variables required in Railway dashboard:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/service key |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase dashboard |
| `SENDGRID_API_KEY` | SendGrid API key for email |
| `SENDGRID_FROM_EMAIL` | Verified sender address |
| `TWILIO_ACCOUNT_SID` | Twilio account SID (optional) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token (optional) |
| `TWILIO_PHONE_NUMBER` | Twilio sending number (optional) |

### Frontend (Vercel / Railway)

Environment variable required:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend Railway URL |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

---

## API Reference

Full Swagger UI at `/api/docs` when backend is running.

```
Auth
  POST   /api/auth/register
  POST   /api/auth/login

Projects
  GET    /api/projects
  POST   /api/projects
  GET    /api/projects/{id}
  PATCH  /api/projects/{id}
  DELETE /api/projects/{id}
  GET    /api/projects/{id}/public
  POST   /api/projects/{id}/measurements
  POST   /api/projects/{id}/observations
  POST   /api/projects/{id}/like
  DELETE /api/projects/{id}/like
  GET    /api/projects/{id}/comments
  POST   /api/projects/{id}/comments
  DELETE /api/projects/{id}/comments/{comment_id}

Reminders
  GET    /api/projects/{id}/reminders
  POST   /api/projects/{id}/reminders
  PATCH  /api/reminders/{id}
  DELETE /api/reminders/{id}

Explore
  GET    /api/explore/feed
  GET    /api/explore/search
  GET    /api/explore/share/{id}

Friends
  GET    /api/friends
  POST   /api/friends/request/{username}
  POST   /api/friends/accept/{friendship_id}
  DELETE /api/friends/{friendship_id}

Users
  GET    /api/users/me
  PATCH  /api/users/me
  GET    /api/users/{username}
  GET    /api/users/{username}/followers
  GET    /api/users/{username}/following

Yeasts
  GET    /api/yeasts
  POST   /api/yeasts
  GET    /api/yeasts/{id}
  PATCH  /api/yeasts/{id}

Recipes
  GET    /api/recipes
  POST   /api/recipes
  GET    /api/recipes/{id}

Calculators
  POST   /api/calculations/abv
  POST   /api/calculations/priming-sugar
  POST   /api/calculations/co2-analysis
```
