"""
Link recipe yeast ingredients to yeast_profiles entries.

Scans all recipe_ingredients tagged as yeast (notes='yeast') and tries to
match each one to a yeast_profiles row by strain code or name similarity.
Sets yeast_profile_id on matched rows.

Usage (from backend/ directory):
    uv run python link_recipe_yeasts.py
"""

import re
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import SessionLocal
from app.models.models import RecipeIngredient, YeastProfile


def normalize(s: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    s = s.lower()
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def extract_strain_code(text: str) -> str | None:
    """Pull out codes like US-05, WLP001, WY1056, EC-1118, S-04, W-34/70."""
    m = re.search(r'\b(WLP\d+[A-Z]?|WY\d{4}|[A-Z]{1,3}-\d+(?:/\d+)?|EC-\d+)\b', text, re.IGNORECASE)
    return m.group(1).upper() if m else None


def score(ingredient_name: str, yeast: YeastProfile) -> int:
    """Return a match score (higher = better). 0 means no match."""
    ing_norm = normalize(ingredient_name)
    ing_code = extract_strain_code(ingredient_name)

    # Exact strain code match — strongest signal
    if ing_code and yeast.strain_code:
        if ing_code.upper() == yeast.strain_code.upper():
            return 100

    # Strain code appears anywhere in ingredient name
    if yeast.strain_code and yeast.strain_code.lower() in ing_norm:
        return 90

    # Yeast name normalized match
    yeast_norm = normalize(yeast.name)
    if yeast_norm and yeast_norm in ing_norm:
        return 80

    # Brand + partial name match
    if yeast.brand:
        brand_norm = normalize(yeast.brand)
        if brand_norm in ing_norm:
            # Check if any word from yeast name also appears
            yeast_words = set(yeast_norm.split()) - {'yeast', 'ale', 'lager', 'wine', 'dry', 'liquid'}
            if any(w in ing_norm for w in yeast_words if len(w) > 3):
                return 70

    return 0


def run():
    db = SessionLocal()
    try:
        yeasts = db.query(YeastProfile).all()
        print(f"Loaded {len(yeasts)} yeast profiles\n")

        ingredients = (
            db.query(RecipeIngredient)
            .filter(RecipeIngredient.notes == 'yeast')
            .filter(RecipeIngredient.yeast_profile_id == None)
            .all()
        )
        print(f"Found {len(ingredients)} unlinked yeast ingredients\n")

        linked = skipped = 0

        for ing in ingredients:
            best_score = 0
            best_yeast = None

            for y in yeasts:
                s = score(ing.name, y)
                if s > best_score:
                    best_score = s
                    best_yeast = y

            if best_yeast and best_score >= 70:
                ing.yeast_profile_id = best_yeast.id
                linked += 1
                print(f"  [LINKED] '{ing.name}' -> {best_yeast.name} ({best_yeast.strain_code}) [score={best_score}]")
            else:
                skipped += 1
                if best_score > 0:
                    print(f"  [WEAK]   '{ing.name}' — best match: {best_yeast.name} [score={best_score}]")

        db.commit()
        print(f"\nDone — {linked} linked, {skipped} unmatched.")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == '__main__':
    run()
