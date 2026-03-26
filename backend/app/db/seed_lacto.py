"""
Import 3% salt lacto-fermentation projects from the pH chart spreadsheet.
Run from the backend folder: python -m app.db.seed_lacto
"""
from app.db.database import SessionLocal, engine
from app.models.models import Base, User, FermentationProject, MeasurementLog, ObservationNote
from app.models.models import FermentationType, ProjectStatus
from datetime import datetime, timezone

# ── Date constants ─────────────────────────────────────────────────────────────
# Week 1 starts March 2, 2026
W1D1 = datetime(2026, 3, 2, 9, 0, 0, tzinfo=timezone.utc)   # start date

def day(n: int) -> datetime:
    """Day N of the full run, 1-indexed, measured at 10am UTC."""
    from datetime import timedelta
    return datetime(2026, 3, 2, 10, 0, 0, tzinfo=timezone.utc) + timedelta(days=n - 1)

# pH measurement dates from the spreadsheet
W1D6 = day(6)   # March 7
W2D6 = day(13)  # March 14  (Week 2, Day 6 = overall Day 13)
W3D6 = day(20)  # March 21  (Week 3, Day 6 = overall Day 20)
W3D7 = day(21)  # March 22  (Week 3, Day 7 = overall Day 21)

# ── Project definitions ─────────────────────────────────────────────────────────
# Each entry: (name, description, ph_readings, observations)
# ph_readings: list of (datetime, ph_value)
# observations: list of (datetime, content, tags)

PROJECTS = [
    {
        "name": "3% Salt Lacto-Fermented Beets",
        "description": "Whole sliced beets in a 3% salt brine. Targeting a deep, earthy tang with natural lacto cultures.",
        "vessel_type": "1-quart mason jar",
        "batch_size_liters": 0.95,
        "ph_readings": [
            (W1D6, 6.0),
            (W2D6, 5.0),
            (W3D6, 4.0),
            (W3D7, 3.5),
        ],
        "observations": [
            (W1D6, "Day 6 check: brine is slightly cloudy — good sign of active lacto bacteria. Beets have taken on a deeper purple hue. Smell is earthy and mildly sour. pH at 6.0, fermentation well underway.", ["appearance", "ph", "aroma"]),
            (W2D6, "Day 13 check: sourness is noticeably stronger. Brine is fully opaque and fizzing gently when jar is opened. Beets are softer. pH dropped to 5.0 — solid acidification progress.", ["taste", "ph", "activity"]),
            (W3D6, "Day 20 check: flavor is distinctly tangy and pleasant. No off-smells. pH at 4.0, solidly in the safe lacto zone. Considering moving to fridge soon.", ["taste", "ph"]),
            (W3D7, "Day 21 final check: pH reached 3.5 — nicely acidified. Flavor is bright and sour with earthy beet sweetness underneath. Transferring to cold storage.", ["taste", "ph", "completed"]),
        ],
    },
    {
        "name": "3% Salt Lacto-Fermented Carrots",
        "description": "Carrot sticks in a 3% salt brine. Great crunch retention expected with lacto fermentation.",
        "vessel_type": "1-quart mason jar",
        "batch_size_liters": 0.95,
        "ph_readings": [
            (W1D6, 6.0),
            (W2D6, 5.0),
            (W3D6, 4.5),
            (W3D7, 4.0),
        ],
        "observations": [
            (W1D6, "Day 6 check: brine turned cloudy with small bubbles clinging to the carrot sticks. Fresh, slightly sour scent. pH at 6.0, fermentation is active.", ["appearance", "ph", "aroma"]),
            (W2D6, "Day 13 check: carrots have softened slightly but still have a good snap. Flavor is pleasantly sour. pH at 5.0, continuing to acidify well.", ["taste", "ph"]),
            (W3D6, "Day 20 check: nice tangy flavor, still crunchy. Brine is fully opaque. pH at 4.5 — well into sour territory. Texture holding up better than expected.", ["taste", "ph", "appearance"]),
            (W3D7, "Day 21 final check: pH at 4.0. Flavor is bold and sour with natural sweetness still present. Great result — moving to cold storage.", ["taste", "ph", "completed"]),
        ],
    },
    {
        "name": "3% Salt Lacto-Fermented Red Onions",
        "description": "Sliced red onions in a 3% salt brine. Expect a sharp, tangy result with vibrant color.",
        "vessel_type": "1-quart mason jar",
        "batch_size_liters": 0.95,
        "ph_readings": [
            (W1D6, 5.5),
            (W2D6, 4.0),
            (W3D6, 4.0),
            (W3D7, 3.5),
        ],
        "observations": [
            (W1D6, "Day 6 check: brine has turned a vivid pink-magenta from the onion pigment. Mildly tangy smell. pH at 5.5 — red onions are acidifying faster than expected.", ["appearance", "ph", "aroma"]),
            (W2D6, "Day 13 check: strong sour punch on the nose. Onions are translucent and fully saturated with brine. pH at 4.0 — impressive drop. Flavor is sharp and tangy.", ["taste", "ph"]),
            (W3D6, "Day 20 check: pH holding at 4.0, stabilizing. Flavor is complex — sour, slightly sweet, with that characteristic onion bite mellowed by fermentation.", ["taste", "ph"]),
            (W3D7, "Day 21 final check: pH at 3.5, fully acidified. Gorgeous color, excellent flavor. Moving to fridge — these will be great on tacos.", ["taste", "ph", "completed"]),
        ],
    },
    {
        "name": "3% Salt Lacto-Fermented Jalapeños",
        "description": "Sliced jalapeños in a 3% salt brine. Targeting a tangy, funky heat with softened pepper flavor.",
        "vessel_type": "1-quart mason jar",
        "batch_size_liters": 0.95,
        "ph_readings": [
            (W1D6, 5.5),
            (W2D6, 5.0),
            (W3D6, 4.5),
            (W3D7, 4.0),
        ],
        "observations": [
            (W1D6, "Day 6 check: brine is lightly cloudy. Heat is still present but already slightly mellowed. Tangy aroma coming through nicely. pH at 5.5, fermentation is active.", ["appearance", "ph", "aroma"]),
            (W2D6, "Day 13 check: brine fully opaque, lots of small CO2 bubbles. Pepper flavor is sour and funky with lingering heat. pH at 5.0, acidifying steadily.", ["taste", "ph", "activity"]),
            (W3D6, "Day 20 check: the heat is nicely tamed by the sourness. Complex flavor — tangy, vegetal, with a warm finish. pH at 4.5.", ["taste", "ph"]),
            (W3D7, "Day 21 final check: pH at 4.0. Excellent fermented pepper flavor. These will be great on eggs or in hot sauce. Cold storage.", ["taste", "ph", "completed"]),
        ],
    },
    {
        "name": "3% Salt Lacto-Fermented Radish",
        "description": "Sliced radishes in a 3% salt brine. Expecting a crunchy, peppery, and sour result.",
        "vessel_type": "1-quart mason jar",
        "batch_size_liters": 0.95,
        "ph_readings": [
            (W1D6, 6.0),
            (W2D6, 4.5),
            (W3D6, 4.0),
            (W3D7, 3.5),
        ],
        "observations": [
            (W1D6, "Day 6 check: brine is hazy with active fermentation. Radishes have turned from bright red to pale pink, releasing their pigment. Peppery and sour aroma. pH at 6.0.", ["appearance", "ph", "aroma"]),
            (W2D6, "Day 13 check: big pH drop to 4.5 — radishes are fermenting aggressively. Flavor is sharp, peppery, and tangy. Excellent crunch retained so far.", ["taste", "ph"]),
            (W3D6, "Day 20 check: pH at 4.0. Taste is well-balanced — sour with peppery bite. Radishes have softened a touch but still satisfyingly crunchy.", ["taste", "ph"]),
            (W3D7, "Day 21 final check: pH at 3.5. Fantastic result. Deeply sour and crunchy. Ready for cold storage.", ["taste", "ph", "completed"]),
        ],
    },
]


def seed_lacto():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Find the first user to assign the projects to
    user = db.query(User).first()
    if not user:
        print("No users found in the database. Please register an account first, then run this script.")
        db.close()
        return

    print(f"Creating projects for user: {user.email} (id={user.id})")

    # Avoid duplicates if script is run more than once
    existing_names = {row.name for row in db.query(FermentationProject.name).filter_by(user_id=user.id).all()}

    for p in PROJECTS:
        if p["name"] in existing_names:
            print(f"  Skipping (already exists): {p['name']}")
            continue
        project = FermentationProject(
            user_id=user.id,
            name=p["name"],
            fermentation_type=FermentationType.LACTO_FERMENTATION,
            status=ProjectStatus.ACTIVE,
            description=p["description"],
            batch_size_liters=p["batch_size_liters"],
            vessel_type=p["vessel_type"],
            start_date=W1D1,
            initial_ph=p["ph_readings"][0][1],
            is_public=False,
        )
        db.add(project)
        db.flush()

        # pH measurements
        for ts, ph in p["ph_readings"]:
            db.add(MeasurementLog(
                project_id=project.id,
                logged_at=ts,
                ph=ph,
            ))

        # Observation notes
        for ts, content, tags in p["observations"]:
            db.add(ObservationNote(
                project_id=project.id,
                user_id=user.id,
                content=content,
                tags=tags,
                created_at=ts,
            ))

        print(f"  Created: {p['name']}")

    db.commit()
    db.close()
    print("\nAll 5 lacto-fermentation projects imported successfully!")


if __name__ == "__main__":
    seed_lacto()
