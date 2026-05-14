"""
Seed realistic fermentation projects for Skyler (user_id=2).
Run: uv run python seed_skyler.py
"""
from app.db.database import SessionLocal
from app.models.models import (
    FermentationProject, MeasurementLog, ObservationNote,
    FermentationType, ProjectStatus
)
from app.services.calculations import calculate_abv
from datetime import datetime, timedelta

USER_ID = 2


def abv(og, sg):
    if sg >= og:
        return 0.0
    return round(calculate_abv(og, sg).abv_percent, 2)


def seed():
    db = SessionLocal()
    now = datetime.utcnow()

    # ── 1. West Coast IPA — Citra Single Hop (completed, ~7 weeks ago) ────────
    p1_start = now - timedelta(days=52)
    p1 = FermentationProject(
        user_id=USER_ID,
        name="West Coast IPA — Citra Single Hop",
        fermentation_type=FermentationType.BEER,
        status=ProjectStatus.COMPLETED,
        description="Clean, bright WC IPA featuring Citra hops exclusively. Brewed with RO water + gypsum for a crisp, bitter finish. Targeting 6.5% ABV.",
        batch_size_liters=19.0,
        start_date=p1_start,
        end_date=now - timedelta(days=31),
        initial_gravity=1.064,
        final_gravity=1.011,
        initial_ph=5.3,
        fermentation_temp_celsius=19,
        vessel_type="6.5-gallon glass carboy",
    )
    db.add(p1)
    db.flush()

    for day, sg, ph in [
        (0, 1.064, 5.30), (1, 1.058, 5.20), (2, 1.040, 5.10),
        (3, 1.028, 5.00), (4, 1.020, 4.95), (5, 1.016, 4.90),
        (7, 1.013, 4.87), (9, 1.012, 4.85), (11, 1.011, 4.85),
        (14, 1.011, 4.83), (18, 1.011, 4.82), (21, 1.011, 4.82),
    ]:
        db.add(MeasurementLog(
            project_id=p1.id, logged_at=p1_start + timedelta(days=day),
            specific_gravity=sg, ph=ph, temperature_celsius=19.0,
            alcohol_by_volume=abv(1.064, sg),
        ))

    for day, content, tags in [
        (0,  "Brew day. Hit OG at 1.064 — dead on. Pitched 11g Safale US-05 rehydrated in 100ml water at 20°C. Wort crystal clear going into the carboy.", ["brew-day", "gravity"]),
        (1,  "Airlock showing first signs of activity — slow bubble every 45 seconds. Krausen just starting to form.", ["activity"]),
        (2,  "Peak fermentation! Airlock bubbling every 8 seconds. Krausen at 3 inches. House smells incredible.", ["activity", "aroma"]),
        (5,  "Activity slowing — bubbling every 2 minutes. Tasted a sample: very green still but hop character is intense.", ["taste", "activity"]),
        (9,  "Gravity at 1.012. Dry hop addition #1: 28g Citra pellets added directly to carboy.", ["gravity", "dry-hop"]),
        (14, "FG stable at 1.011. ABV 7.0%. Pulled dry hops, added 14g more Citra to secondary. Crystal clear.", ["gravity", "dry-hop", "appearance"]),
        (21, "Kegged today. Color is a gorgeous golden-orange. Aroma: mango, passionfruit, lime zest. Can't wait to carb.", ["packaging", "appearance", "aroma"]),
    ]:
        db.add(ObservationNote(
            project_id=p1.id, user_id=USER_ID, content=content, tags=tags,
            created_at=p1_start + timedelta(days=day),
        ))

    # ── 2. Wildflower Honey Dry Mead (active, 5 weeks in) ─────────────────────
    p2_start = now - timedelta(days=35)
    p2 = FermentationProject(
        user_id=USER_ID,
        name="Wildflower Honey Dry Mead",
        fermentation_type=FermentationType.MEAD,
        status=ProjectStatus.ACTIVE,
        description="Traditional dry mead using 3.6 kg of local wildflower honey. Targeting 13% ABV with Lalvin 71B. Following TOSNA nutrient protocol.",
        batch_size_liters=4.5,
        start_date=p2_start,
        target_end_date=now + timedelta(days=55),
        initial_gravity=1.098,
        initial_ph=3.7,
        fermentation_temp_celsius=20,
        vessel_type="1-gallon glass jugs (x4)",
    )
    db.add(p2)
    db.flush()

    for day, sg, ph, co2 in [
        (0,  1.098, 3.70, 0.0), (1,  1.094, 3.70, 0.2),
        (2,  1.085, 3.70, 0.8), (3,  1.074, 3.65, 1.8),
        (5,  1.058, 3.60, 3.6), (7,  1.044, 3.55, 5.2),
        (10, 1.030, 3.50, 6.8), (14, 1.018, 3.45, 8.7),
        (21, 1.008, 3.40, 10.4),(28, 1.002, 3.38, 11.2),
        (35, 0.998, 3.37, 11.8),
    ]:
        db.add(MeasurementLog(
            project_id=p2.id, logged_at=p2_start + timedelta(days=day),
            specific_gravity=sg, ph=ph, temperature_celsius=20.0,
            co2_psi=co2, alcohol_by_volume=abv(1.098, sg),
        ))

    for day, content, tags in [
        (0,  "Mixed 3.6 kg wildflower honey into 4.5L filtered water. OG 1.098. pH 3.7. Pitched 5g Lalvin 71B rehydrated with GoFerm. First TOSNA dose: 1.4g Fermaid-O.", ["brew-day", "gravity", "nutrients"]),
        (2,  "Strong fermentation. Tiny bubbles streaming constantly. Second nutrient dose: 1.4g Fermaid-O.", ["activity", "nutrients"]),
        (5,  "Degassed vigorously with a whisk — a lot of CO₂ locked in. Third nutrient dose. Must starting to lighten at the top.", ["nutrients", "appearance"]),
        (10, "Degassed again. Activity slowing. Color going from opaque gold to hazy amber. Smells floral and alcoholic.", ["appearance", "aroma"]),
        (21, "Final nutrient addition done. SG 1.008 — nearly finished. Sharp and alcoholic but honey character is coming through.", ["taste", "gravity"]),
        (35, "FG at 0.998 — fully attenuated. ABV ~13.3%. Dry, floral, slightly tart. Great clarity forming. Will rack next week for bulk aging.", ["gravity", "taste", "appearance"]),
    ]:
        db.add(ObservationNote(
            project_id=p2.id, user_id=USER_ID, content=content, tags=tags,
            created_at=p2_start + timedelta(days=day),
        ))

    # ── 3. Jun Kombucha — Green Tea & Honey (active, 11 days in) ──────────────
    p3_start = now - timedelta(days=11)
    p3 = FermentationProject(
        user_id=USER_ID,
        name="Jun Kombucha — Green Tea & Honey",
        fermentation_type=FermentationType.KOMBUCHA,
        status=ProjectStatus.ACTIVE,
        description="Jun is the 'champagne of kombucha' — brewed with green tea and raw honey instead of black tea and cane sugar. Lighter, more delicate flavor. Using a Jun SCOBY sourced from a local tea shop.",
        batch_size_liters=3.8,
        start_date=p3_start,
        target_end_date=now + timedelta(days=3),
        initial_ph=7.0,
        fermentation_temp_celsius=23,
        vessel_type="1-gallon glass jar with breathable cover",
    )
    db.add(p3)
    db.flush()

    for day, ph, co2 in [
        (0, 7.0, 0.0), (1, 6.6, 0.3), (2, 6.1, 0.8),
        (3, 5.5, 1.5), (5, 4.9, 2.8), (7, 4.3, 4.5),
        (9, 3.8, 6.0), (11, 3.4, 7.2),
    ]:
        db.add(MeasurementLog(
            project_id=p3.id, logged_at=p3_start + timedelta(days=day),
            ph=ph, temperature_celsius=23.0, co2_psi=co2,
        ))

    for day, content, tags in [
        (0,  "Started Jun batch with my Jun SCOBY from Honey Moon Tea. Brewed 3.8L Dragon Well green tea, dissolved 180g raw clover honey once cooled to 30°C. pH 7.0 at pitch.", ["brew-day", "ph"]),
        (3,  "Thin pellicle forming on top. pH already at 5.5 — dropping faster than black tea kombucha. Smells light and floral.", ["appearance", "aroma", "ph"]),
        (7,  "Tasted it — still slightly sweet but tartness is growing. Very clean, almost white-wine-like acidity. pH 4.3.", ["taste", "ph"]),
        (11, "pH at 3.4 — perfectly tart. Delicate green tea, light honey, clean acid. Planning to bottle tomorrow for 2F with sliced peach.", ["taste", "ph", "appearance"]),
    ]:
        db.add(ObservationNote(
            project_id=p3.id, user_id=USER_ID, content=content, tags=tags,
            created_at=p3_start + timedelta(days=day),
        ))

    # ── 4. Autumn Harvest Hard Cider (completed, ~10 weeks ago) ───────────────
    p4_start = now - timedelta(days=70)
    p4 = FermentationProject(
        user_id=USER_ID,
        name="Autumn Harvest Hard Cider",
        fermentation_type=FermentationType.CIDER,
        status=ProjectStatus.COMPLETED,
        description="Fresh-pressed Honeycrisp and Fuji apple blend from the farmer's market. Fermented dry with EC-1118, then back-sweetened with a touch of honey before bottling.",
        batch_size_liters=11.4,
        start_date=p4_start,
        end_date=now - timedelta(days=42),
        initial_gravity=1.052,
        final_gravity=0.999,
        initial_ph=3.8,
        fermentation_temp_celsius=18,
        vessel_type="3-gallon glass carboy",
    )
    db.add(p4)
    db.flush()

    for day, sg, ph in [
        (0, 1.052, 3.80), (1, 1.046, 3.75), (2, 1.034, 3.70),
        (4, 1.018, 3.65), (7, 1.008, 3.60), (10, 1.002, 3.55),
        (14, 0.999, 3.52), (21, 0.999, 3.50), (28, 0.999, 3.50),
    ]:
        db.add(MeasurementLog(
            project_id=p4.id, logged_at=p4_start + timedelta(days=day),
            specific_gravity=sg, ph=ph, temperature_celsius=18.0,
            alcohol_by_volume=abv(1.052, sg),
        ))

    for day, content, tags in [
        (0,  "Pressed 15 lbs Honeycrisp + 10 lbs Fuji. OG 1.052, pH 3.8. Added 1 Campden tablet per gallon, waited 24 hrs then pitched EC-1118.", ["brew-day", "gravity"]),
        (2,  "Violent fermentation! Foam nearly pushed through the airlock. Moved to 18°C to slow it down. Gorgeous cloudy gold color.", ["activity", "appearance"]),
        (7,  "Fermentation calming. SG 1.008. Starting to clear from the top. Flavor is very dry and tart — EC-1118 is a beast.", ["activity", "taste", "gravity"]),
        (14, "FG stable at 0.999. Bone dry at ~7% ABV. Crystal clear. Added 60g honey dissolved in warm cider as back-sweetener, then cold crashed.", ["gravity", "taste", "packaging"]),
        (28, "Bottled today in 22oz bottles with 1/2 tsp sugar each for natural carbonation. Honey rounds out the dryness perfectly. 3 weeks until opening.", ["packaging"]),
    ]:
        db.add(ObservationNote(
            project_id=p4.id, user_id=USER_ID, content=content, tags=tags,
            created_at=p4_start + timedelta(days=day),
        ))

    # ── 5. Robust Porter — Chocolate & Coffee (active, 8 days in) ─────────────
    p5_start = now - timedelta(days=8)
    p5 = FermentationProject(
        user_id=USER_ID,
        name="Robust Porter — Chocolate & Coffee",
        fermentation_type=FermentationType.BEER,
        status=ProjectStatus.ACTIVE,
        description="Rich robust porter with cold-brew coffee addition and cacao nibs secondary. Targeting 5.8% ABV. London Ale III (WY1318) for full mouthfeel and soft bitterness.",
        batch_size_liters=19.0,
        start_date=p5_start,
        target_end_date=now + timedelta(days=14),
        initial_gravity=1.060,
        initial_ph=5.4,
        fermentation_temp_celsius=20,
        vessel_type="7-gallon HDPE bucket",
    )
    db.add(p5)
    db.flush()

    for day, sg, ph in [
        (0, 1.060, 5.40), (1, 1.054, 5.35), (2, 1.038, 5.20),
        (3, 1.026, 5.10), (5, 1.016, 5.00), (7, 1.013, 4.95),
        (8, 1.012, 4.93),
    ]:
        db.add(MeasurementLog(
            project_id=p5.id, logged_at=p5_start + timedelta(days=day),
            specific_gravity=sg, ph=ph, temperature_celsius=20.0,
            alcohol_by_volume=abv(1.060, sg),
        ))

    for day, content, tags in [
        (0, "Brew day. Dark, almost black wort. Hit OG 1.060. Pitched 1.5L starter of WY1318 London Ale III. Smells of roast, chocolate, and dark bread.", ["brew-day", "gravity", "aroma"]),
        (1, "Activity starting — bubbling every 20 seconds. Thick tan krausen forming. House smells like a coffee shop.", ["activity", "aroma"]),
        (3, "Peak krausen — 4 inches tall, dark brown. Gravity dropped from 1.060 to 1.026 in 3 days. WY1318 is a workhorse.", ["activity", "gravity"]),
        (5, "Added 200ml cold-brew coffee concentrate and 50g cacao nibs in a muslin bag. Gravity at 1.016.", ["adjuncts", "gravity"]),
        (8, "Gravity at 1.012. Coffee and chocolate are subtle and balanced, not overpowering. Will cold crash in 5 more days.", ["taste", "gravity"]),
    ]:
        db.add(ObservationNote(
            project_id=p5.id, user_id=USER_ID, content=content, tags=tags,
            created_at=p5_start + timedelta(days=day),
        ))

    # ── 6. Blueberry Country Wine (completed, ~3.5 months ago) ────────────────
    p6_start = now - timedelta(days=110)
    p6 = FermentationProject(
        user_id=USER_ID,
        name="Blueberry Country Wine",
        fermentation_type=FermentationType.WINE,
        status=ProjectStatus.COMPLETED,
        description="Country-style wine using 6 lbs frozen blueberries per gallon. Deep purple, rich, semi-sweet. Lalvin 71B to preserve fruit esters and soften malic acid.",
        batch_size_liters=3.8,
        start_date=p6_start,
        end_date=now - timedelta(days=40),
        initial_gravity=1.090,
        final_gravity=1.005,
        initial_ph=3.4,
        fermentation_temp_celsius=21,
        vessel_type="1-gallon glass jug",
    )
    db.add(p6)
    db.flush()

    for day, sg, ph in [
        (0, 1.090, 3.40), (1, 1.082, 3.38), (3, 1.065, 3.35),
        (7, 1.040, 3.32), (14, 1.020, 3.30), (21, 1.010, 3.28),
        (30, 1.006, 3.27), (45, 1.005, 3.26), (60, 1.005, 3.25),
        (70, 1.005, 3.25),
    ]:
        db.add(MeasurementLog(
            project_id=p6.id, logged_at=p6_start + timedelta(days=day),
            specific_gravity=sg, ph=ph, temperature_celsius=21.0,
            alcohol_by_volume=abv(1.090, sg),
        ))

    for day, content, tags in [
        (0,  "Thawed 6 lbs frozen blueberries, crushed into mesh bag. OG 1.090 after adding 1.5 cups sugar. pH 3.4 — no acid adjustment needed. Pitched Lalvin 71B. Color is almost black-purple.", ["brew-day", "gravity", "appearance"]),
        (3,  "Punching down the berry cap twice daily. Aggressive fermentation. Deep purple foam. Kitchen looks like a crime scene.", ["activity", "appearance"]),
        (7,  "Pressed and racked to secondary, removed berry bag. Gravity 1.040. Young wine is tannic and sharp but blueberry flavor is intense.", ["racking", "taste", "gravity"]),
        (21, "Racked again — nice sediment layer left behind. Flavor softening considerably. Added 1 Campden tablet to inhibit spoilage.", ["racking", "taste"]),
        (60, "Fully clear! Deep ruby-purple. Gravity stable at 1.005 — semi-sweet. ABV ~11.5%. Round, fruity, jammy with a dry finish.", ["appearance", "taste", "gravity"]),
        (70, "Bottled today — 5 x 750ml bottles. Profile: blueberry jam, dark fruit, earthy finish. Excellent result. Aging 6+ months.", ["packaging", "taste"]),
    ]:
        db.add(ObservationNote(
            project_id=p6.id, user_id=USER_ID, content=content, tags=tags,
            created_at=p6_start + timedelta(days=day),
        ))

    db.commit()
    db.close()
    print("Done! Seeded 6 realistic projects for Skyler (user_id=2).")
    print("  1. West Coast IPA — Citra Single Hop (completed)")
    print("  2. Wildflower Honey Dry Mead (active)")
    print("  3. Jun Kombucha — Green Tea & Honey (active)")
    print("  4. Autumn Harvest Hard Cider (completed)")
    print("  5. Robust Porter — Chocolate & Coffee (active)")
    print("  6. Blueberry Country Wine (completed)")


if __name__ == "__main__":
    seed()
