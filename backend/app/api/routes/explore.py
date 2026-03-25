from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.db.database import get_db
from app.models.models import FermentationProject, User
from app.schemas.schemas import PublicProjectOut, PublicUserOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/explore", tags=["Explore"])


@router.get("/projects", response_model=List[PublicProjectOut])
def explore_projects(
    fermentation_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(FermentationProject)
        .options(joinedload(FermentationProject.measurements), joinedload(FermentationProject.owner))
        .filter(FermentationProject.is_public == True)
        .filter(FermentationProject.user_id != current_user.id)
    )
    if fermentation_type:
        q = q.filter(FermentationProject.fermentation_type == fermentation_type)

    projects = (
        q.order_by(FermentationProject.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return [
        PublicProjectOut(
            id=p.id,
            user_id=p.user_id,
            name=p.name,
            fermentation_type=p.fermentation_type,
            status=p.status,
            description=p.description,
            cover_photo_url=p.cover_photo_url,
            created_at=p.created_at,
            author_username=p.owner.username,
            author_display_name=p.owner.display_name,
            measurement_count=len(p.measurements),
        )
        for p in projects
    ]


@router.get("/users", response_model=List[PublicUserOut])
def search_users(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(User).filter(User.id != current_user.id)
    if q:
        query = query.filter(
            User.username.ilike(f"%{q}%") | User.display_name.ilike(f"%{q}%")
        )
    users = query.limit(30).all()

    return [
        PublicUserOut(
            id=u.id,
            username=u.username,
            display_name=u.display_name,
            bio=u.bio,
            avatar_url=u.avatar_url,
            created_at=u.created_at,
            public_project_count=db.query(FermentationProject)
                .filter(
                    FermentationProject.user_id == u.id,
                    FermentationProject.is_public == True,
                )
                .count(),
        )
        for u in users
    ]
