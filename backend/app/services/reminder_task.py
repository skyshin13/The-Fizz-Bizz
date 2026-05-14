"""
Background task that fires scheduled reminders (SMS and/or email) automatically.
Runs every 60 seconds, checks for due reminders, notifies, and advances next_trigger_at.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import or_
from app.db.database import SessionLocal
from app.models.models import Reminder, FermentationProject, User, ProjectCERState
from app.services.twilio_service import send_sms
from app.services.sendgrid_service import send_email

logger = logging.getLogger(__name__)

_EST = ZoneInfo("America/New_York")
CO2_ALERT_COOLDOWN_HOURS = 4


def _next_trigger(reminder: Reminder, now: datetime) -> datetime:
    """Compute the next trigger time after a reminder fires."""
    if reminder.preferred_hour is not None:
        minute = reminder.preferred_minute or 0
        base = now + timedelta(hours=reminder.interval_hours)
        base_local = base.astimezone(_EST)
        candidate_local = base_local.replace(
            hour=reminder.preferred_hour, minute=minute, second=0, microsecond=0
        )
        if candidate_local < base_local - timedelta(hours=1):
            candidate_local += timedelta(days=1)
        return candidate_local.astimezone(timezone.utc)
    return now + timedelta(hours=reminder.interval_hours)


def _process_co2_alerts(db, now: datetime):
    """Check live CER PSI against co2_limit thresholds and fire alerts."""
    alerts = db.query(Reminder).filter(
        Reminder.reminder_type == 'co2_limit',
        Reminder.is_active == True,
        or_(Reminder.sms_enabled == True, Reminder.email_enabled == True),
    ).all()

    for alert in alerts:
        try:
            # Skip if still in cooldown
            if alert.next_trigger_at:
                triggered_at = alert.next_trigger_at
                if triggered_at.tzinfo is None:
                    triggered_at = triggered_at.replace(tzinfo=timezone.utc)
                if triggered_at > now:
                    continue

            threshold_psi = alert.interval_hours  # PSI threshold stored in interval_hours field

            state = db.query(ProjectCERState).filter_by(project_id=alert.project_id).first()
            if not state:
                continue

            current_psi = max(0.0, state.psi_cumulative - state.psi_released)
            if current_psi < threshold_psi:
                continue

            project = db.query(FermentationProject).filter_by(id=alert.project_id).first()
            user = db.query(User).filter_by(id=alert.user_id).first()
            if not project or not user:
                continue

            co2_msg = (
                f'💥 CO₂ alert for "{project.name}": '
                f'current PSI is {current_psi:.1f}, which has reached your '
                f'alert threshold of {threshold_psi} PSI. '
                f'Consider venting your vessel.'
            )

            if alert.sms_enabled:
                phone = alert.phone_number or user.phone_number
                if phone:
                    send_sms(phone, co2_msg)

            if alert.email_enabled and user.email:
                ok = send_email(
                    user.email,
                    f'Fizz Bizz CO₂ Alert — {project.name}',
                    co2_msg,
                )
                if not ok:
                    logger.warning(f"CO₂ alert email failed for reminder {alert.id} → {user.email}")

            # Set cooldown so we don't spam every 60 seconds
            alert.next_trigger_at = now + timedelta(hours=CO2_ALERT_COOLDOWN_HOURS)
            logger.info(f"CO₂ alert fired for project {project.id} ({current_psi:.1f} PSI >= {threshold_psi} PSI)")

        except Exception as e:
            logger.error(f"Failed to process CO₂ alert {alert.id}: {e}")


def _process_due_reminders():
    """Query and fire all currently-due reminders. Safe to call at any time."""
    db = None
    try:
        db = SessionLocal()
        now = datetime.now(timezone.utc)

        # ── Scheduled reminders (ph_check, gravity_check, look_at_project) ──
        due = db.query(Reminder).filter(
            Reminder.is_active == True,
            or_(Reminder.sms_enabled == True, Reminder.email_enabled == True),
            Reminder.next_trigger_at != None,
            Reminder.next_trigger_at <= now,
            Reminder.reminder_type != 'co2_limit',
        ).all()

        for reminder in due:
            try:
                project = db.query(FermentationProject).filter(
                    FermentationProject.id == reminder.project_id
                ).first()
                user = db.query(User).filter(User.id == reminder.user_id).first()

                if project:
                    msg = f'Fizz Bizz reminder for "{project.name}": {reminder.message}'

                    if reminder.sms_enabled:
                        phone = reminder.phone_number or (user.phone_number if user else None)
                        if phone:
                            send_sms(phone, msg)

                    if reminder.email_enabled and user and user.email:
                        ok = send_email(
                            user.email,
                            f'Fizz Bizz Reminder: {project.name}',
                            msg,
                        )
                        if not ok:
                            logger.warning(
                                f"Email delivery failed for reminder {reminder.id} → {user.email}"
                            )

                reminder.next_trigger_at = _next_trigger(reminder, now)
            except Exception as e:
                logger.error(f"Failed to process reminder {reminder.id}: {e}")

        # ── CO₂ PSI threshold alerts (checked against live CER state) ──
        _process_co2_alerts(db, now)

        db.commit()
    except Exception as e:
        logger.error(f"Reminder loop DB error: {e}")
        if db:
            try:
                db.rollback()
            except Exception:
                pass
    finally:
        if db:
            db.close()


async def reminder_loop():
    logger.info("Reminder loop started.")
    # Check immediately on startup to catch any reminders missed while the server was down
    _process_due_reminders()
    while True:
        await asyncio.sleep(60)
        _process_due_reminders()
