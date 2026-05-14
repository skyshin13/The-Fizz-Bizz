"""
One-time script to add the Classic American IPA recipe to the database.
Run from the backend/ directory:
    uv run python -m app.db.add_ipa_recipe
"""
from app.db.database import SessionLocal, engine
from app.models.models import Base, Recipe, RecipeIngredient, FermentationType

def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(Recipe).filter(Recipe.name == "Classic American IPA").first():
        print("IPA recipe already exists — skipping.")
        db.close()
        return

    recipe = Recipe(
        name="Classic American IPA",
        fermentation_type=FermentationType.BEER,
        difficulty="intermediate",
        batch_size_liters=24.6,
        estimated_duration_days=10,
        description=(
            "A classic American IPA built around bold citrus and tropical hop character. "
            "The malt bill is clean and neutral, letting the hops take center stage. "
            "Centennial handles the bittering backbone, Cascade and Citra add citrus brightness "
            "in the late boil and whirlpool, and a double dry hop with Mosaic and Citra delivers "
            "the intense tropical fruit aroma that defines the style."
        ),
        instructions=(
            "1. Mash grains at 152°F (67°C) for 60 minutes. Sparge to collect ~30L pre-boil volume.\n"
            "2. Bring to a full rolling boil. Add Centennial hops at 60 minutes.\n"
            "3. At 15 minutes remaining, add Cascade and Citra hops.\n"
            "4. At flameout, cool wort to 180°F (82°C). Add Amarillo hops for a 20-minute whirlpool.\n"
            "5. Chill to 68°F (20°C) and transfer to fermenter. Pitch Safale US-05.\n"
            "6. Ferment at 68°F for 5–7 days until gravity stabilizes.\n"
            "7. Dry hop with Mosaic and Citra. Leave for 7 days.\n"
            "8. Cold crash 48 hours, then package. Carbonate to ~2.4 volumes CO2.\n"
            "9. Condition 5–7 days before drinking."
        ),
        tips=(
            "Whirlpool hops at 180°F (not boiling) to maximize flavor without harsh bitterness. "
            "For a hazier, juicier result, add dry hops during active fermentation (biotransformation). "
            "Use soft water or adjust with gypsum to enhance hop sharpness. "
            "Keep fermentation temperature steady — US-05 is clean but can throw esters above 72°F."
        ),
        is_public=True,
    )
    db.add(recipe)
    db.flush()

    ingredients = [
        # Malts
        RecipeIngredient(recipe_id=recipe.id, name="Pale Malt (2-Row)",      quantity=10,   unit="lbs",     notes="75% — clean neutral base", order_index=0),
        RecipeIngredient(recipe_id=recipe.id, name="Caramel/Crystal 20L",    quantity=1.5,  unit="lbs",     notes="15% — subtle caramel sweetness", order_index=1),
        RecipeIngredient(recipe_id=recipe.id, name="Munich Malt",            quantity=0.5,  unit="lbs",     notes="5% — light malty richness", order_index=2),
        # Hops
        RecipeIngredient(recipe_id=recipe.id, name="Centennial Hops",        quantity=28.3, unit="g",       notes="Boil 60 min — bittering", order_index=3),
        RecipeIngredient(recipe_id=recipe.id, name="Cascade Hops",           quantity=14.2, unit="g",       notes="Boil 15 min — citrus/floral flavor", order_index=4),
        RecipeIngredient(recipe_id=recipe.id, name="Citra Hops",             quantity=14.2, unit="g",       notes="Boil 15 min — tropical citrus flavor", order_index=5),
        RecipeIngredient(recipe_id=recipe.id, name="Amarillo Hops",          quantity=14.2, unit="g",       notes="Whirlpool 20 min @ 180°F", order_index=6),
        RecipeIngredient(recipe_id=recipe.id, name="Mosaic Hops",            quantity=28.3, unit="g",       notes="Dry hop 7 days", order_index=7),
        RecipeIngredient(recipe_id=recipe.id, name="Citra Hops (dry hop)",   quantity=28.3, unit="g",       notes="Dry hop 7 days", order_index=8),
        # Yeast
        RecipeIngredient(recipe_id=recipe.id, name="Safale US-05 (Dry Yeast)", quantity=1, unit="package", notes="Clean ale yeast, attenuates well", order_index=9),
    ]
    for ing in ingredients:
        db.add(ing)

    db.commit()
    db.close()
    print("Classic American IPA recipe added successfully.")

if __name__ == "__main__":
    run()
