"""
Seed demo community users and public projects for Explore page.
Run: python -m app.db.seed_demo_users
Safe to re-run — skips users that already exist by username.
"""
from app.db.database import SessionLocal, engine
from app.models.models import Base, User, FermentationProject, MeasurementLog, ObservationNote
from app.models.models import FermentationType, ProjectStatus
from app.core.security import get_password_hash
from datetime import datetime, timedelta
import random


def seed_demo_users():
    Base.metadata.create_all(bind=engine)

    # Apply any missing columns
    from sqlalchemy import text
    from app.db.database import engine as _engine
    with _engine.connect() as conn:
        for stmt in [
            "ALTER TABLE fermentation_projects ADD COLUMN IF NOT EXISTS sugar_amount_grams REAL",
            "ALTER TABLE fermentation_projects ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'",
        ]:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass
        conn.commit()

    db = SessionLocal()
    now = datetime.utcnow()

    DEMO_USERS = [
        {
            "email": "maya.brew@example.com",
            "username": "mayabrews",
            "display_name": "Maya Chen",
            "bio": "Kombucha obsessed. On my 47th batch and counting 🍵 Based in Portland.",
            "projects": [
                {
                    "name": "Blueberry Lavender Kombucha 2F",
                    "fermentation_type": FermentationType.KOMBUCHA,
                    "status": ProjectStatus.ACTIVE,
                    "description": "Second ferment with dried lavender buds and fresh blueberries. Going for a floral, fruity profile.",
                    "batch_size_liters": 3.8,
                    "days_ago": 5,
                    "ph_series": [7.1, 6.5, 5.9, 5.2, 4.7, 4.3],
                    "co2_series": [0.0, 0.5, 1.8, 3.2, 5.1, 6.8],
                    "notes": [
                        ("Day 1: SCOBY looks beautiful. Added 1 cup blueberries and 2 tbsp dried lavender.", 5),
                        ("Day 3: Gorgeous purple color coming through! Smells amazing.", 3),
                    ],
                },
                {
                    "name": "Jun Tea Batch #2",
                    "fermentation_type": FermentationType.KOMBUCHA,
                    "status": ProjectStatus.COMPLETED,
                    "description": "Jun tea using green tea and raw honey. Much lighter and delicate than regular kombucha.",
                    "batch_size_liters": 2.0,
                    "days_ago": 40,
                    "ph_series": [6.8, 6.1, 5.4, 4.8, 4.2],
                    "co2_series": [0.0, 1.0, 2.5, 4.0, 5.5],
                    "notes": [("Came out incredible — honey notes really shine through. Will definitely repeat!", 30)],
                },
            ],
        },
        {
            "email": "ferment.felix@example.com",
            "username": "fermentfelix",
            "display_name": "Felix Wagner",
            "bio": "German-style homebrewer living in Austin. Lagers, wheat beers, and the occasional sour.",
            "projects": [
                {
                    "name": "Hefeweizen — Classic Wheat",
                    "fermentation_type": FermentationType.BEER,
                    "status": ProjectStatus.ACTIVE,
                    "description": "Authentic Bavarian hefeweizen using WB-06 dry yeast. Targeting banana and clove esters.",
                    "batch_size_liters": 19.0,
                    "days_ago": 10,
                    "sg_series": [1.052, 1.040, 1.028, 1.018, 1.013, 1.011],
                    "ph_series": [5.3, 5.2, 5.1, 5.0, 4.9, 4.9],
                    "notes": [
                        ("Brew day! OG hit 1.052. Pitched WB-06 at 18°C.", 10),
                        ("Fermentation roaring — amazing banana aroma from the airlock!", 8),
                        ("Gravity dropping nicely. Sample tastes great already.", 5),
                    ],
                },
                {
                    "name": "Munich Dunkel",
                    "fermentation_type": FermentationType.BEER,
                    "status": ProjectStatus.COMPLETED,
                    "description": "Dark lager with rich malt character. Lagered for 6 weeks at 2°C. Came out silky smooth.",
                    "batch_size_liters": 19.0,
                    "days_ago": 75,
                    "sg_series": [1.054, 1.043, 1.032, 1.019, 1.013, 1.011, 1.011],
                    "ph_series": [5.4, 5.3, 5.2, 5.0, 4.9, 4.9, 4.8],
                    "notes": [("Absolutely nailed it. Entered in local homebrew comp — took second place!", 20)],
                },
            ],
        },
        {
            "email": "lacto.lisa@example.com",
            "username": "lactolisamakes",
            "display_name": "Lisa Park",
            "bio": "Fermentation witch 🧂 Kimchi, kvass, krauts, pickles — if it can ferment, I'll try it.",
            "projects": [
                {
                    "name": "Kkakdugi (Radish Kimchi)",
                    "fermentation_type": FermentationType.KIMCHI,
                    "status": ProjectStatus.ACTIVE,
                    "description": "Cubed daikon radish kimchi with gochugaru, fish sauce, and a good hit of garlic. Aged 3 days room temp then to the fridge.",
                    "batch_size_liters": 1.5,
                    "days_ago": 4,
                    "ph_series": [5.9, 5.5, 5.0, 4.6],
                    "notes": [
                        ("Day 0: Salted the radish for 2 hours. Perfect crunch.", 4),
                        ("Day 2: Smell is funky-good. Radish starting to get that nice kkakdugi bite.", 2),
                    ],
                },
                {
                    "name": "Garlic Dill Pickles",
                    "fermentation_type": FermentationType.LACTO_FERMENTATION,
                    "status": ProjectStatus.COMPLETED,
                    "description": "Classic brine-pickled cucumbers with fresh dill, garlic, and black peppercorns. 2% salt solution.",
                    "batch_size_liters": 1.0,
                    "days_ago": 21,
                    "ph_series": [6.5, 6.0, 5.3, 4.7, 4.2],
                    "notes": [("Perfect crunch, great sourness, super garlicky. This is THE pickle recipe.", 10)],
                },
                {
                    "name": "Water Kefir — Mango Passion",
                    "fermentation_type": FermentationType.WATER_KEFIR,
                    "status": ProjectStatus.ACTIVE,
                    "description": "Water kefir grains first fermented then bottled with mango and passion fruit for carbonation.",
                    "batch_size_liters": 1.5,
                    "days_ago": 2,
                    "ph_series": [6.2, 5.8],
                    "co2_series": [0.0, 1.5],
                    "notes": [("Grains are super active after reviving them last week. Second ferment going in today.", 1)],
                },
            ],
        },
        {
            "email": "mead.marco@example.com",
            "username": "meadmarco",
            "display_name": "Marco Reyes",
            "bio": "Meadmaker and cider enthusiast. Chasing that perfect traditional mead. ABV ≥ 12% or bust.",
            "projects": [
                {
                    "name": "Traditional Wildflower Mead",
                    "fermentation_type": FermentationType.MEAD,
                    "status": ProjectStatus.ACTIVE,
                    "description": "3.5kg local wildflower honey in 4.5L batch. Using Lalvin 71B yeast. TOSNA nutrient protocol.",
                    "batch_size_liters": 4.5,
                    "days_ago": 20,
                    "sg_series": [1.118, 1.095, 1.073, 1.055, 1.038, 1.022, 1.012],
                    "ph_series": [3.9, 3.8, 3.8, 3.7, 3.7, 3.7, 3.6],
                    "notes": [
                        ("Day 0: OG 1.118. Pitched rehydrated 71B with GoFerm. Smells incredible already.", 20),
                        ("Day 3: First nutrient addition. Vigorous fermentation, honey aroma is gorgeous.", 17),
                        ("Day 10: Gravity at 1.055. ABV approximately 8.4%. Flavor is developing nicely.", 10),
                    ],
                },
                {
                    "name": "Cyser — Honey Apple",
                    "fermentation_type": FermentationType.CIDER,
                    "status": ProjectStatus.COMPLETED,
                    "description": "Apple cider and honey hybrid (cyser). 1kg honey + 4L fresh-pressed apple juice. Ended at 11.2% ABV.",
                    "batch_size_liters": 4.5,
                    "days_ago": 90,
                    "sg_series": [1.090, 1.068, 1.045, 1.022, 1.010, 1.008],
                    "notes": [("Absolutely stunning. Apple and honey complement each other perfectly. Aging another 3 months before drinking.", 45)],
                },
            ],
        },
        {
            "email": "soda.sam@example.com",
            "username": "sodawitchcraft",
            "display_name": "Samantha Wells",
            "bio": "Natural sodas and shrubs. Making fizzy drinks from scratch, zero added CO₂. She/her.",
            "projects": [
                {
                    "name": "Raspberry Rose Water Kefir",
                    "fermentation_type": FermentationType.WATER_KEFIR,
                    "status": ProjectStatus.ACTIVE,
                    "description": "Water kefir second ferment with freeze-dried raspberries and a drop of rose water. Delicate and complex.",
                    "batch_size_liters": 1.5,
                    "days_ago": 3,
                    "ph_series": [6.1, 5.6, 5.1],
                    "co2_series": [0.0, 2.1, 4.4],
                    "notes": [
                        ("Using my grains that have been active for 2 years now. They're basically family.", 3),
                        ("Day 2: Beautiful pink color from the raspberries. Carbonation building nicely.", 1),
                    ],
                },
                {
                    "name": "Hibiscus Ginger Probiotic Soda",
                    "fermentation_type": FermentationType.PROBIOTIC_SODA,
                    "status": ProjectStatus.COMPLETED,
                    "description": "Hibiscus tea base with fresh ginger bug starter. Tart, floral, and very carbonated.",
                    "batch_size_liters": 2.0,
                    "days_ago": 15,
                    "ph_series": [5.8, 5.2, 4.7, 4.2],
                    "co2_series": [0.0, 1.5, 4.0, 7.2],
                    "notes": [("One bottle gushed when I opened it — that's how you know it worked 😂", 9)],
                },
            ],
        },
        {
            "email": "wine.wendy@example.com",
            "username": "wendywines",
            "display_name": "Wendy Okafor",
            "bio": "Amateur winemaker, professional wine drinker 🍷 Speciality: country wines from foraged fruits.",
            "projects": [
                {
                    "name": "Elderflower White Wine",
                    "fermentation_type": FermentationType.WINE,
                    "status": ProjectStatus.ACTIVE,
                    "description": "Foraged elderflowers, white grape juice concentrate, and a touch of citric acid. Very floral and light.",
                    "batch_size_liters": 4.5,
                    "days_ago": 18,
                    "sg_series": [1.082, 1.065, 1.048, 1.031, 1.018, 1.008],
                    "ph_series": [3.5, 3.5, 3.4, 3.4, 3.3, 3.3],
                    "notes": [
                        ("OG 1.082. Pitched EC-1118. The elderflower aroma is already overwhelming in the best way.", 18),
                        ("Day 7: Gravity at 1.031. Fermentation slowing. Racked off sediment.", 11),
                    ],
                },
                {
                    "name": "Blackberry Country Wine",
                    "fermentation_type": FermentationType.WINE,
                    "status": ProjectStatus.COMPLETED,
                    "description": "2kg wild blackberries picked from the hedgerow. Deep purple, tannic, and complex.",
                    "batch_size_liters": 3.8,
                    "days_ago": 120,
                    "sg_series": [1.088, 1.070, 1.051, 1.032, 1.015, 1.006, 1.002],
                    "notes": [("Won 'best fruit wine' at our local club tasting. Next batch will be double the quantity!", 60)],
                },
            ],
        },
    ]

    added_count = 0
    for ud in DEMO_USERS:
        if db.query(User).filter_by(username=ud["username"]).first():
            print(f"  Skipping existing user: {ud['username']}")
            continue

        user = User(
            email=ud["email"],
            username=ud["username"],
            hashed_password=get_password_hash("password123"),
            display_name=ud["display_name"],
            bio=ud["bio"],
            sms_notifications_enabled=False,
        )
        db.add(user)
        db.flush()

        for pd in ud["projects"]:
            days_ago = pd["days_ago"]
            start = now - timedelta(days=days_ago)
            end_date = (now - timedelta(days=days_ago // 3)) if pd["status"] == ProjectStatus.COMPLETED else None

            project = FermentationProject(
                user_id=user.id,
                name=pd["name"],
                fermentation_type=pd["fermentation_type"],
                status=pd["status"],
                description=pd["description"],
                batch_size_liters=pd.get("batch_size_liters", 4.0),
                start_date=start,
                end_date=end_date,
                fermentation_temp_celsius=pd.get("temp", 22),
                is_public=True,
                visibility="everyone",
            )
            if pd.get("sg_series"):
                project.initial_gravity = pd["sg_series"][0]
            if pd.get("ph_series"):
                project.initial_ph = pd["ph_series"][0]
            db.add(project)
            db.flush()

            n = max(len(pd.get("sg_series", [])), len(pd.get("ph_series", [])), len(pd.get("co2_series", [])), 1)
            for i in range(n):
                interval = days_ago / max(n - 1, 1)
                ts = start + timedelta(days=i * interval)
                sg = pd["sg_series"][i] if pd.get("sg_series") and i < len(pd["sg_series"]) else None
                ph = pd["ph_series"][i] if pd.get("ph_series") and i < len(pd["ph_series"]) else None
                co2 = pd["co2_series"][i] if pd.get("co2_series") and i < len(pd["co2_series"]) else None
                db.add(MeasurementLog(
                    project_id=project.id,
                    logged_at=ts,
                    specific_gravity=sg,
                    ph=ph,
                    co2_psi=co2,
                    temperature_celsius=pd.get("temp", 22),
                ))

            for content, note_days_ago in pd.get("notes", []):
                db.add(ObservationNote(
                    project_id=project.id,
                    user_id=user.id,
                    content=content,
                    tags=[],
                    created_at=now - timedelta(days=note_days_ago),
                ))

        db.commit()
        added_count += 1
        print(f"  Added user: {ud['display_name']} (@{ud['username']})")

    db.close()
    print(f"\nDone! Added {added_count} new demo users.")


if __name__ == "__main__":
    seed_demo_users()
