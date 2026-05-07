from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from app.db.database import get_db
from app.models.models import FermentationProject, MeasurementLog, User, Friendship, FriendshipStatus, UserFollow
from app.schemas.schemas import PublicProjectOut, PublicUserOut, SharedProjectOut, SharedMeasurementOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/explore", tags=["Explore"])


@router.get("/share/{project_id}", response_model=SharedProjectOut)
def get_shared_project(project_id: int, db: Session = Depends(get_db)):
    """Public endpoint — no auth required. Returns project only if visibility='everyone'."""
    project = (
        db.query(FermentationProject)
        .options(joinedload(FermentationProject.owner))
        .filter(
            FermentationProject.id == project_id,
            or_(
                FermentationProject.visibility == "everyone",
                FermentationProject.is_public == True,
            ),
        )
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found or is not public")
    measurements = (
        db.query(MeasurementLog)
        .filter(MeasurementLog.project_id == project_id)
        .order_by(MeasurementLog.logged_at)
        .all()
    )
    return SharedProjectOut(
        id=project.id,
        name=project.name,
        fermentation_type=project.fermentation_type,
        status=project.status,
        description=project.description,
        cover_photo_url=project.cover_photo_url,
        start_date=project.start_date,
        created_at=project.created_at,
        author_username=project.owner.username,
        author_display_name=project.owner.display_name,
        measurements=[SharedMeasurementOut.model_validate(m) for m in measurements],
    )


@router.get("/projects", response_model=List[PublicProjectOut])
def explore_projects(
    fermentation_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Collect IDs of accepted friends and users current_user follows
    friendships = db.query(Friendship).filter(
        or_(
            Friendship.requester_id == current_user.id,
            Friendship.receiver_id == current_user.id,
        ),
        Friendship.status == FriendshipStatus.ACCEPTED,
    ).all()
    friend_ids = {
        f.receiver_id if f.requester_id == current_user.id else f.requester_id
        for f in friendships
    }
    try:
        following_ids = {
            f.followed_id
            for f in db.query(UserFollow).filter_by(follower_id=current_user.id).all()
        }
    except Exception:
        following_ids = set()

    q = (
        db.query(FermentationProject)
        .options(joinedload(FermentationProject.measurements), joinedload(FermentationProject.owner))
        .filter(FermentationProject.user_id != current_user.id)
        .filter(
            or_(
                FermentationProject.is_public == True,
                FermentationProject.visibility.in_(["everyone", "friends", "followers"]),
            )
        )
    )
    if fermentation_type:
        q = q.filter(FermentationProject.fermentation_type == fermentation_type)

    candidates = (
        q.order_by(FermentationProject.created_at.desc())
        .all()
    )

    # Filter by access rights
    visible = []
    for p in candidates:
        vis = p.visibility or ("everyone" if p.is_public else "private")
        if vis == "everyone":
            visible.append(p)
        elif vis == "friends" and p.user_id in friend_ids:
            visible.append(p)
        elif vis == "followers" and p.user_id in following_ids:
            visible.append(p)

    # Manual pagination after filtering
    start = (page - 1) * per_page
    projects = visible[start: start + per_page]

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

    friendships = db.query(Friendship).filter(
        (Friendship.requester_id == current_user.id) | (Friendship.receiver_id == current_user.id)
    ).all()
    friendship_map = {
        (f.receiver_id if f.requester_id == current_user.id else f.requester_id): f.status
        for f in friendships
    }

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
                    or_(
                        FermentationProject.is_public == True,
                        FermentationProject.visibility == "everyone",
                    ),
                )
                .count(),
            friendship_status=friendship_map.get(u.id),
        )
        for u in users
    ]
