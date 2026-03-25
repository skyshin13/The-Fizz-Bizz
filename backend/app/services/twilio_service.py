import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_sms(to_number: str, message: str) -> bool:
    """Send an SMS via Twilio. Returns True on success, False if not configured or on error."""
    if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
        logger.warning("Twilio credentials not configured — SMS not sent.")
        return False
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=to_number,
        )
        logger.info(f"SMS sent to {to_number}")
        return True
    except Exception as e:
        logger.error(f"Twilio SMS error: {e}")
        return False
