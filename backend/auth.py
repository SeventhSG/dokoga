"""Light pseudonymous auth: dev OTP + in-memory session tokens + device rows.
Replace request_otp/verify_otp's code check with a real SMS provider later."""
import hashlib, secrets

_SESSIONS: dict[str, int] = {}


def _h(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def request_otp(phone: str) -> None:
    return  # dev: real provider sends SMS here


def verify_otp(con, phone, code, fingerprint):
    if not (code and code.isdigit() and len(code) == 6):
        raise ValueError("bad_code")
    ph = _h(phone)
    con.execute("INSERT OR IGNORE INTO users (phone_hash) VALUES (?)", (ph,))
    user_id = con.execute("SELECT id FROM users WHERE phone_hash=?", (ph,)).fetchone()[0]
    con.execute("INSERT OR IGNORE INTO devices (user_id, fingerprint) VALUES (?,?)",
                (user_id, fingerprint))
    device_id = con.execute(
        "SELECT id FROM devices WHERE user_id=? AND fingerprint=?",
        (user_id, fingerprint)).fetchone()[0]
    con.commit()
    token = secrets.token_urlsafe(24)
    _SESSIONS[token] = user_id
    return {"token": token, "user_id": user_id, "device_id": device_id}


def user_from_token(token):
    return _SESSIONS.get(token or "")
