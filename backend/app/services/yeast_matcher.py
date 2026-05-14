"""
Matches recipe ingredient names to YeastProfile entries by name / strain code.
Used both at recipe-creation time and as a one-shot backfill on startup.
"""
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import RecipeIngredient, YeastProfile

logger = logging.getLogger(__name__)


def _matches(ingredient_name: str, yeast: YeastProfile) -> bool:
    name = ingredient_name.lower().strip()
    yname = (yeast.name or "").lower().strip()
    strain = (yeast.strain_code or "").lower().strip()

    if not name:
        return False
    if yname == name:
        return True
    # Strain code contained in ingredient (min 3 chars to avoid spurious hits)
    if len(strain) >= 3 and strain in name:
        return True
    # Yeast name (min 4 chars) is a substring of ingredient name
    if len(yname) >= 4 and yname in name:
        return True
    return False


def match_yeast_for_ingredient(db: Session, ingredient_name: str) -> Optional[int]:
    """Return the id of the first public YeastProfile that matches the ingredient name."""
    if not ingredient_name or not ingredient_name.strip():
        return None
    for yeast in db.query(YeastProfile).filter(YeastProfile.is_public == True).all():
        if _matches(ingredient_name, yeast):
            return yeast.id
    return None


def sync_all_yeast_links(db: Session) -> int:
    """Backfill yeast_profile_id for every ingredient that currently lacks one."""
    unlinked = (
        db.query(RecipeIngredient)
        .filter(RecipeIngredient.yeast_profile_id == None)
        .all()
    )
    matched = 0
    for ing in unlinked:
        yeast_id = match_yeast_for_ingredient(db, ing.name)
        if yeast_id:
            ing.yeast_profile_id = yeast_id
            matched += 1
            logger.info(f"Linked ingredient '{ing.name}' (id={ing.id}) → yeast {yeast_id}")
    if matched:
        db.commit()
    return matched
