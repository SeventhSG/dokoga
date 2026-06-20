"""Sends verification codes via Resend. If RESEND_API_KEY is unset (dev), it
prints the code instead of sending, so the flow is testable without a key."""
import json, os, urllib.request

API = "https://api.resend.com/emails"
FROM = os.environ.get("RESEND_FROM", "Докога? <onboarding@resend.dev>")


def _key():
    return os.environ.get("RESEND_API_KEY", "").strip()


def send_code(email: str, code: str) -> bool:
    """Returns True if an email was actually dispatched, False in dev fallback."""
    key = _key()
    if not key:
        print(f"[mailer:dev] verification code for {email}: {code}")
        return False
    body = json.dumps({
        "from": FROM,
        "to": [email],
        "subject": "Твоят код за Докога?",
        "html": f"<p>Кодът ти за вход в <b>Докога?</b> е:</p>"
                f"<p style='font-size:28px;font-weight:700;letter-spacing:4px'>{code}</p>"
                f"<p>Валиден е 10 минути. Ако не си го поискал, игнорирай това писмо.</p>",
    }).encode("utf-8")
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "User-Agent": "dokoga/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return 200 <= r.status < 300
