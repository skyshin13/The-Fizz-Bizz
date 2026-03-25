from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.database import get_db
from app.models.models import User, FermentationProject, Friendship
from app.schemas.schemas import UserOut, UserUpdate, PublicUserProfileOut, PublicProjectOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/{username}", response_model=PublicUserProfileOut)
def get_user_profile(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(404, "User not found")

    public_projects = (
        db.query(FermentationProject)
        .options(joinedload(FermentationProject.measurements))
        .filter(
            FermentationProject.user_id == user.id,
            FermentationProject.is_public == True,
        )
        .order_by(FermentationProject.created_at.desc())
        .all()
    )

    friendship = db.query(Friendship).filter(
        (
            (Friendship.requester_id == current_user.id)
            & (Friendship.receiver_id == user.id)
        )
        | (
            (Friendship.requester_id == user.id)
            & (Friendship.receiver_id == current_user.id)
        )
    ).first()

    return PublicUserProfileOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        bio=user.bio,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        public_project_count=len(public_projects),
        public_projects=[
            PublicProjectOut(
                id=p.id,
                user_id=p.user_id,
                name=p.name,
                fermentation_type=p.fermentation_type,
                status=p.status,
                description=p.description,
                cover_photo_url=p.cover_photo_url,
                created_at=p.created_at,
                author_username=user.username,
                author_display_name=user.display_name,
                measurement_count=len(p.measurements),
            )
            for p in public_projects
        ],
        friendship_id=friendship.id if friendship else None,
        friendship_status=friendship.status if friendship else None,
        is_requester=friendship.requester_id == current_user.id if friendship else None,
    )
