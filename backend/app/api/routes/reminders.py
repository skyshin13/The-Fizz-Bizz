from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Reminder, FermentationProject, User
from app.schemas.schemas import ReminderCreate, ReminderOut
from app.api.deps import get_current_user
from app.services.twilio_service import send_sms
from pydantic import BaseModel


class ReminderUpdate(BaseModel):
    is_active: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    interval_hours: Optional[int] = None
    message: Optional[str] = None
    phone_number: Optional[str] = None

router = APIRouter(tags=["Reminders"])

REMINDER_MESSAGES = {
    "ph_check": "🧪 Time to check the pH on your fermentation project! Log your reading to track progress.",
    "co2_release": "💨 Time to burp/release CO₂ from your fermentation vessel to prevent pressure buildup.",
    "gravity_check": "⚗️ Time to take a gravity reading on your fermentation project!",
    "taste": "👅 Time for a taste test on your fermentation project!",
    "custom": "⏰ Reminder for your fermentation project.",
}


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

    # Use user's saved phone number if none provided
    phone = body.phone_number or current_user.phone_number
    if body.sms_enabled and not phone:
        raise HTTPException(400, "A phone number is required to enable SMS reminders. Add one in your profile.")

    next_trigger = datetime.now(timezone.utc) + timedelta(hours=body.interval_hours)

    reminder = Reminder(
        project_id=project_id,
        user_id=current_user.id,
        reminder_type=body.reminder_type,
        message=body.message or REMINDER_MESSAGES.get(body.reminder_type, REMINDER_MESSAGES["custom"]),
        interval_hours=body.interval_hours,
        next_trigger_at=next_trigger,
        sms_enabled=body.sms_enabled,
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


@router.post("/reminders/{reminder_id}/send")
def send_reminder_now(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger an SMS reminder right now."""
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id,
    ).first()
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    if not reminder.sms_enabled:
        raise HTTPException(400, "SMS is not enabled for this reminder")
    phone = reminder.phone_number or current_user.phone_number
    if not phone:
        raise HTTPException(400, "No phone number on file")

    project = db.query(FermentationProject).filter(FermentationProject.id == reminder.project_id).first()
    project_name = project.name if project else "your fermentation project"
    msg = f"Fizz Bizz reminder for \"{project_name}\": {reminder.message}"

    sent = send_sms(phone, msg)
    if not sent:
        raise HTTPException(503, "SMS could not be sent. Check that Twilio credentials are configured in the server environment.")

    # Advance the next trigger
    reminder.next_trigger_at = datetime.now(timezone.utc) + timedelta(hours=reminder.interval_hours)
    db.commit()
    return {"ok": True, "message": "SMS sent successfully"}
