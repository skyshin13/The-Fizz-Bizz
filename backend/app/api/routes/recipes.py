from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.db.database import get_db
from app.models.models import Recipe, RecipeIngredient, User
from app.schemas.schemas import RecipeCreate, RecipeOut
from app.api.deps import get_current_user
from app.services.yeast_matcher import match_yeast_for_ingredient, sync_all_yeast_links

router = APIRouter(prefix="/recipes", tags=["Recipes"])


@router.get("/", response_model=List[RecipeOut])
def list_recipes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Recipe)
        .options(joinedload(Recipe.ingredients))
        .filter((Recipe.is_public == True) | (Recipe.creator_id == current_user.id))
        .all()
    )


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = (
        db.query(Recipe)
        .options(joinedload(Recipe.ingredients))
        .filter(Recipe.id == recipe_id)
        .first()
    )
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    return recipe


@router.post("/", response_model=RecipeOut, status_code=201)
def create_recipe(
    body: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ingredients_data = body.model_dump().pop("ingredients", [])
    recipe_data = {k: v for k, v in body.model_dump().items() if k != "ingredients"}
    recipe = Recipe(**recipe_data, creator_id=current_user.id)
    db.add(recipe)
    db.flush()

    for ing in ingredients_data:
        ingredient = RecipeIngredient(**ing, recipe_id=recipe.id)
        if not ingredient.yeast_profile_id:
            ingredient.yeast_profile_id = match_yeast_for_ingredient(db, ing.get("name", ""))
        db.add(ingredient)

    db.commit()
    db.refresh(recipe)
    return recipe


@router.post("/sync-yeast-links", status_code=200)
def sync_yeast_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-run yeast matching for every ingredient that lacks a yeast_profile_id."""
    matched = sync_all_yeast_links(db)
    return {"matched": matched}
