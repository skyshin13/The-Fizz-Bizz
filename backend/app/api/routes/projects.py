from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.db.database import get_db
from app.models.models import FermentationProject, MeasurementLog, ObservationNote, ProjectPhoto, Reminder, User, ProjectYeastConnection, YeastProfile, ProjectCERState
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut,
    MeasurementCreate, MeasurementOut,
    ObservationCreate, ObservationOut,
)
from app.api.deps import get_current_user
from app.services.calculations import calculate_abv

router = APIRouter(prefix="/projects", tags=["Projects"])


def _attach_yeast_strain(project, db):
    """Populate the transient yeast_strain attribute from ProjectYeastConnection."""
    conn = (
        db.query(ProjectYeastConnection)
        .filter_by(project_id=project.id)
        .first()
    )
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
        else:
            project.yeast_strain = None
    else:
        project.yeast_strain = None
    return project


@router.get("/", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    projects = (
        db.query(FermentationProject)
        .options(joinedload(FermentationProject.measurements), joinedload(FermentationProject.observations))
        .filter(FermentationProject.user_id == current_user.id)
        .order_by(FermentationProject.created_at.desc())
        .all()
    )
    for p in projects:
        _attach_yeast_strain(p, db)
    return projects


@router.post("/", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump()
    yeast_id = data.pop('yeast_id', None)
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
        .options(joinedload(FermentationProject.measurements), joinedload(FermentationProject.observations))
        .filter(FermentationProject.id == project_id, FermentationProject.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")
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
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
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
