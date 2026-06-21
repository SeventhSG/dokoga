"""Sends verification codes via Resend.

Security: we NEVER leak the code unless DOKOGA_DEV=1 is explicitly set. If no
RESEND_API_KEY is configured and we're not in dev, send_code raises so the
caller fails closed (no silent "sent" with the code exposed)."""
import json, os, urllib.request

API = "https://api.resend.com/emails"
FROM = os.environ.get("RESEND_FROM", "Докога? <onboarding@resend.dev>")


def is_dev() -> bool:
    return os.environ.get("DOKOGA_DEV") == "1"


def _key():
    return os.environ.get("RESEND_API_KEY", "").strip()


def send_code(email: str, code: str) -> bool:
    """Returns True if an email was actually dispatched, False in dev fallback.
    Raises RuntimeError if the mailer is unconfigured and not in dev mode."""
    key = _key()
    if key:
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
    if is_dev():
        print(f"[mailer:dev] code for {email}: {code[0]}*****")  # masked
        return False
    raise RuntimeError("mailer_unconfigured")
