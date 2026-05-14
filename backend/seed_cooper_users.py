"""
Add two public projects for abigail.lin@cooper.edu and michelle.liang@cooper.edu.
Run from backend/: python seed_cooper_users.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", open(".env").read().split("DATABASE_URL=")[1].split("\n")[0].strip())

from datetime import datetime, timedelta, timezone
from app.db.database import SessionLocal
from app.models.models import User, FermentationProject, MeasurementLog, ObservationNote

NOW = datetime.now(timezone.utc)

PROJECTS = {
    "abigail.lin@cooper.edu": [
        {
            "name": "Passionfruit Mango Kombucha 2F",
            "fermentation_type": "kombucha",
            "status": "active",
            "description": "Second ferment of my GT's-style black tea kombucha with freeze-dried passionfruit and fresh mango chunks. Targeting that tropical punch flavour.",
            "batch_size_liters": 3.0,
            "fermentation_temp_celsius": 24.0,
            "initial_ph": 7.0,
            "days_ago": 6,
            "ph_series":  [7.0, 6.4, 5.8, 5.1, 4.5, 4.1],
            "co2_series": [0.0, 0.6, 1.9, 3.4, 5.5, 7.1],
            "notes": [
                ("Day 0: SCOBY hotel has been going strong for 3 months. Added passionfruit and mango — smells unreal already.", 6),
                ("Day 3: Deep golden-orange color coming in. Carbonation starting to build. Tastes tart with a hint of tropical.", 3),
            ],
        },
        {
            "name": "Strawberry Basil Shrub Soda",
            "fermentation_type": "probiotic_soda",
            "status": "completed",
            "description": "Fermented shrub-style soda using strawberries, fresh basil, and apple cider vinegar as a starter. Surprisingly complex and very refreshing.",
            "batch_size_liters": 1.5,
            "fermentation_temp_celsius": 22.0,
            "initial_ph": 5.8,
            "days_ago": 30,
            "ph_series":  [5.8, 5.3, 4.8, 4.3, 3.9],
            "co2_series": [0.0, 1.2, 3.0, 5.8, 8.1],
            "notes": [
                ("Bottled after 5 days. The basil really comes through — herbal and bright.", 22),
                ("Chilled one bottle overnight and opened it this morning. Perfect carbonation, zero explosions! 🍓", 20),
            ],
        },
    ],
    "michelle.liang@cooper.edu": [
        {
            "name": "Napa Cabbage Kimchi (Baechu-kimchi)",
            "fermentation_type": "kimchi",
            "status": "active",
            "description": "Classic whole-leaf kimchi with homemade gochugaru paste, salted shrimp, fish sauce, and a good amount of garlic. Salted for 12 hours before mixing.",
            "batch_size_liters": 4.0,
            "fermentation_temp_celsius": 20.0,
            "initial_ph": 6.1,
            "days_ago": 8,
            "ph_series":  [6.1, 5.7, 5.2, 4.8, 4.4, 4.1, 3.9, 3.8],
            "notes": [
                ("Day 0: Used 2 heads of napa cabbage (~3.5 kg salted). Paste came out deep red and spicy.", 8),
                ("Day 2: Already smelling funky and fermented. Moved to fridge to slow it down — prefer a slower, more complex ferment.", 6),
                ("Day 5: Tasted a leaf — perfect sourness starting. The garlic is really blooming.", 3),
            ],
        },
        {
            "name": "Honey Lavender Mead",
            "fermentation_type": "mead",
            "status": "active",
            "description": "Traditional mead using local wildflower honey with dried culinary lavender added at flameout. Using Lalvin 71B for a fruity ester profile. TOSNA nutrient additions.",
            "batch_size_liters": 4.5,
            "fermentation_temp_celsius": 21.0,
            "initial_gravity": 1.110,
            "initial_ph": 3.9,
            "days_ago": 22,
            "sg_series":  [1.110, 1.090, 1.068, 1.048, 1.030, 1.016, 1.008],
            "ph_series":  [3.9, 3.8, 3.8, 3.7, 3.7, 3.6, 3.6],
            "notes": [
                ("Day 0: OG 1.110. Rehydrated 71B with GoFerm. The honey and lavender aroma together is absolutely dreamy.", 22),
                ("Day 4: First TOSNA nutrient addition. Fermentation vigorous — smells like a meadery in here.", 18),
                ("Day 12: Gravity down to 1.048. ABV around 8.1% so far. Lavender is mellow but present — exactly what I wanted.", 10),
            ],
        },
    ],
}


def run():
    db = SessionLocal()
    try:
        for email, projects in PROJECTS.items():
            user = db.query(User).filter_by(email=email).first()
            if not user:
                print(f"  User not found: {email} — skipping")
                continue

            for pd in projects:
                existing = db.query(FermentationProject).filter_by(
                    user_id=user.id, name=pd["name"]
                ).first()
                if existing:
                    print(f"  Project already exists: '{pd['name']}' — skipping")
                    continue

                days_ago = pd["days_ago"]
                start = NOW - timedelta(days=days_ago)

                project = FermentationProject(
                    user_id=user.id,
                    name=pd["name"],
                    fermentation_type=pd["fermentation_type"],
                    status=pd["status"],
                    description=pd["description"],
                    batch_size_liters=pd.get("batch_size_liters", 4.0),
                    fermentation_temp_celsius=pd.get("fermentation_temp_celsius", 22.0),
                    initial_gravity=pd.get("initial_gravity"),
                    initial_ph=pd.get("initial_ph"),
                    start_date=start,
                    is_public=True,
                    visibility="everyone",
                )
                db.add(project)
                db.flush()

                series_lengths = [
                    len(pd.get("sg_series", [])),
                    len(pd.get("ph_series", [])),
                    len(pd.get("co2_series", [])),
                ]
                n = max(series_lengths) or 1
                for i in range(n):
                    interval = days_ago / max(n - 1, 1)
                    ts = start + timedelta(days=i * interval)
                    db.add(MeasurementLog(
                        project_id=project.id,
                        logged_at=ts,
                        specific_gravity=pd["sg_series"][i] if pd.get("sg_series") and i < len(pd["sg_series"]) else None,
                        ph=pd["ph_series"][i] if pd.get("ph_series") and i < len(pd["ph_series"]) else None,
                        co2_psi=pd["co2_series"][i] if pd.get("co2_series") and i < len(pd["co2_series"]) else None,
                        temperature_celsius=pd.get("fermentation_temp_celsius", 22.0),
                    ))

                for content, note_days_ago in pd.get("notes", []):
                    db.add(ObservationNote(
                        project_id=project.id,
                        user_id=user.id,
                        content=content,
                        tags=[],
                        created_at=NOW - timedelta(days=note_days_ago),
                    ))

                db.commit()
                print(f"  Created '{pd['name']}' for {email}")

    finally:
        db.close()
    print("Done.")


if __name__ == "__main__":
    run()
