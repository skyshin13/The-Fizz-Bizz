from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Reminder, FermentationProject, User
from app.schemas.schemas import ReminderCreate, ReminderOut
from app.api.deps import get_current_user
from app.services.sendgrid_service import send_email
from app.services.twilio_service import send_sms
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

_EST = ZoneInfo("America/New_York")


def _fmt_time(dt: datetime) -> str:
    local = dt.astimezone(_EST)
    dst = local.dst()
    tz_label = "EDT" if dst and dst.total_seconds() > 0 else "EST"
    return local.strftime(f"%A, %b %-d at %-I:%M %p {tz_label}")


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
    """Return the next trigger datetime respecting preferred time-of-day if set.

    When preferred_hour is given the first trigger is the very next occurrence of
    that time (could be minutes away), so users can test immediately.  Subsequent
    triggers advance by interval_hours (handled by _next_trigger in reminder_task).
    """
    if preferred_hour is None:
        return now + timedelta(hours=interval_hours)

    minute = preferred_minute or 0
    candidate = now.replace(hour=preferred_hour, minute=minute, second=0, microsecond=0)
    if candidate <= now:
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

    # ── Confirmation notification ─────────────────────────────────────────────
    if reminder.reminder_type != 'co2_limit':
        fire_time = _fmt_time(next_trigger) if next_trigger else "when triggered"
        confirm_msg = (
            f'✅ Reminder set for "{project.name}"\n'
            f'You\'ll be notified {fire_time} (and every {body.interval_hours}h after):\n'
            f'"{reminder.message}"'
        )
        if reminder.email_enabled and current_user.email:
            send_email(
                current_user.email,
                f'Fizz Bizz — Reminder Created: {project.name}',
                confirm_msg,
            )
        if reminder.sms_enabled and phone:
            send_sms(phone, confirm_msg)

    return reminder


def _friendly_interval(hours: int) -> str:
    if hours < 24:
        return f"every {hours} hour{'s' if hours != 1 else ''}"
    if hours < 168:
        days = hours // 24
        return f"every {days} day{'s' if days != 1 else ''}"
    if hours < 720:
        weeks = hours // 168
        return f"every {weeks} week{'s' if weeks != 1 else ''}"
    months = hours // 720
    return f"every {months} month{'s' if months != 1 else ''}"


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

    updated_fields = body.model_dump(exclude_unset=True)
    for field, value in updated_fields.items():
        setattr(reminder, field, value)

    # Recalculate next trigger if interval or preferred time changed
    timing_changed = any(f in updated_fields for f in ('interval_hours', 'preferred_hour', 'preferred_minute'))
    if reminder.reminder_type != 'co2_limit' and timing_changed:
        now = datetime.now(timezone.utc)
        reminder.next_trigger_at = _calc_next_trigger(
            now, reminder.interval_hours, reminder.preferred_hour, reminder.preferred_minute
        )

    db.commit()
    db.refresh(reminder)

    # ── Update confirmation notification ──────────────────────────────────────
    meaningful = {k for k in updated_fields if k not in ('is_active',)}
    if meaningful and reminder.reminder_type != 'co2_limit':
        project = db.query(FermentationProject).filter_by(id=reminder.project_id).first()
        project_name = project.name if project else f"project #{reminder.project_id}"

        lines = [f'✏️ Reminder updated for "{project_name}"']
        if 'interval_hours' in updated_fields:
            lines.append(f'  • Frequency: {_friendly_interval(reminder.interval_hours)}')
        if 'preferred_hour' in updated_fields or 'preferred_minute' in updated_fields:
            if reminder.preferred_hour is not None:
                h, m = reminder.preferred_hour, reminder.preferred_minute or 0
                lines.append(f'  • Time: {h:02d}:{m:02d} UTC')
            else:
                lines.append('  • Time: no preferred time set')
        if 'message' in updated_fields:
            lines.append(f'  • Message: "{reminder.message}"')
        if reminder.next_trigger_at:
            lines.append(f'  • Next reminder: {_fmt_time(reminder.next_trigger_at)}')

        notify_msg = '\n'.join(lines)
        if reminder.email_enabled and current_user.email:
            send_email(
                current_user.email,
                f'Fizz Bizz — Reminder Updated: {project_name}',
                notify_msg,
            )
        phone = reminder.phone_number or current_user.phone_number
        if reminder.sms_enabled and phone:
            send_sms(phone, notify_msg)

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
