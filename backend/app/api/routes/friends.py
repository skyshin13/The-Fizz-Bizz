from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.models import User, Friendship, FriendshipStatus, FermentationProject
from app.schemas.schemas import FriendshipOut, PublicUserOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/friends", tags=["Friends"])


def _public_user(u: User, db: Session) -> PublicUserOut:
    count = (
        db.query(FermentationProject)
        .filter(FermentationProject.user_id == u.id, FermentationProject.is_public == True)
        .count()
    )
    return PublicUserOut(
        id=u.id,
        username=u.username,
        display_name=u.display_name,
        bio=u.bio,
        avatar_url=u.avatar_url,
        created_at=u.created_at,
        public_project_count=count,
    )


def _friendship_out(f: Friendship, other: User, db: Session) -> FriendshipOut:
    return FriendshipOut(
        id=f.id,
        requester_id=f.requester_id,
        receiver_id=f.receiver_id,
        status=f.status,
        created_at=f.created_at,
        friend=_public_user(other, db),
    )


@router.get("/", response_model=List[FriendshipOut])
def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friendships = (
        db.query(Friendship)
        .filter(
            (Friendship.requester_id == current_user.id)
            | (Friendship.receiver_id == current_user.id)
        )
        .all()
    )
    result = []
    for f in friendships:
        other_id = f.receiver_id if f.requester_id == current_user.id else f.requester_id
        other = db.query(User).filter(User.id == other_id).first()
        if other:
            result.append(_friendship_out(f, other, db))
    return result


@router.post("/request/{username}", response_model=FriendshipOut, status_code=201)
def send_friend_request(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(404, "User not found")
    if target.id == current_user.id:
        raise HTTPException(400, "Cannot send a friend request to yourself")

    existing = db.query(Friendship).filter(
        (
            (Friendship.requester_id == current_user.id)
            & (Friendship.receiver_id == target.id)
        )
        | (
            (Friendship.requester_id == target.id)
            & (Friendship.receiver_id == current_user.id)
        )
    ).first()
    if existing:
        raise HTTPException(400, "A friend request already exists between these users")

    f = Friendship(requester_id=current_user.id, receiver_id=target.id)
    db.add(f)
    db.commit()
    db.refresh(f)
    return _friendship_out(f, target, db)


@router.post("/accept/{friendship_id}", response_model=FriendshipOut)
def accept_friend_request(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.query(Friendship).filter(
        Friendship.id == friendship_id,
        Friendship.receiver_id == current_user.id,
        Friendship.status == FriendshipStatus.PENDING,
    ).first()
    if not f:
        raise HTTPException(404, "Pending friend request not found")

    f.status = FriendshipStatus.ACCEPTED
    db.commit()
    db.refresh(f)

    requester = db.query(User).filter(User.id == f.requester_id).first()
    return _friendship_out(f, requester, db)


@router.delete("/{friendship_id}", status_code=204)
def remove_friend(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.query(Friendship).filter(
        Friendship.id == friendship_id,
        (Friendship.requester_id == current_user.id)
        | (Friendship.receiver_id == current_user.id),
    ).first()
    if not f:
        raise HTTPException(404, "Friendship not found")
    db.delete(f)
    db.commit()
