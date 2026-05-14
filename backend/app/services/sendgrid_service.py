import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email via SendGrid. Returns True on success, False if not configured or on error."""
    if not all([settings.SENDGRID_API_KEY, settings.SENDGRID_FROM_EMAIL]):
        logger.warning("SendGrid credentials not configured — email not sent.")
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.SENDGRID_FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            plain_text_content=body,
        )
        client = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = client.send(message)
        msg_id = response.headers.get("X-Message-Id", "unknown")
        if response.status_code in (200, 202):
            logger.info(f"Email accepted by SendGrid → {to_email} (msg_id={msg_id})")
            return True
        logger.error(f"SendGrid rejected email to {to_email}: status={response.status_code}")
        return False
    except Exception as e:
        logger.error(f"SendGrid email error: {e}")
        return False
