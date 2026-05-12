from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Reminder, FermentationProject, User
from app.schemas.schemas import ReminderCreate, ReminderOut
from app.api.deps import get_current_user
from pydantic import BaseModel


class ReminderUpdate(BaseModel):
    is_active: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    interval_hours: Optional[int] = None
    message: Optional[str] = None
    phone_number: Optional[str] = None
    preferred_hour: Optional[int] = None
    preferred_minute: Optional[int] = None

router = APIRouter(tags=["Reminders"])

REMINDER_MESSAGES = {
    "ph_check": "🧪 Time to check the pH on your fermentation! Log your reading to track progress.",
    "gravity_check": "⚗️ Time to take a gravity (SG) reading on your fermentation!",
    "co2_limit": "💥 CO₂ pressure alert! Check your fermentation vessel's PSI and consider venting if needed.",
    "look_at_project": "👀 Time to check on your fermentation — observe any changes in aroma, color, or activity.",
}


def _calc_next_trigger(
    now: datetime,
    interval_hours: int,
    preferred_hour: Optional[int],
    preferred_minute: Optional[int],
) -> datetime:
    """Return the next trigger datetime respecting preferred time-of-day if set."""
    if preferred_hour is None:
        return now + timedelta(hours=interval_hours)

    minute = preferred_minute or 0
    # Find the next occurrence of preferred_hour:minute that is at least interval_hours away
    candidate = (now + timedelta(hours=interval_hours)).replace(
        hour=preferred_hour, minute=minute, second=0, microsecond=0
    )
    # If snapping to preferred time pushed us earlier than interval_hours from now, add one day
    if candidate < now + timedelta(hours=interval_hours) - timedelta(hours=1):
        candidate += timedelta(days=1)
    return candidate


@router.get("/projects/{project_id}/reminders", response_model=List[ReminderOut])
def list_reminders(
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
    return db.query(Reminder).filter(
        Reminder.project_id == project_id,
        Reminder.user_id == current_user.id,
    ).order_by(Reminder.created_at.desc()).all()


@router.post("/projects/{project_id}/reminders", response_model=ReminderOut)
def create_reminder(
    project_id: int,
    body: ReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(FermentationProject).filter(
        FermentationProject.id == project_id,
        FermentationProject.user_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")

    phone = body.phone_number or current_user.phone_number
    if body.sms_enabled and not phone:
        raise HTTPException(400, "A phone number is required to enable SMS reminders. Add one in your profile.")

    now = datetime.now(timezone.utc)
    if body.reminder_type == 'co2_limit':
        next_trigger = None  # triggered by measurement PSI check, not schedule
    else:
        next_trigger = _calc_next_trigger(now, body.interval_hours, body.preferred_hour, body.preferred_minute)

    reminder = Reminder(
        project_id=project_id,
        user_id=current_user.id,
        reminder_type=body.reminder_type,
        message=body.message or REMINDER_MESSAGES.get(body.reminder_type, "⏰ Reminder for your fermentation project."),
        interval_hours=body.interval_hours,
        next_trigger_at=next_trigger,
        preferred_hour=body.preferred_hour,
        preferred_minute=body.preferred_minute,
        sms_enabled=body.sms_enabled,
        email_enabled=body.email_enabled,
        phone_number=phone,
        is_active=True,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.patch("/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: int,
    body: ReminderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id,
    ).first()
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    # Recalculate next trigger if interval or preferred time changed
    if reminder.reminder_type != 'co2_limit' and any(
        f in body.model_dump(exclude_unset=True) for f in ('interval_hours', 'preferred_hour', 'preferred_minute')
    ):
        now = datetime.now(timezone.utc)
        reminder.next_trigger_at = _calc_next_trigger(
            now, reminder.interval_hours, reminder.preferred_hour, reminder.preferred_minute
        )
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/reminders/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id,
    ).first()
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    db.delete(reminder)
    db.commit()
    return {"ok": True}
