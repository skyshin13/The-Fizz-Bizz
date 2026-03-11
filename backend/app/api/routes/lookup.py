from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import FermentationTypeConfig, SugarType
from app.schemas.schemas import FermentationTypeConfigOut, SugarTypeOut
from typing import List

router = APIRouter(prefix="/lookup", tags=["Lookup"])


@router.get("/fermentation-types", response_model=List[FermentationTypeConfigOut])
def get_fermentation_types(db: Session = Depends(get_db)):
    return db.query(FermentationTypeConfig).order_by(FermentationTypeConfig.sort_order).all()


@router.get("/sugar-types", response_model=List[SugarTypeOut])
def get_sugar_types(db: Session = Depends(get_db)):
    return db.query(SugarType).order_by(SugarType.sort_order).all()
