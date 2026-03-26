"""
One-off script: adds the "Hazy IPA — Live Batch" demo project.
Run from the backend directory:  python add_live_beer_project.py
"""
from app.db.database import SessionLocal
from app.models.models import FermentationProject, MeasurementLog, ObservationNote, User
from app.models.models import FermentationType, ProjectStatus
from datetime import datetime, timedelta

db = SessionLocal()

# Check it doesn't already exist
existing = db.query(FermentationProject).filter_by(name="Hazy IPA — Live Batch").first()
if existing:
    print(f"Project already exists (id={existing.id}). Nothing to do.")
    db.close()
    exit()

user = db.query(User).first()
if not user:
    print("No user found — run the main seed first.")
    db.close()
    exit()

now = datetime.utcnow()

project = FermentationProject(
    user_id=user.id,
    name="Hazy IPA — Live Batch",
    fermentation_type=FermentationType.BEER,
    status=ProjectStatus.ACTIVE,
    description="A juicy New England-style IPA loaded with Citra and Mosaic hops. Pitched US-05 at high krausen temperatures for a soft, hazy finish. This batch is actively fermenting — CO₂ data updates live.",
    batch_size_liters=19.0,
    start_date=now - timedelta(hours=2),
    target_end_date=now + timedelta(days=12),
    initial_gravity=1.062,
    initial_ph=5.3,
    fermentation_temp_celsius=20,
    vessel_type="6.5-gallon glass carboy",
)
db.add(project)
db.flush()

db.add(MeasurementLog(
    project_id=project.id,
    logged_at=now - timedelta(hours=2),
    specific_gravity=1.062, ph=5.3, temperature_celsius=20.0, co2_psi=0.0
))
db.add(MeasurementLog(
    project_id=project.id,
    logged_at=now - timedelta(hours=1),
    specific_gravity=1.061, ph=5.3, temperature_celsius=20.1, co2_psi=0.2
))
db.add(ObservationNote(
    project_id=project.id, user_id=user.id,
    content="Brew day complete. OG landed at 1.062 — right on target. Pitched US-05 dry into the carboy. Watching the CO₂ curve closely.",
    tags=["brew-day", "gravity"],
    created_at=now - timedelta(hours=2)
))

db.commit()
print(f"Created 'Hazy IPA — Live Batch' (id={project.id})")
db.close()
