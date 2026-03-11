from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import Base, engine
from app.api.routes import auth, users, projects, yeasts, recipes, calculations, lookup

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Fizz Bizz API",
    description="Fermentation Management Platform — track kombucha, beer, kimchi & more.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(yeasts.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(calculations.router, prefix="/api")
app.include_router(lookup.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "🫧 Fizz Bizz API is running!", "docs": "/api/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
