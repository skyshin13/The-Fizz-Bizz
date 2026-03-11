# 🫧 Fizz Bizz — Fermentation Management Studio

A full-stack fermentation management platform for homebrewers, kombucha makers, and fermented food enthusiasts.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Python (managed via `uv`) |
| API Framework | FastAPI |
| ORM & Migrations | SQLAlchemy + Alembic |
| Authentication | JWT (local) / Supabase (production) |
| Database (local) | SQLite (zero config!) |
| Database (prod) | PostgreSQL via Supabase |
| Frontend | React + TypeScript + Vite |
| Hosting (server) | Railway |
| Hosting (client) | Vercel |
| SMS Reminders | Twilio |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- `uv` (Python package manager)

### 1. Clone & setup

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
uv sync
uv run python -m app.db.seed  # Seeds demo data
uv run uvicorn app.main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**
API Docs (Swagger): **http://localhost:8000/api/docs**

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

## 🔑 Demo Login

```
Email:    brewer@fizzbizz.com
Password: password123
```

The seed script populates:
- **4 fermentation projects** (kombucha, APA beer, ginger soda, kimchi)
- **Historical measurement data** with pH, SG, ABV, CO2 readings
- **5 yeast/SCOBY strain profiles** (White Labs WLP001, Safale US-05, SCOBY, EC-1118, Ginger Bug)
- **2 starter recipes** (Classic Kombucha, Ginger Probiotic Soda)
- **Observation notes** on projects

---

## 📁 Project Structure

```
fizz-bizz/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Auth dependency injection
│   │   │   └── routes/
│   │   │       ├── auth.py          # Register / Login
│   │   │       ├── users.py         # User profile
│   │   │       ├── projects.py      # Projects + measurements + observations
│   │   │       ├── yeasts.py        # Yeast strain library
│   │   │       ├── recipes.py       # Recipe library
│   │   │       └── calculations.py  # ABV, priming sugar, CO2 analysis
│   │   ├── core/
│   │   │   ├── config.py            # Settings (env vars)
│   │   │   └── security.py          # JWT + bcrypt
│   │   ├── db/
│   │   │   ├── database.py          # SQLAlchemy engine + session
│   │   │   └── seed.py              # Demo data seeder
│   │   ├── models/
│   │   │   └── models.py            # All SQLAlchemy ORM models
│   │   ├── schemas/
│   │   │   └── schemas.py           # All Pydantic schemas
│   │   ├── services/
│   │   │   └── calculations.py      # ABV formula, priming sugar, CO2 analysis
│   │   └── main.py                  # FastAPI app entry point
│   ├── .env                         # Local environment (SQLite)
│   ├── .env.example                 # Template for production
│   ├── pyproject.toml               # uv/Python dependencies
│   └── alembic.ini                  # Alembic migrations config
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── layout/
    │   │       ├── Layout.tsx       # Sidebar + main layout
    │   │       └── Layout.module.css
    │   ├── hooks/
    │   │   └── useAuth.tsx          # Auth context + hooks
    │   ├── lib/
    │   │   └── api.ts               # Axios client with auth interceptors
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── RegisterPage.tsx
    │   │   ├── DashboardPage.tsx    # Overview with stats
    │   │   ├── ProjectsPage.tsx     # Project list + create modal
    │   │   ├── ProjectDetailPage.tsx # Charts + measurement logging
    │   │   ├── YeastsPage.tsx       # Yeast strain library
    │   │   ├── RecipesPage.tsx      # Recipe browser
    │   │   └── CalculatorsPage.tsx  # ABV + priming sugar calculators
    │   ├── types/
    │   │   └── index.ts             # TypeScript interfaces
    │   ├── App.tsx                  # Router setup
    │   ├── main.tsx                 # React entry point
    │   └── index.css                # Global styles + design tokens
    ├── index.html
    ├── vite.config.ts               # Vite + API proxy
    └── package.json
```

---

## 🧮 Core Entities & Features

### Implemented
- ✅ **Users** — Register, login, profile (JWT auth)
- ✅ **Fermentation Projects** — Create, track, manage across 12 types
- ✅ **Measurement Logs** — SG, pH, temperature, CO2, ABV (auto-calculated)
- ✅ **Observation Notes** — Timestamped notes with tags
- ✅ **Yeast Profiles** — Strain library with usage tracking
- ✅ **Recipes** — Starter recipes with ingredients and instructions
- ✅ **ABV Calculator** — Standard + high-gravity formula
- ✅ **Priming Sugar Calculator** — Multi-sugar-type, temp-adjusted
- ✅ **CO2 Activity Analysis** — Trend detection (stalling, ready to bottle, etc.)
- ✅ **Live Charts** — pH, SG, ABV, CO2 graphs via Recharts

### Wired but needs config
- 🔧 **Twilio SMS Reminders** — Set TWILIO_* env vars to enable
- 🔧 **Supabase Auth** — Set SUPABASE_* env vars for production
- 🔧 **Photo Uploads** — Models + routes ready; needs storage backend

---

## 🌐 Production Deployment

### Backend → Railway

1. Set environment variables in Railway:
   - `DATABASE_URL` (from Supabase → Settings → Database → Connection string)
   - `SECRET_KEY` (generate a random 64-char string)
   - `TWILIO_*` (optional, for SMS)
2. Railway detects Python automatically. It will use `pyproject.toml`.
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Frontend → Vercel

1. Set `VITE_API_URL` to your Railway backend URL
2. Update `vite.config.ts` proxy or set `baseURL` in `src/lib/api.ts`
3. Deploy: `vercel deploy`

---

## 🔌 API Reference

Full Swagger UI available at `/api/docs` when backend is running.

Key endpoints:
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Get JWT token
- `GET /api/projects` — List your projects
- `POST /api/projects` — Create project
- `POST /api/projects/{id}/measurements` — Log measurement
- `GET /api/yeasts` — Browse yeast library
- `GET /api/recipes` — Browse recipes
- `POST /api/calculations/abv` — Calculate ABV
- `POST /api/calculations/priming-sugar` — Calculate priming sugar
