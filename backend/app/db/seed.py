"""
Seed the database with demo data for local development.
Run: python -m app.db.seed
"""
from app.db.database import SessionLocal, engine
from app.models.models import Base, User, FermentationProject, MeasurementLog, ObservationNote
from app.models.models import YeastProfile, Recipe, RecipeIngredient, FermentationType, ProjectStatus
from app.models.models import FermentationTypeConfig, SugarType
from app.core.security import get_password_hash
from datetime import datetime, timedelta


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Skip if already seeded
    if db.query(User).first():
        print("Database already seeded.")
        db.close()
        return

    print("Seeding database...")

    # ── Fermentation Type Configs ──────────────────────────────────────────────
    fermentation_type_configs = [
        FermentationTypeConfig(value="kombucha", label="Kombucha", emoji="🍵", color="#4a6741", description="Fermented tea using a SCOBY culture", sort_order=0),
        FermentationTypeConfig(value="probiotic_soda", label="Probiotic Soda", emoji="🫙", color="#3d7d5e", description="Naturally carbonated probiotic beverages", sort_order=1),
        FermentationTypeConfig(value="beer", label="Beer", emoji="🍻", color="#b8860b", description="Grain-based alcoholic fermentation", sort_order=2),
        FermentationTypeConfig(value="wine", label="Wine", emoji="🍷", color="#8b0000", description="Fruit-based alcoholic fermentation", sort_order=3),
        FermentationTypeConfig(value="mead", label="Mead", emoji="🍯", color="#d4a017", description="Honey-based alcoholic fermentation", sort_order=4),
        FermentationTypeConfig(value="cider", label="Cider", emoji="🍎", color="#c84e00", description="Apple or pear-based alcoholic fermentation", sort_order=5),
        FermentationTypeConfig(value="kimchi", label="Kimchi", emoji="🌶️", color="#c0392b", description="Lacto-fermented Korean vegetables", sort_order=6),
        FermentationTypeConfig(value="lacto_fermentation", label="Lacto-Fermentation", emoji="🧂", color="#5a8a3c", description="Salt-brine vegetable fermentation", sort_order=7),
        FermentationTypeConfig(value="water_kefir", label="Water Kefir", emoji="💧", color="#2980b9", description="Probiotic fermented sugar water", sort_order=8),
        FermentationTypeConfig(value="milk_kefir", label="Milk Kefir", emoji="🥛", color="#a0a0a0", description="Probiotic fermented dairy drink", sort_order=9),
        FermentationTypeConfig(value="alcohol_brewing", label="Alcohol Brewing", emoji="🍺", color="#b8860b", description="General alcohol fermentation", sort_order=10),
        FermentationTypeConfig(value="general", label="General", emoji="🧪", color="#6c757d", description="Other fermentation projects", sort_order=11),
    ]
    for ftc in fermentation_type_configs:
        db.add(ftc)

    # ── Sugar Types ────────────────────────────────────────────────────────────
    sugar_types = [
        SugarType(value="table_sugar", label="Table Sugar (Sucrose)", description="Common household sugar, highly fermentable and neutral in flavor", sort_order=0),
        SugarType(value="corn_sugar", label="Corn Sugar (Dextrose)", description="100% fermentable monosaccharide, produces clean results with no residual flavor", sort_order=1),
        SugarType(value="honey", label="Honey", description="Natural sugar with floral notes, approx 75-80% fermentable", sort_order=2),
        SugarType(value="DME", label="Dry Malt Extract (DME)", description="Adds body and malt character, about 75% fermentable", sort_order=3),
    ]
    for st in sugar_types:
        db.add(st)

    db.flush()

    # ── Demo User ─────────────────────────────────────────────────────────────
    user = User(
        email="brewer@fizzbizz.com",
        username="brewmaster",
        hashed_password=get_password_hash("password123"),
        display_name="Alex Brewmaster",
        bio="Homebrewer & fermentation enthusiast. 5 years of kombucha and craft beer.",
        sms_notifications_enabled=False,
    )
    db.add(user)
    db.flush()

    # ── Yeast Profiles ────────────────────────────────────────────────────────
    yeasts = [
        YeastProfile(
            name="California Ale Yeast",
            strain_code="WLP001",
            brand="White Labs",
            yeast_type="ale",
            fermentation_type=FermentationType.BEER,
            description="The most popular ale yeast strain. Very clean, crisp flavor characteristics with low fruity esters.",
            attenuation_min=73, attenuation_max=80,
            flocculation="medium",
            temp_range_min_c=18, temp_range_max_c=22,
            alcohol_tolerance=15.0,
            flavor_notes="Clean, crisp, slight malt character. Low esters.",
            is_public=True,
        ),
        YeastProfile(
            name="Safale US-05",
            strain_code="US-05",
            brand="Fermentis",
            yeast_type="ale",
            fermentation_type=FermentationType.BEER,
            description="A ready-to-pitch dry American ale yeast producing well balanced beers with low diacetyl.",
            attenuation_min=73, attenuation_max=77,
            flocculation="medium",
            temp_range_min_c=15, temp_range_max_c=24,
            alcohol_tolerance=11.0,
            flavor_notes="Neutral, clean fermentation. Slightly fruity.",
            is_public=True,
        ),
        YeastProfile(
            name="SCOBY (GT's Original)",
            strain_code="SCOBY-GT",
            brand="GT's Kombucha Culture",
            yeast_type="SCOBY",
            fermentation_type=FermentationType.KOMBUCHA,
            description="Symbiotic culture of bacteria and yeast for traditional kombucha brewing.",
            temp_range_min_c=22, temp_range_max_c=28,
            alcohol_tolerance=3.0,
            flavor_notes="Tart, vinegary, complex. Slightly effervescent.",
            is_public=True,
        ),
        YeastProfile(
            name="Champagne Yeast EC-1118",
            strain_code="EC-1118",
            brand="Lalvin",
            yeast_type="wine",
            fermentation_type=FermentationType.MEAD,
            description="High alcohol tolerance, strong fermentation, ideal for sparkling meads and ciders.",
            attenuation_min=80, attenuation_max=95,
            flocculation="low",
            temp_range_min_c=10, temp_range_max_c=30,
            alcohol_tolerance=18.0,
            flavor_notes="Clean, neutral. Preserves fruit character.",
            is_public=True,
        ),
        YeastProfile(
            name="Ginger Bug Culture",
            strain_code="GINGER-BUG",
            brand="Wild Ferment",
            yeast_type="wild",
            fermentation_type=FermentationType.PROBIOTIC_SODA,
            description="A wild-captured ginger yeast and lactobacillus culture for naturally fermented sodas.",
            temp_range_min_c=20, temp_range_max_c=26,
            alcohol_tolerance=2.0,
            flavor_notes="Spicy ginger, slightly tart, naturally effervescent.",
            is_public=True,
        ),
    ]
    for y in yeasts:
        db.add(y)
    db.flush()

    # ── Recipes ───────────────────────────────────────────────────────────────
    kombucha_recipe = Recipe(
        name="Classic GT-Style Kombucha",
        fermentation_type=FermentationType.KOMBUCHA,
        description="A traditional kombucha recipe inspired by GT's Original. Light, tangy, and effervescent.",
        difficulty="beginner",
        batch_size_liters=3.8,
        estimated_duration_days=14,
        instructions="""1. Brew 3L of strong black tea (4 tea bags). Let cool to room temperature.
2. Dissolve 1 cup (200g) white sugar into warm tea.
3. Add starter liquid (1 cup of plain kombucha or from previous batch).
4. Add SCOBY to the vessel.
5. Cover with breathable cloth, secure with rubber band.
6. Ferment at room temperature (22–26°C) for 7–14 days.
7. Taste daily after day 7. When pleasantly tart, remove SCOBY.
8. For 2F carbonation: add 1 tsp sugar per 16oz bottle, cap tightly, ferment 2–3 more days.
9. Refrigerate and enjoy!""",
        tips="Use filtered or dechlorinated water. Keep away from direct sunlight. A longer first ferment = more vinegar flavor.",
        is_public=True,
        creator_id=user.id,
    )
    db.add(kombucha_recipe)
    db.flush()

    kombucha_ingredients = [
        RecipeIngredient(recipe_id=kombucha_recipe.id, name="Black Tea (bags)", quantity=4, unit="pieces", order_index=0),
        RecipeIngredient(recipe_id=kombucha_recipe.id, name="White Cane Sugar", quantity=200, unit="g", order_index=1),
        RecipeIngredient(recipe_id=kombucha_recipe.id, name="Filtered Water", quantity=3.8, unit="l", order_index=2),
        RecipeIngredient(recipe_id=kombucha_recipe.id, name="Starter Liquid (plain kombucha)", quantity=240, unit="ml", order_index=3),
        RecipeIngredient(recipe_id=kombucha_recipe.id, name="SCOBY", quantity=1, unit="pieces", order_index=4),
    ]
    for ing in kombucha_ingredients:
        db.add(ing)

    ginger_recipe = Recipe(
        name="Spicy Ginger Probiotic Soda",
        fermentation_type=FermentationType.PROBIOTIC_SODA,
        description="A naturally carbonated ginger beer using a wild-caught ginger bug starter.",
        difficulty="beginner",
        batch_size_liters=2.0,
        estimated_duration_days=5,
        instructions="""1. Make ginger bug: combine 2 tbsp grated ginger + 2 tbsp sugar + 240ml water in jar. Feed daily for 5 days.
2. Brew ginger syrup: boil 500ml water + 150g sugar + 30g fresh ginger (sliced). Cool.
3. Combine ginger syrup with remaining water and juice of 2 lemons.
4. Strain 60ml of active ginger bug and add to the mixture.
5. Bottle in flip-top bottles. Leave at room temp for 2–3 days.
6. Burp bottles daily! Refrigerate when carbonated to your liking.""",
        tips="Monitor carbonation closely — natural sodas can over-pressurize. Keep bottles in a bag as a precaution.",
        is_public=True,
        creator_id=user.id,
    )
    db.add(ginger_recipe)
    db.flush()

    ginger_ingredients = [
        RecipeIngredient(recipe_id=ginger_recipe.id, name="Fresh Ginger Root", quantity=80, unit="g", order_index=0),
        RecipeIngredient(recipe_id=ginger_recipe.id, name="White Sugar", quantity=200, unit="g", order_index=1),
        RecipeIngredient(recipe_id=ginger_recipe.id, name="Filtered Water", quantity=2.0, unit="l", order_index=2),
        RecipeIngredient(recipe_id=ginger_recipe.id, name="Lemon Juice", quantity=60, unit="ml", order_index=3),
        RecipeIngredient(recipe_id=ginger_recipe.id, name="Active Ginger Bug", quantity=60, unit="ml", order_index=4),
    ]
    for ing in ginger_ingredients:
        db.add(ing)

    # ── Projects ──────────────────────────────────────────────────────────────
    now = datetime.utcnow()

    project1 = FermentationProject(
        user_id=user.id,
        name="Summer Kombucha Batch #3",
        fermentation_type=FermentationType.KOMBUCHA,
        status=ProjectStatus.ACTIVE,
        description="Third batch of my GT-style kombucha. Experimenting with a longer first ferment.",
        batch_size_liters=3.8,
        start_date=now - timedelta(days=8),
        target_end_date=now + timedelta(days=6),
        initial_gravity=1.048,
        initial_ph=7.2,
        fermentation_temp_celsius=24,
        vessel_type="1-gallon glass jar",
        recipe_id=kombucha_recipe.id,
    )
    db.add(project1)
    db.flush()

    # Kombucha measurements over 8 days
    kombucha_measurements = [
        (now - timedelta(days=8), None, 7.2, 24.0, 0.0),
        (now - timedelta(days=7), None, 6.8, 24.2, 0.5),
        (now - timedelta(days=6), None, 6.2, 23.8, 1.2),
        (now - timedelta(days=5), None, 5.7, 24.1, 2.1),
        (now - timedelta(days=4), None, 5.2, 24.0, 3.4),
        (now - timedelta(days=3), None, 4.8, 23.5, 4.8),
        (now - timedelta(days=2), None, 4.4, 24.2, 6.0),
        (now - timedelta(days=1), None, 4.1, 24.0, 7.2),
        (now - timedelta(hours=6), None, 3.9, 24.1, 8.1),
    ]
    for ts, sg, ph, temp, co2 in kombucha_measurements:
        db.add(MeasurementLog(
            project_id=project1.id, logged_at=ts,
            specific_gravity=sg, ph=ph, temperature_celsius=temp, co2_psi=co2
        ))

    db.add(ObservationNote(project_id=project1.id, user_id=user.id, content="Day 1: SCOBY looks healthy, nice creamy color. Starting pH is 7.2.", tags=["appearance", "ph"], created_at=now - timedelta(days=8)))
    db.add(ObservationNote(project_id=project1.id, user_id=user.id, content="Day 3: Starting to smell pleasantly tangy. Tiny bubbles forming around SCOBY.", tags=["aroma", "activity"], created_at=now - timedelta(days=5)))
    db.add(ObservationNote(project_id=project1.id, user_id=user.id, content="Day 6: Taste is nice and tart! pH at 4.4, getting close to target. New baby SCOBY forming on top.", tags=["taste", "appearance"], created_at=now - timedelta(days=2)))

    project2 = FermentationProject(
        user_id=user.id,
        name="American Pale Ale — Hop Garden",
        fermentation_type=FermentationType.BEER,
        status=ProjectStatus.ACTIVE,
        description="A bright, citrusy APA with Citra and Cascade hops. Targeting 5.2% ABV.",
        batch_size_liters=19.0,
        start_date=now - timedelta(days=12),
        target_end_date=now + timedelta(days=10),
        initial_gravity=1.054,
        initial_ph=5.4,
        fermentation_temp_celsius=19,
        vessel_type="5-gallon plastic bucket",
    )
    db.add(project2)
    db.flush()

    beer_sg = [1.054, 1.042, 1.030, 1.022, 1.015, 1.012, 1.010, 1.010, 1.009]
    beer_ph = [5.4, 5.3, 5.2, 5.1, 5.0, 4.9, 4.9, 4.8, 4.8]
    for i, (sg, ph) in enumerate(zip(beer_sg, beer_ph)):
        ts = now - timedelta(days=12-i*1.3)
        from app.services.calculations import calculate_abv
        abv = calculate_abv(1.054, sg).abv_percent if sg < 1.054 else 0
        db.add(MeasurementLog(
            project_id=project2.id, logged_at=ts,
            specific_gravity=sg, ph=ph, temperature_celsius=19.0,
            alcohol_by_volume=abv
        ))

    db.add(ObservationNote(project_id=project2.id, user_id=user.id, content="Brew day went smoothly! OG hit at 1.054. Pitched US-05 rehydrated in 100ml water.", tags=["brew-day", "gravity"], created_at=now - timedelta(days=12)))
    db.add(ObservationNote(project_id=project2.id, user_id=user.id, content="Active fermentation! Airlock bubbling every 30 seconds. Great krausen head.", tags=["activity", "appearance"], created_at=now - timedelta(days=10)))

    project3 = FermentationProject(
        user_id=user.id,
        name="Ginger Lemon Probiotic Soda",
        fermentation_type=FermentationType.PROBIOTIC_SODA,
        status=ProjectStatus.COMPLETED,
        description="Ginger beer using my homemade ginger bug. Came out super bubbly and spicy!",
        batch_size_liters=2.0,
        start_date=now - timedelta(days=30),
        end_date=now - timedelta(days=25),
        initial_ph=6.8,
        fermentation_temp_celsius=22,
        vessel_type="Flip-top glass bottles",
        recipe_id=ginger_recipe.id,
    )
    db.add(project3)
    db.flush()

    for i, (ph, co2) in enumerate([(6.8, 0), (6.2, 1.0), (5.8, 2.4), (5.3, 4.2), (4.9, 6.8)]):
        ts = now - timedelta(days=30-i)
        db.add(MeasurementLog(project_id=project3.id, logged_at=ts, ph=ph, co2_psi=co2, temperature_celsius=22))

    project4 = FermentationProject(
        user_id=user.id,
        name="Classic Kimchi — Napa Cabbage",
        fermentation_type=FermentationType.KIMCHI,
        status=ProjectStatus.ACTIVE,
        description="Traditional baechu kimchi. Using fine Korean red pepper flakes.",
        batch_size_liters=2.5,
        start_date=now - timedelta(days=4),
        target_end_date=now + timedelta(days=17),
        initial_ph=5.8,
        fermentation_temp_celsius=18,
        vessel_type="1L mason jars (x3)",
    )
    db.add(project4)
    db.flush()

    for i, ph in enumerate([5.8, 5.4, 5.0, 4.7]):
        ts = now - timedelta(days=4-i)
        db.add(MeasurementLog(project_id=project4.id, logged_at=ts, ph=ph, temperature_celsius=18))

    db.commit()
    db.close()
    print("Database seeded successfully!")
    print("   Demo login: brewer@fizzbizz.com / password123")


if __name__ == "__main__":
    seed()
