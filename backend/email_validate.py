"""Allowlist-based email validation. Only major personal providers (incl. the
big Bulgarian ones) are accepted; custom/corporate and disposable domains are
rejected. Extend ALLOWED_DOMAINS as needed."""
import re

ALLOWED_DOMAINS = {
    # global
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
    "outlook.com", "hotmail.com", "live.com", "msn.com",
    "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com",
    # Bulgarian
    "abv.bg", "mail.bg", "dir.bg", "gbg.bg", "techno-link.com",
}

_EMAIL_RE = re.compile(r"^[^@\s]+@([^@\s]+\.[^@\s]+)$")


def normalize(email: str) -> str:
    return (email or "").strip().lower()


def domain_of(email: str):
    m = _EMAIL_RE.match(normalize(email))
    return m.group(1) if m else None


def is_allowed(email: str) -> bool:
    d = domain_of(email)
    return d in ALLOWED_DOMAINS
