"""Email-verification auth: allowlisted email -> 6-digit code (Resend) ->
persisted session token (cookie). Pseudonymous: we store name + a hash of the
email, never display real identity publicly."""
import hashlib, secrets

import email_validate, mailer

CODE_TTL_MIN = 10
MAX_ATTEMPTS = 5
RATE_N = 3        # max code requests ...
RATE_DAYS = 3    # ... per this many days, per email


def _h(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()


def _ehash(email: str) -> str:
    return _h(email_validate.normalize(email))


def request_code(con, name, email):
    """Validate + rate-limit + send a code. Raises ValueError(reason)."""
    if not email_validate.is_allowed(email):
        raise ValueError("bad_domain")
    if not (name and name.strip()):
        raise ValueError("no_name")
    eh = _ehash(email)
    recent = con.execute(
        "SELECT COUNT(*) FROM email_codes WHERE email_hash=? "
        "AND created_at >= datetime('now', ?)", (eh, f"-{RATE_DAYS} days")).fetchone()[0]
    if recent >= RATE_N:
        raise ValueError("rate_limited")
    code = f"{secrets.randbelow(1000000):06d}"
    con.execute(
        "INSERT INTO email_codes (email_hash, code_hash, name) VALUES (?,?,?)",
        (eh, _h(eh + ":" + code), name.strip()[:80]))
    con.commit()
    sent = mailer.send_code(email_validate.normalize(email), code)
    return {"sent": sent, "dev_code": None if sent else code}


def verify_code(con, email, code):
    """Check the latest code; on success create/reuse user + session.
    Raises ValueError(reason)."""
    eh = _ehash(email)
    row = con.execute(
        "SELECT id, code_hash, name, attempts FROM email_codes "
        "WHERE email_hash=? AND consumed=0 "
        "AND created_at >= datetime('now', ?) "
        "ORDER BY id DESC LIMIT 1", (eh, f"-{CODE_TTL_MIN} minutes")).fetchone()
    if not row:
        raise ValueError("expired")
    if row["attempts"] >= MAX_ATTEMPTS:
        raise ValueError("too_many")
    if _h(eh + ":" + (code or "")) != row["code_hash"]:
        con.execute("UPDATE email_codes SET attempts=attempts+1 WHERE id=?", (row["id"],))
        con.commit()
        raise ValueError("bad_code")
    con.execute("UPDATE email_codes SET consumed=1 WHERE id=?", (row["id"],))
    con.execute("INSERT OR IGNORE INTO users (email_hash, name) VALUES (?,?)", (eh, row["name"]))
    con.execute("UPDATE users SET name=COALESCE(name, ?) WHERE email_hash=?", (row["name"], eh))
    user_id = con.execute("SELECT id FROM users WHERE email_hash=?", (eh,)).fetchone()[0]
    token = secrets.token_urlsafe(24)
    con.execute("INSERT INTO sessions (token_hash, user_id) VALUES (?,?)", (_h(token), user_id))
    con.commit()
    return {"token": token, "user_id": user_id, "name": row["name"]}


def user_from_token(con, token):
    if not token:
        return None
    r = con.execute("SELECT user_id FROM sessions WHERE token_hash=?", (_h(token),)).fetchone()
    return r[0] if r else None


def user_record(con, user_id):
    r = con.execute("SELECT id, name FROM users WHERE id=?", (user_id,)).fetchone()
    return {"user_id": r[0], "name": r[1]} if r else None
