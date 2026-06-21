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


_GMAIL = {"gmail.com", "googlemail.com"}


def normalize(email: str) -> str:
    """Lowercase/trim, and canonicalize Gmail so dots and +tags don't create
    distinct identities (one mailbox = one account for the abuse model)."""
    e = (email or "").strip().lower()
    if "@" not in e:
        return e
    local, _, dom = e.partition("@")
    if dom in _GMAIL:
        local = local.split("+", 1)[0].replace(".", "")
        dom = "gmail.com"
    else:
        local = local.split("+", 1)[0]
    return f"{local}@{dom}"


def domain_of(email: str):
    m = _EMAIL_RE.match(normalize(email))
    return m.group(1) if m else None


def is_allowed(email: str) -> bool:
    d = domain_of(email)
    return d in ALLOWED_DOMAINS
