"""Shared helpers: cached HTTP, SQLite, EUR canonicalization, name normalization."""
import os, ssl, json, sqlite3, urllib.request, urllib.parse, hashlib, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))   # dokoga/
CACHE = os.path.join(ROOT, "data", "cache")
DB_PATH = os.path.join(ROOT, "data", "app", "integrity.sqlite")
os.makedirs(CACHE, exist_ok=True)

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE
_UA = "Mozilla/5.0 (IntegrityBG research POC)"
BGN_PER_EUR = 1.95583


def _cache_name(url: str) -> str:
    return os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".bin")


def fetch(url: str, cache: bool = True) -> bytes:
    """GET with on-disk cache (idempotent re-runs don't re-download)."""
    cp = _cache_name(url)
    if cache and os.path.exists(cp) and os.path.getsize(cp) > 0:
        return open(cp, "rb").read()
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    data = urllib.request.urlopen(req, context=_CTX, timeout=120).read()
    if cache:
        open(cp, "wb").write(data)
    return data


def fetch_json(url: str, cache: bool = True):
    return json.loads(fetch(url, cache).decode("utf-8"))


def db(fresh: bool = False) -> sqlite3.Connection:
    if fresh and os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(open(os.path.join(HERE, "schema.sql"), encoding="utf-8").read())
    return con


def to_eur(value, currency: str):
    """Canonical EUR (safe to compare). POC: BGN by fixed peg, EUR as-is, else None."""
    if value is None:
        return None
    c = (currency or "BGN").upper()
    if c == "EUR":
        return float(value)
    if c == "BGN":
        return float(value) / BGN_PER_EUR
    return None  # foreign currency: needs FX (out of POC scope)


def norm_name(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().upper())


def num(v):
    """Parse a number, including Bulgarian format: '1 234,56' or '1.234,56' -> 1234.56."""
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("\xa0", "").replace(" ", "")
    if "," in s and "." in s:        # European: '.' thousands, ',' decimal
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:                    # ',' decimal
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def day_iso(v):
    """Normalize a date to YYYY-MM-DD, or None."""
    if not v:
        return None
    s = str(v)
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"(\d{1,2})[./](\d{1,2})[./](\d{4})", s)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return None
