from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.models import YeastProfile, ProjectYeastConnection, FermentationProject, User
from app.schemas.schemas import YeastProfileCreate, YeastProfileOut, UserProjectRef
from app.api.deps import get_current_user

router = APIRouter(prefix="/yeasts", tags=["Yeast Profiles"])


@router.get("/", response_model=List[YeastProfileOut])
def list_yeasts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    yeasts = db.query(YeastProfile).filter(
        (YeastProfile.is_public == True) | (YeastProfile.creator_id == current_user.id)
    ).all()

    result = []
    for y in yeasts:
        # Count times this user has used this yeast
        connections = (
            db.query(ProjectYeastConnection)
            .join(FermentationProject)
            .filter(
                ProjectYeastConnection.yeast_id == y.id,
                FermentationProject.user_id == current_user.id,
            )
            .all()
        )
        project_names = [UserProjectRef(id=c.project.id, name=c.project.name) for c in connections if c.project]
        yeast_out = YeastProfileOut.model_validate(y)
        yeast_out.times_used = len(connections)
        yeast_out.user_projects = project_names
        result.append(yeast_out)

    return result


@router.get("/{yeast_id}", response_model=YeastProfileOut)
def get_yeast(
    yeast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    y = db.query(YeastProfile).filter(YeastProfile.id == yeast_id).first()
    if not y:
        raise HTTPException(404, "Yeast profile not found")

    connections = (
        db.query(ProjectYeastConnection)
        .join(FermentationProject)
        .filter(
            ProjectYeastConnection.yeast_id == yeast_id,
            FermentationProject.user_id == current_user.id,
        )
        .all()
    )
    project_names = [c.project.name for c in connections if c.project]
    yeast_out = YeastProfileOut.model_validate(y)
    yeast_out.times_used = len(connections)
    yeast_out.user_projects = project_names
    return yeast_out


@router.post("/", response_model=YeastProfileOut, status_code=201)
def create_yeast(
    body: YeastProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    yeast = YeastProfile(**body.model_dump(), creator_id=current_user.id)
    db.add(yeast)
    db.commit()
    db.refresh(yeast)
    yeast_out = YeastProfileOut.model_validate(yeast)
    yeast_out.times_used = 0
    yeast_out.user_projects = []
    return yeast_out
