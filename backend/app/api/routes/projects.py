from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timedelta, timezone
from app.db.database import get_db
from app.services.twilio_service import send_sms
from app.models.models import (
    FermentationProject, MeasurementLog, ObservationNote, ProjectPhoto,
    Reminder, User, ProjectYeastConnection, YeastProfile, ProjectCERState,
    Friendship, FriendshipStatus, UserFollow, ProjectLike, ProjectComment,
)
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut,
    MeasurementCreate, MeasurementOut,
    ObservationCreate, ObservationOut,
    PublicProjectDetailOut, SharedMeasurementOut, SharedObservationOut, SharedYeastOut,
    ProjectCommentCreate, ProjectCommentOut,
)
from app.api.deps import get_current_user
from app.services.calculations import calculate_abv

# Auto-generated CER background rows have only co2_psi+temperature set.
# This filter selects only user-meaningful measurements (manually entered).
_USER_MEAS_FILTER = or_(
    MeasurementLog.ph.isnot(None),
    MeasurementLog.specific_gravity.isnot(None),
    MeasurementLog.alcohol_by_volume.isnot(None),
    MeasurementLog.brix.isnot(None),
    MeasurementLog.notes.isnot(None),
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def _can_view(project, current_user, db) -> bool:
    """Return True if current_user is allowed to view this project."""
    if project.user_id == current_user.id:
        return True
    vis = project.visibility or ("everyone" if project.is_public else "private")
    if vis == "everyone":
        return True
    if vis == "friends":
        return db.query(Friendship).filter(
            or_(
                (Friendship.requester_id == current_user.id) & (Friendship.receiver_id == project.user_id),
                (Friendship.requester_id == project.user_id) & (Friendship.receiver_id == current_user.id),
            ),
            Friendship.status == FriendshipStatus.ACCEPTED,
        ).first() is not None
    if vis == "followers":
        return db.query(UserFollow).filter_by(
            follower_id=current_user.id, followed_id=project.user_id
        ).first() is not None
    return False


def _attach_yeast_strain(project, db):
    """Populate the transient yeast_strain attribute for a single project."""
    conn = db.query(ProjectYeastConnection).filter_by(project_id=project.id).first()
    if conn:
        yeast = db.query(YeastProfile).filter_by(id=conn.yeast_id).first()
        if yeast:
            project.yeast_strain = type('ProjectYeastOut', (), {
                'yeast_id': yeast.id,
                'name': yeast.name,
                'strain_code': yeast.strain_code,
                'brand': yeast.brand,
                'yeast_type': yeast.yeast_type,
            })()
            return project
    project.yeast_strain = None
    return project


def _attach_yeast_strains_batch(projects, db):
    """Populate yeast_strain for a list of projects using 2 queries total (not 2×N)."""
    if not projects:
        return projects
    project_ids = [p.id for p in projects]
    connections = db.query(ProjectYeastConnection).filter(
        ProjectYeastConnection.project_id.in_(project_ids)
    ).all()
    conn_by_project = {c.project_id: c for c in connections}
    yeast_ids = list({c.yeast_id for c in connections})
    yeasts_by_id = {}
    if yeast_ids:
        yeasts = db.query(YeastProfile).filter(YeastProfile.id.in_(yeast_ids)).all()
        yeasts_by_id = {y.id: y for y in yeasts}
    for p in projects:
        conn = conn_by_project.get(p.id)
        yeast = yeasts_by_id.get(conn.yeast_id) if conn else None
        if yeast:
            p.yeast_strain = type('ProjectYeastOut', (), {
                'yeast_id': yeast.id,
                'name': yeast.name,
                'strain_code': yeast.strain_code,
                'brand': yeast.brand,
                'yeast_type': yeast.yeast_type,
            })()
        else:
            p.yeast_strain = None
    return projects


@router.get("/", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    projects = (
        db.query(FermentationProject)
        .options(joinedload(FermentationProject.observations))
        .filter(FermentationProject.user_id == current_user.id)
        .order_by(FermentationProject.created_at.desc())
        .all()
    )
    if projects:
        project_ids = [p.id for p in projects]
        user_measurements = (
            db.query(MeasurementLog)
            .filter(MeasurementLog.project_id.in_(project_ids), _USER_MEAS_FILTER)
            .order_by(MeasurementLog.logged_at)
            .all()
        )
        meas_by_project: dict[int, list] = {}
        for m in user_measurements:
            meas_by_project.setdefault(m.project_id, []).append(m)
        for p in projects:
            p.__dict__['measurements'] = meas_by_project.get(p.id, [])
    _attach_yeast_strains_batch(projects, db)
    return projects


@router.post("/", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump()
    yeast_id = data.pop('yeast_id', None)
    # Sync is_public from visibility
    vis = data.get('visibility', 'private')
    data['is_public'] = vis == 'everyone'
    project = FermentationProject(**data, user_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    if yeast_id:
        conn = ProjectYeastConnection(project_id=project.id, yeast_id=yeast_id)
        db.add(conn)
        db.commit()
    _attach_yeast_strain(project, db)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = (
        db.query(FermentationProject)
        .options(joinedload(FermentationProject.observations))
        .filter(FermentationProject.id == project_id, FermentationProject.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")
    user_measurements = (
        db.query(MeasurementLog)
        .filter(MeasurementLog.project_id == project_id, _USER_MEAS_FILTER)
        .order_by(MeasurementLog.logged_at)
        .all()
    )
    project.__dict__['measurements'] = user_measurements
    _attach_yeast_strain(project, db)
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter(
        FermentationProject.id == project_id,
        FermentationProject.user_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    updates = body.model_dump(exclude_unset=True)
    # Keep visibility and is_public in sync
    if 'visibility' in updates:
        updates['is_public'] = updates['visibility'] == 'everyone'
    elif 'is_public' in updates:
        updates['visibility'] = 'everyone' if updates['is_public'] else 'private'
    for field, value in updates.items():
        setattr(project, field, value)
    # Auto-deactivate all reminders when project is completed or failed
    if updates.get('status') in ('completed', 'failed'):
        db.query(Reminder).filter(
            Reminder.project_id == project_id,
            Reminder.is_active == True,
        ).update({'is_active': False}, synchronize_session=False)
    db.commit()
    db.refresh(project)
    _attach_yeast_strain(project, db)
    return project


@router.put("/{project_id}/yeast", response_model=ProjectOut)
def set_project_yeast(
    project_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set or clear the yeast strain for a project. Pass {"yeast_id": 123} to set, {"yeast_id": null} to clear."""
    project = db.query(FermentationProject).options(
        joinedload(FermentationProject.measurements),
        joinedload(FermentationProject.observations),
    ).filter(
        FermentationProject.id == project_id,
        FermentationProject.user_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    # Delete existing connection
    db.query(ProjectYeastConnection).filter_by(project_id=project_id).delete(synchronize_session=False)
    yeast_id = body.get("yeast_id")
    if yeast_id:
        yeast = db.query(YeastProfile).filter_by(id=yeast_id).first()
        if not yeast:
            raise HTTPException(404, "Yeast strain not found")
        db.add(ProjectYeastConnection(project_id=project_id, yeast_id=yeast_id))
    db.commit()
    _attach_yeast_strain(project, db)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter(
        FermentationProject.id == project_id,
        FermentationProject.user_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    db.query(ProjectCERState).filter(ProjectCERState.project_id == project_id).delete(synchronize_session=False)
    db.query(MeasurementLog).filter(MeasurementLog.project_id == project_id).delete(synchronize_session=False)
    db.query(ObservationNote).filter(ObservationNote.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectPhoto).filter(ProjectPhoto.project_id == project_id).delete(synchronize_session=False)
    db.query(Reminder).filter(Reminder.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectYeastConnection).filter(ProjectYeastConnection.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectLike).filter(ProjectLike.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectComment).filter(ProjectComment.project_id == project_id).delete(synchronize_session=False)
    db.delete(project)
    db.commit()


# ─── Measurements ──────────────────────────────────────────────────────────

@router.get("/{project_id}/measurements", response_model=List[MeasurementOut])
def list_measurements(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter(
        FermentationProject.id == project_id, FermentationProject.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return db.query(MeasurementLog).filter(MeasurementLog.project_id == project_id).order_by(MeasurementLog.logged_at).all()


@router.post("/{project_id}/measurements", response_model=MeasurementOut, status_code=201)
def add_measurement(
    project_id: int,
    body: MeasurementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter(
        FermentationProject.id == project_id, FermentationProject.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")

    measurement = MeasurementLog(**body.model_dump(), project_id=project_id)

    # Auto-calculate ABV if we have gravity readings
    if body.specific_gravity and project.initial_gravity:
        abv_result = calculate_abv(project.initial_gravity, body.specific_gravity)
        measurement.alcohol_by_volume = abv_result.abv_percent

    db.add(measurement)
    db.commit()
    db.refresh(measurement)

    # Check CO2 PSI alert reminders when a co2_psi reading is logged
    if body.co2_psi is not None:
        now = datetime.now(timezone.utc)
        co2_alerts = db.query(Reminder).filter(
            Reminder.project_id == project_id,
            Reminder.reminder_type == 'co2_limit',
            Reminder.is_active == True,
            Reminder.sms_enabled == True,
        ).all()
        for alert in co2_alerts:
            threshold_psi = alert.interval_hours  # stores PSI threshold for co2_limit type
            triggered_at = alert.next_trigger_at
            if triggered_at and triggered_at.replace(tzinfo=timezone.utc) > now:
                continue  # still in cooldown
            if body.co2_psi >= threshold_psi:
                phone = alert.phone_number or current_user.phone_number
                if phone:
                    send_sms(phone, (
                        f'Fizz Bizz CO₂ alert for "{project.name}": '
                        f'PSI reading of {body.co2_psi:.1f} has reached your alert threshold of '
                        f'{threshold_psi} PSI. Consider venting your vessel.'
                    ))
                alert.next_trigger_at = now + timedelta(hours=4)
        db.commit()

    return measurement


# ─── Observations ──────────────────────────────────────────────────────────

@router.post("/{project_id}/observations", response_model=ObservationOut, status_code=201)
def add_observation(
    project_id: int,
    body: ObservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter(
        FermentationProject.id == project_id, FermentationProject.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")

    obs = ObservationNote(**body.model_dump(), project_id=project_id, user_id=current_user.id)
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return obs


@router.get("/{project_id}/public", response_model=PublicProjectDetailOut)
def get_public_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = (
        db.query(FermentationProject)
        .options(
            joinedload(FermentationProject.owner),
            joinedload(FermentationProject.observations),
            joinedload(FermentationProject.measurements),
        )
        .filter(FermentationProject.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")
    if not _can_view(project, current_user, db):
        raise HTTPException(403, "You don't have access to this project")

    conn = db.query(ProjectYeastConnection).filter_by(project_id=project_id).first()
    yeast_strain = None
    if conn:
        yeast = db.query(YeastProfile).filter_by(id=conn.yeast_id).first()
        if yeast:
            yeast_strain = SharedYeastOut(
                yeast_id=yeast.id,
                name=yeast.name,
                strain_code=yeast.strain_code,
                brand=yeast.brand,
                yeast_type=yeast.yeast_type,
            )

    user_measurements = [
        m for m in project.measurements
        if any([m.ph, m.specific_gravity, m.alcohol_by_volume, m.brix, m.notes])
    ]
    user_measurements.sort(key=lambda m: m.logged_at)

    like_count = db.query(ProjectLike).filter_by(project_id=project_id).count()
    is_liked   = db.query(ProjectLike).filter_by(project_id=project_id, user_id=current_user.id).first() is not None
    comment_count = db.query(ProjectComment).filter_by(project_id=project_id).count()

    return PublicProjectDetailOut(
        id=project.id,
        name=project.name,
        fermentation_type=project.fermentation_type,
        status=project.status,
        description=project.description,
        notes=project.notes,
        cover_photo_url=project.cover_photo_url,
        batch_size_liters=project.batch_size_liters,
        vessel_type=project.vessel_type,
        initial_gravity=project.initial_gravity,
        initial_ph=project.initial_ph,
        fermentation_temp_celsius=project.fermentation_temp_celsius,
        start_date=project.start_date,
        end_date=project.end_date,
        created_at=project.created_at,
        author_username=project.owner.username,
        author_display_name=project.owner.display_name,
        author_avatar_url=project.owner.avatar_url,
        measurements=[SharedMeasurementOut.model_validate(m) for m in user_measurements],
        observations=[
            SharedObservationOut(
                content=o.content,
                photo_url=o.photo_url,
                created_at=o.created_at,
            )
            for o in sorted(project.observations, key=lambda o: o.created_at)
        ],
        yeast_strain=yeast_strain,
        like_count=like_count,
        is_liked_by_me=is_liked,
        comment_count=comment_count,
    )


# ─── Likes ─────────────────────────────────────────────────────────────────────

@router.post("/{project_id}/like", status_code=204)
def like_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter_by(id=project_id).first()
    if not project or not _can_view(project, current_user, db):
        raise HTTPException(404, "Project not found")
    existing = db.query(ProjectLike).filter_by(project_id=project_id, user_id=current_user.id).first()
    if not existing:
        db.add(ProjectLike(project_id=project_id, user_id=current_user.id))
        db.commit()


@router.delete("/{project_id}/like", status_code=204)
def unlike_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(ProjectLike).filter_by(project_id=project_id, user_id=current_user.id).delete()
    db.commit()


# ─── Comments ──────────────────────────────────────────────────────────────────

@router.get("/{project_id}/comments", response_model=List[ProjectCommentOut])
def list_comments(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter_by(id=project_id).first()
    if not project or not _can_view(project, current_user, db):
        raise HTTPException(404, "Project not found")
    rows = (
        db.query(ProjectComment)
        .filter_by(project_id=project_id)
        .order_by(ProjectComment.created_at)
        .all()
    )
    user_ids = list({r.user_id for r in rows})
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    result = []
    for r in rows:
        author = users.get(r.user_id)
        result.append(ProjectCommentOut(
            id=r.id,
            project_id=r.project_id,
            user_id=r.user_id,
            content=r.content,
            created_at=r.created_at,
            author_username=author.username if author else "unknown",
            author_display_name=author.display_name if author else None,
            author_avatar_url=author.avatar_url if author else None,
        ))
    return result


@router.post("/{project_id}/comments", response_model=ProjectCommentOut, status_code=201)
def add_comment(
    project_id: int,
    body: ProjectCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter_by(id=project_id).first()
    if not project or not _can_view(project, current_user, db):
        raise HTTPException(404, "Project not found")
    comment = ProjectComment(project_id=project_id, user_id=current_user.id, content=body.content.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return ProjectCommentOut(
        id=comment.id,
        project_id=comment.project_id,
        user_id=comment.user_id,
        content=comment.content,
        created_at=comment.created_at,
        author_username=current_user.username,
        author_display_name=current_user.display_name,
        author_avatar_url=current_user.avatar_url,
    )


@router.delete("/{project_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    project_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(ProjectComment).filter_by(id=comment_id, project_id=project_id).first()
    if not comment:
        raise HTTPException(404, "Comment not found")
    project = db.query(FermentationProject).filter_by(id=project_id).first()
    if comment.user_id != current_user.id and (not project or project.user_id != current_user.id):
        raise HTTPException(403, "Not authorized")
    db.delete(comment)
    db.commit()
