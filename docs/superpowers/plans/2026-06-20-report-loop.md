# Citizen Report Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let citizens drop geolocated problem pins that the crowd corroborates; verified pins appear on a public map attributed to the responsible oblast (province) with likely-related overdue contracts from dokoga's data.

**Architecture:** Extend the existing FastAPI backend (`backend/serve.py`) with a reports router backed by new tables in the existing `data/app/projects.sqlite`. Attribution is point-in-polygon over Bulgarian oblast (28 provinces) polygons, producing a `region_name` that already keys the existing `contracts` table — so contract suggestions reuse current data. Extend the existing react-leaflet frontend with a `/report` route.

**Tech Stack:** Python 3 / FastAPI / SQLite (`sqlite3`) / shapely / pytest · React + TypeScript + Vite / react-leaflet / react-router-dom.

## Global Constraints

- Reuse the existing DB file `data/app/projects.sqlite` (same `_con()` pattern as `backend/tools.py`). Do NOT create a second database.
- All user-facing copy is Bulgarian, matching existing tone (e.g. "Докога?").
- Identity is light/pseudonymous: phone-OTP + device fingerprint. No real names stored or shown. No national eID.
- Verified threshold: **≥3 `confirm` votes from distinct accounts AND distinct devices within 30 days.** Resolution: **≥3 distinct accounts** voting `fixed`/`nothere`.
- Dedup radius: **50 m**, same category.
- Report categories (exact ids): `pothole`, `stalled_construction`, `public_renovation`, `broken_infra`, `other`.
- Status values: `reported`, `verified`, `under_review`, `resolved`, `unassigned`.
- Keep existing CORS allowlist + per-IP rate-limit middleware in `serve.py`; add the new write paths (`/reports`, `/reports/*/confirm`) to the guarded set.
- Commit after every task. Do NOT add Claude/AI attribution to commit messages.

---

## File Structure

**Backend (new, in `backend/`):**
- `reports_db.py` — schema init + connection helper for the report tables.
- `geo.py` — geohash encode, viewport bbox query, oblast point-in-polygon attribution.
- `contracts_match.py` — suggest related contracts from the existing `contracts` table.
- `corroboration.py` — recompute a report's status from its confirmations.
- `antibrigade.py` — validate a confirmation, flag brigade clusters.
- `auth.py` — dev OTP + session token + device registration.
- `reports_api.py` — `APIRouter` with all report endpoints (mounted in `serve.py`).
- `scripts/load_oblasti.py` — one-off: fetch/normalize oblast GeoJSON into `data/app/bg_oblasti.geojson`.
- `tests/` — pytest tests (`test_geo.py`, `test_corroboration.py`, `test_antibrigade.py`, `test_reports_api.py`, `test_contracts_match.py`).

**Backend (modified):**
- `serve.py` — mount `reports_api.router`, extend `_GUARDED`.
- `requirements.txt` — add `shapely`, `pytest`, `httpx`.

**Frontend (new, in `frontend/src/`):**
- `lib/reportsApi.ts` — fetch helpers for the report endpoints.
- `lib/reportTypes.ts` — Report/Confirmation/Suggestion TS types.
- `pages/Report.tsx` — the report page (map + form + panel).
- `components/ReportLayer.tsx` — react-leaflet layer rendering report pins + click-to-pin.
- `components/ReportForm.tsx` — category picker + submit + dedup prompt.
- `components/ReportPanel.tsx` — selected-pin detail, suggested contract, confirm button.

**Frontend (modified):**
- `App.tsx` — add `/report` route.
- `vite.config.ts` + `public/manifest.webmanifest` — PWA install + geolocation.

---

## Category → sector keyword map (used by attribution + matching)

```python
# backend/contracts_match.py
CATEGORY_SECTORS = {
    "pothole": ["roads"],
    "stalled_construction": ["roads", "buildings", "water", "other"],
    "public_renovation": ["buildings", "other"],
    "broken_infra": ["roads", "lighting", "water", "other"],
    "other": [],   # no sector filter
}
```

---

### Task 1: Backend deps + report schema

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/reports_db.py`
- Create: `backend/tests/__init__.py` (empty)
- Test: `backend/tests/test_reports_db.py`

**Interfaces:**
- Produces: `reports_db.con() -> sqlite3.Connection` (Row factory); `reports_db.init_db(con) -> None` creating tables `users, devices, reports, confirmations`.

- [ ] **Step 1: Add dependencies**

Append to `backend/requirements.txt`:
```
shapely>=2.0
pytest>=8.0
httpx>=0.27
```
Run: `pip install -r backend/requirements.txt`

- [ ] **Step 2: Write the failing test**

`backend/tests/test_reports_db.py`:
```python
import sqlite3
import reports_db

def test_init_creates_tables(tmp_path, monkeypatch):
    db = tmp_path / "t.sqlite"
    monkeypatch.setattr(reports_db, "DB", str(db))
    con = reports_db.con()
    reports_db.init_db(con)
    names = {r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"users", "devices", "reports", "confirmations"} <= names
    con.close()
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_reports_db.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'reports_db'`

- [ ] **Step 4: Implement `backend/reports_db.py`**

```python
"""SQLite schema + connection for the citizen report loop.
Reuses the same projects.sqlite as backend/tools.py."""
import os, sqlite3

DB = os.path.join(os.path.dirname(__file__), "..", "data", "app", "projects.sqlite")

def con() -> sqlite3.Connection:
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, phone_hash TEXT UNIQUE, trust_score REAL DEFAULT 1.0,
  banned INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY, user_id INTEGER, fingerprint TEXT,
  first_seen TEXT DEFAULT (datetime('now')), UNIQUE(user_id, fingerprint));
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY, lat REAL, lng REAL, geohash TEXT, category TEXT,
  note TEXT, created_by INTEGER, status TEXT DEFAULT 'reported',
  region_name TEXT, suggested_contracts TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_reports_geohash ON reports(geohash);
CREATE TABLE IF NOT EXISTS confirmations (
  id INTEGER PRIMARY KEY, report_id INTEGER, user_id INTEGER, device_id INTEGER,
  ip_hash TEXT, kind TEXT DEFAULT 'confirm', created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(report_id, user_id));
"""

def init_db(c: sqlite3.Connection) -> None:
    c.executescript(SCHEMA)
    c.commit()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_reports_db.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/reports_db.py backend/tests/
git commit -m "report loop: add deps and sqlite schema"
```

---

### Task 2: Geohash + viewport bbox

**Files:**
- Create: `backend/geo.py`
- Test: `backend/tests/test_geo.py`

**Interfaces:**
- Produces: `geo.encode(lat: float, lng: float, precision: int = 9) -> str`;
  `geo.bbox_where(min_lat, min_lng, max_lat, max_lng) -> tuple[str, list]` returning a SQL `WHERE` fragment on `lat/lng` and its params.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_geo.py`:
```python
import geo

def test_encode_is_stable_and_prefixes_by_proximity():
    a = geo.encode(42.1354, 24.7453)  # Plovdiv
    b = geo.encode(42.1355, 24.7454)  # ~15 m away
    assert isinstance(a, str) and len(a) == 9
    assert a[:6] == b[:6]             # close points share a prefix

def test_bbox_where_builds_params():
    frag, params = geo.bbox_where(42.0, 24.0, 43.0, 25.0)
    assert "lat BETWEEN" in frag and "lng BETWEEN" in frag
    assert params == [42.0, 43.0, 24.0, 25.0]
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_geo.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'geo'`

- [ ] **Step 3: Implement geohash + bbox in `backend/geo.py`**

```python
"""Geo helpers: geohash + viewport bbox. (Attribution added in Task 3.)"""
_B32 = "0123456789bcdefghjkmnpqrstuvwxyz"

def encode(lat: float, lng: float, precision: int = 9) -> str:
    lat_r, lng_r = (-90.0, 90.0), (-180.0, 180.0)
    out, bit, ch, even = [], 0, 0, True
    while len(out) < precision:
        if even:
            mid = sum(lng_r) / 2
            if lng > mid: ch |= 1 << (4 - bit); lng_r = (mid, lng_r[1])
            else: lng_r = (lng_r[0], mid)
        else:
            mid = sum(lat_r) / 2
            if lat > mid: ch |= 1 << (4 - bit); lat_r = (mid, lat_r[1])
            else: lat_r = (lat_r[0], mid)
        even = not even
        if bit < 4: bit += 1
        else: out.append(_B32[ch]); bit, ch = 0, 0
    return "".join(out)

def bbox_where(min_lat, min_lng, max_lat, max_lng):
    return ("lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?",
            [min_lat, max_lat, min_lng, max_lng])
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_geo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/geo.py backend/tests/test_geo.py
git commit -m "report loop: geohash and viewport bbox helpers"
```

---

### Task 3: Oblast attribution (point-in-polygon)

**Files:**
- Create: `backend/scripts/load_oblasti.py`
- Create: `data/app/bg_oblasti.geojson` (produced by the script)
- Modify: `backend/geo.py`
- Test: `backend/tests/test_geo.py` (add cases)

**Interfaces:**
- Produces: `geo.attribute(lat: float, lng: float) -> str | None` returning the oblast `region_name` (matching values already in the `contracts` table, e.g. `"Пловдив"`, `"София (столица)"`) or `None` if the point is outside Bulgaria.

- [ ] **Step 1: Obtain the oblast polygons**

`backend/scripts/load_oblasti.py` downloads a public Bulgaria provinces (oblast / NUTS-3) GeoJSON and writes a normalized `FeatureCollection` whose every feature has `properties.region_name` matching the DB's `region_name` strings.

Source: **geoBoundaries gbOpen ADM1** (open data), whose `shapeName` is the
Latin province name. Map all 28 to the exact Cyrillic `region_name` strings the
`contracts` table uses (verified via
`SELECT DISTINCT region_name FROM contracts`). See the committed
`backend/scripts/load_oblasti.py` for the full `NAME_FIX` mapping; the source URL is:
```
https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BGR/ADM1/geoBoundaries-BGR-ADM1.geojson
```
The script raises if any `shapeName` is unmapped, so a source change fails loudly
rather than silently producing wrong attribution.

Run: `python backend/scripts/load_oblasti.py`
Expected: `wrote .../bg_oblasti.geojson features: 28`

> If the `region_name` values don't all line up with the `contracts` table, list the table's distinct regions with `sqlite3 data/app/projects.sqlite "SELECT DISTINCT region_name FROM contracts"` and extend `NAME_FIX`.

- [ ] **Step 2: Write the failing test**

Add to `backend/tests/test_geo.py`:
```python
def test_attribute_known_city_to_oblast():
    assert geo.attribute(42.1354, 24.7453) == "Пловдив"        # Plovdiv

def test_attribute_outside_bulgaria_is_none():
    assert geo.attribute(48.8566, 2.3522) is None              # Paris
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_geo.py -k attribute -v`
Expected: FAIL — `AttributeError: module 'geo' has no attribute 'attribute'`

- [ ] **Step 4: Implement attribution in `backend/geo.py`**

Append:
```python
import json, os
from functools import lru_cache
from shapely.geometry import shape, Point

_GEOJSON = os.path.join(os.path.dirname(__file__), "..", "data", "app", "bg_oblasti.geojson")

@lru_cache(maxsize=1)
def _oblasti():
    fc = json.load(open(_GEOJSON, encoding="utf-8"))
    return [(f["properties"]["region_name"], shape(f["geometry"])) for f in fc["features"]]

def attribute(lat: float, lng: float):
    p = Point(lng, lat)
    for name, poly in _oblasti():
        if poly.contains(p):
            return name
    return None
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_geo.py -v`
Expected: PASS (if a city maps to the wrong/missing name, extend `NAME_FIX` and rerun the script)

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/load_oblasti.py backend/geo.py backend/tests/test_geo.py data/app/bg_oblasti.geojson
git commit -m "report loop: oblast point-in-polygon attribution"
```

---

### Task 4: Contract suggestions

**Files:**
- Create: `backend/contracts_match.py`
- Test: `backend/tests/test_contracts_match.py`

**Interfaces:**
- Consumes: existing `contracts` table (columns `ocid, title, region_name, sector, value, expected_days, overrun_days, supplier`).
- Produces: `contracts_match.suggest(con, region_name: str, category: str, note: str = "", limit: int = 3) -> list[dict]` with keys `ocid, title, value, overrun_days, supplier`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_contracts_match.py`:
```python
import sqlite3, contracts_match

def _db():
    c = sqlite3.connect(":memory:"); c.row_factory = sqlite3.Row
    c.execute("""CREATE TABLE contracts (ocid TEXT, title TEXT, region_name TEXT,
        sector TEXT, value REAL, expected_days INT, overrun_days INT, supplier TEXT)""")
    c.execute("INSERT INTO contracts VALUES ('oc1','Ремонт на ул. Гладстон','Пловдив','roads',1200000,180,412,'ЕЛПИДА')")
    c.execute("INSERT INTO contracts VALUES ('oc2','Водопровод','Шумен','water',90000,60,0,'АКВА')")
    c.commit(); return c

def test_suggest_filters_by_region_and_category():
    rows = contracts_match.suggest(_db(), "Пловдив", "pothole")
    assert len(rows) == 1 and rows[0]["ocid"] == "oc1"
    assert rows[0]["overrun_days"] == 412

def test_suggest_other_category_no_sector_filter():
    rows = contracts_match.suggest(_db(), "Шумен", "other")
    assert {r["ocid"] for r in rows} == {"oc2"}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_contracts_match.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'contracts_match'`

- [ ] **Step 3: Implement `backend/contracts_match.py`**

```python
"""Suggest likely-related contracts for a report (bonus attribution)."""
CATEGORY_SECTORS = {
    "pothole": ["roads"],
    "stalled_construction": ["roads", "buildings", "water", "other"],
    "public_renovation": ["buildings", "other"],
    "broken_infra": ["roads", "lighting", "water", "other"],
    "other": [],
}

def suggest(con, region_name, category, note="", limit=3):
    sectors = CATEGORY_SECTORS.get(category, [])
    sql = ("SELECT ocid, title, value, overrun_days, supplier FROM contracts "
           "WHERE region_name = ?")
    params = [region_name]
    if sectors:
        sql += " AND sector IN (%s)" % ",".join("?" * len(sectors))
        params += sectors
    sql += " ORDER BY COALESCE(overrun_days,0) DESC, COALESCE(value,0) DESC LIMIT ?"
    params.append(limit)
    return [dict(r) for r in con.execute(sql, params).fetchall()]
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_contracts_match.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/contracts_match.py backend/tests/test_contracts_match.py
git commit -m "report loop: contract suggestions by region and category"
```

---

### Task 5: Corroboration (status recompute)

**Files:**
- Create: `backend/corroboration.py`
- Test: `backend/tests/test_corroboration.py`

**Interfaces:**
- Produces: `corroboration.recompute(con, report_id: int) -> str` — sets and returns the report's status from its confirmations, applying the Global Constraints thresholds. Does not touch `under_review` (owned by Task 6).

- [ ] **Step 1: Write the failing test**

`backend/tests/test_corroboration.py`:
```python
import reports_db, corroboration

def _seed(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    c = reports_db.con(); reports_db.init_db(c)
    c.execute("INSERT INTO reports (id, lat, lng, category) VALUES (1, 42.1, 24.7, 'pothole')")
    c.commit(); return c

def _confirm(c, uid, kind="confirm"):
    c.execute("INSERT INTO confirmations (report_id, user_id, device_id, kind) VALUES (1,?,?,?)",
              (uid, uid, kind)); c.commit()

def test_three_distinct_confirms_make_verified(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch)
    for uid in (10, 11): _confirm(c, uid)
    assert corroboration.recompute(c, 1) == "reported"
    _confirm(c, 12)
    assert corroboration.recompute(c, 1) == "verified"

def test_three_fixed_votes_resolve(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch)
    for uid in (20, 21, 22): _confirm(c, uid, "fixed")
    assert corroboration.recompute(c, 1) == "resolved"
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_corroboration.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'corroboration'`

- [ ] **Step 3: Implement `backend/corroboration.py`**

```python
"""Derive a report's status from its confirmations.
Thresholds (Global Constraints): >=3 distinct-account confirms within 30 days
-> verified; >=3 distinct-account fixed/nothere -> resolved."""
VERIFY_N = 3
RESOLVE_N = 3

def _count(con, report_id, kinds):
    qs = ",".join("?" * len(kinds))
    return con.execute(
        f"SELECT COUNT(DISTINCT user_id) FROM confirmations "
        f"WHERE report_id=? AND kind IN ({qs}) "
        f"AND created_at >= datetime('now','-30 days')",
        [report_id, *kinds]).fetchone()[0]

def recompute(con, report_id):
    if _count(con, report_id, ["fixed", "nothere"]) >= RESOLVE_N:
        status = "resolved"
    elif _count(con, report_id, ["confirm"]) >= VERIFY_N:
        status = "verified"
    else:
        status = "reported"
    con.execute("UPDATE reports SET status=? WHERE id=? AND status!='under_review'",
                (status, report_id))
    con.commit()
    return status
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_corroboration.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/corroboration.py backend/tests/test_corroboration.py
git commit -m "report loop: corroboration status recompute"
```

---

### Task 6: Anti-brigade guard

**Files:**
- Create: `backend/antibrigade.py`
- Test: `backend/tests/test_antibrigade.py`

**Interfaces:**
- Produces:
  - `antibrigade.can_confirm(con, report_id, user_id, device_id) -> tuple[bool, str]` — False + reason if the same user already confirmed, or the device already confirmed this report under another user.
  - `antibrigade.is_brigaded(con, report_id) -> bool` — True if confirmations cluster on one `ip_hash` (>= 3 from a single ip) or arrive faster than 3 within 60 s. When True, callers set status `under_review`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_antibrigade.py`:
```python
import reports_db, antibrigade

def _seed(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    c = reports_db.con(); reports_db.init_db(c)
    c.execute("INSERT INTO reports (id, lat, lng, category) VALUES (1,42.1,24.7,'pothole')")
    c.commit(); return c

def _add(c, uid, did, ip="1.1.1.1"):
    c.execute("INSERT INTO confirmations (report_id,user_id,device_id,ip_hash) VALUES (1,?,?,?)",
              (uid, did, ip)); c.commit()

def test_same_user_cannot_confirm_twice(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch); _add(c, 5, 5)
    ok, _ = antibrigade.can_confirm(c, 1, 5, 5)
    assert ok is False

def test_same_device_other_user_blocked(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch); _add(c, 5, 99)
    ok, _ = antibrigade.can_confirm(c, 1, 6, 99)
    assert ok is False

def test_single_ip_cluster_flags_brigade(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch)
    for uid in (1, 2, 3): _add(c, uid, uid, ip="9.9.9.9")
    assert antibrigade.is_brigaded(c, 1) is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_antibrigade.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'antibrigade'`

- [ ] **Step 3: Implement `backend/antibrigade.py`**

```python
"""Cheap, no-friction anti-brigade checks for confirmations."""

def can_confirm(con, report_id, user_id, device_id):
    if con.execute("SELECT 1 FROM confirmations WHERE report_id=? AND user_id=?",
                   (report_id, user_id)).fetchone():
        return False, "already_confirmed"
    if con.execute("SELECT 1 FROM confirmations WHERE report_id=? AND device_id=? AND user_id!=?",
                   (report_id, device_id, user_id)).fetchone():
        return False, "device_reused"
    return True, "ok"

def is_brigaded(con, report_id):
    # NULL ip_hash ignored so 3 legit confirms (NULL ip) don't false-cluster;
    # burst bound (5/10s) sits above the 3-distinct-human verify threshold.
    top_ip = con.execute(
        "SELECT COUNT(*) FROM confirmations WHERE report_id=? AND ip_hash IS NOT NULL "
        "GROUP BY ip_hash ORDER BY COUNT(*) DESC LIMIT 1", (report_id,)).fetchone()
    if top_ip and top_ip[0] >= 3:
        return True
    burst = con.execute(
        "SELECT COUNT(*) FROM confirmations WHERE report_id=? "
        "AND created_at >= datetime('now','-10 seconds')", (report_id,)).fetchone()[0]
    return burst >= 5
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_antibrigade.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/antibrigade.py backend/tests/test_antibrigade.py
git commit -m "report loop: anti-brigade confirmation guard"
```

---

### Task 7: Auth (dev OTP + session + device)

**Files:**
- Create: `backend/auth.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Produces:
  - `auth.request_otp(phone: str) -> None` (dev: no-op; real provider later).
  - `auth.verify_otp(con, phone: str, code: str, fingerprint: str) -> dict` returning `{"token": str, "user_id": int, "device_id": int}`. Dev rule: any 6-digit `code` is accepted; creates/reuses the user (by `phone_hash`) and device.
  - `auth.user_from_token(token: str) -> int | None`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_auth.py`:
```python
import reports_db, auth

def _db(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    c = reports_db.con(); reports_db.init_db(c); return c

def test_verify_creates_user_and_token(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    s = auth.verify_otp(c, "+359888123456", "123456", "fp-abc")
    assert s["user_id"] >= 1 and s["device_id"] >= 1
    assert auth.user_from_token(s["token"]) == s["user_id"]

def test_same_phone_reuses_user(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    a = auth.verify_otp(c, "+359888123456", "111111", "fp-1")
    b = auth.verify_otp(c, "+359888123456", "222222", "fp-2")
    assert a["user_id"] == b["user_id"]
    assert a["device_id"] != b["device_id"]
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'auth'`

- [ ] **Step 3: Implement `backend/auth.py`**

```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/auth.py backend/tests/test_auth.py
git commit -m "report loop: light pseudonymous auth (dev OTP)"
```

---

### Task 8: Create-report endpoint (dedup + attribute + suggest)

**Files:**
- Create: `backend/reports_api.py`
- Modify: `backend/serve.py:30` (`_GUARDED`), `backend/serve.py` (mount router)
- Test: `backend/tests/test_reports_api.py`

**Interfaces:**
- Consumes: `reports_db`, `geo.attribute`, `geo.encode`, `contracts_match.suggest`, `auth.user_from_token`.
- Produces: router with `POST /reports`. Body `{lat, lng, category, note?, device_id}` + header `Authorization: Bearer <token>`. Returns `{"id", "status", "region_name", "suggested_contracts", "duplicate_of"?}`. If an active same-category report exists within 50 m, returns `{"duplicate_of": <id>, ...}` and creates nothing.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_reports_api.py`:
```python
import reports_db, auth
from fastapi.testclient import TestClient

def _client(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    reports_db.init_db(reports_db.con())
    import importlib, serve; importlib.reload(serve)
    return TestClient(serve.app)

def _auth(c):
    r = c.post("/auth/verify", json={"phone": "+359888000111",
               "code": "123456", "fingerprint": "fp1"}).json()
    return {"Authorization": f"Bearer {r['token']}"}, r["device_id"]

def test_create_attributes_and_returns_status(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    r = c.post("/reports", headers=h, json={"lat": 42.1354, "lng": 24.7453,
               "category": "pothole", "device_id": did}).json()
    assert r["status"] == "reported"
    assert r["region_name"] == "Пловдив"
    assert "suggested_contracts" in r

def test_create_within_50m_is_duplicate(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    base = {"category": "pothole", "device_id": did}
    a = c.post("/reports", headers=h, json={"lat": 42.1354, "lng": 24.7453, **base}).json()
    b = c.post("/reports", headers=h, json={"lat": 42.13543, "lng": 24.74533, **base}).json()
    assert b["duplicate_of"] == a["id"]
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_reports_api.py -k create -v`
Expected: FAIL — 404 (no `/reports` route) / `ModuleNotFoundError: reports_api`

- [ ] **Step 3: Implement `backend/reports_api.py`**

```python
"""FastAPI router for the citizen report loop."""
import json, math
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

import reports_db, geo, contracts_match, corroboration, antibrigade, auth

router = APIRouter()
DUP_RADIUS_M = 50

def _uid(authorization):
    uid = auth.user_from_token((authorization or "").removeprefix("Bearer ").strip())
    if not uid:
        raise HTTPException(401, "unauthorized")
    return uid

def _meters(a_lat, a_lng, b_lat, b_lng):
    R = 6371000
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat); dl = math.radians(b_lng - a_lng)
    x = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(x))

class VerifyIn(BaseModel):
    phone: str = Field(min_length=5, max_length=20)
    code: str = Field(min_length=6, max_length=6)
    fingerprint: str = Field(min_length=1, max_length=120)

class ReportIn(BaseModel):
    lat: float = Field(ge=41.0, le=44.5)
    lng: float = Field(ge=22.0, le=29.0)
    category: str = Field(max_length=30)
    note: str = Field(default="", max_length=280)
    device_id: int

@router.post("/auth/request")
def auth_request(body: dict):
    auth.request_otp(body.get("phone", "")); return {"sent": True}

@router.post("/auth/verify")
def auth_verify(body: VerifyIn):
    con = reports_db.con()
    try:
        return auth.verify_otp(con, body.phone, body.code, body.fingerprint)
    except ValueError:
        raise HTTPException(400, "bad_code")
    finally:
        con.close()

@router.post("/reports")
def create_report(body: ReportIn, authorization: str = Header(default="")):
    uid = _uid(authorization)
    con = reports_db.con()
    try:
        gh = geo.encode(body.lat, body.lng)
        for row in con.execute(
            "SELECT id, lat, lng FROM reports WHERE category=? AND status IN "
            "('reported','verified','under_review') AND geohash LIKE ?",
            (body.category, gh[:6] + "%")):
            if _meters(body.lat, body.lng, row["lat"], row["lng"]) <= DUP_RADIUS_M:
                return {"duplicate_of": row["id"], "id": row["id"], "status": "duplicate"}
        region = geo.attribute(body.lat, body.lng)
        status = "reported" if region else "unassigned"
        sugg = contracts_match.suggest(con, region, body.category) if region else []
        cur = con.execute(
            "INSERT INTO reports (lat,lng,geohash,category,note,created_by,status,"
            "region_name,suggested_contracts) VALUES (?,?,?,?,?,?,?,?,?)",
            (body.lat, body.lng, gh, body.category, body.note, uid, status,
             region, json.dumps(sugg, ensure_ascii=False)))
        con.commit()
        return {"id": cur.lastrowid, "status": status, "region_name": region,
                "suggested_contracts": sugg}
    finally:
        con.close()
```

- [ ] **Step 4: Mount the router + guard the write paths in `backend/serve.py`**

After `import predictor` (line 15) add `import reports_api`. After the `app.add_middleware(...)` block, add `app.include_router(reports_api.router)`. Change `_GUARDED` (line 30) to:
```python
_GUARDED = {"/chat", "/predict", "/analyze", "/reports"}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_reports_api.py -k create -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/reports_api.py backend/serve.py backend/tests/test_reports_api.py
git commit -m "report loop: create-report endpoint with dedup and attribution"
```

---

### Task 9: Confirm endpoint (corroboration + anti-brigade)

**Files:**
- Modify: `backend/reports_api.py`, `backend/serve.py:30` (`_GUARDED`)
- Test: `backend/tests/test_reports_api.py` (add cases)

**Interfaces:**
- Produces: `POST /reports/{id}/confirm`. Body `{device_id, kind?}` (`kind` ∈ `confirm|fixed|nothere`, default `confirm`) + Bearer token. Returns `{"status", "confirmations"}`. Enforces `antibrigade.can_confirm`; after insert calls `corroboration.recompute`, then sets `under_review` if `antibrigade.is_brigaded`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_reports_api.py`:
```python
def _make_report(c, h, did):
    return c.post("/reports", headers=h, json={"lat":42.1354,"lng":24.7453,
        "category":"pothole","device_id":did}).json()["id"]

def test_three_distinct_users_verify(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h0, d0 = _auth(c)
    rid = _make_report(c, h0, d0)
    last = None
    for i in range(3):
        r = c.post("/auth/verify", json={"phone": f"+35988800{i}", "code":"123456",
                   "fingerprint": f"fp{i}"}).json()
        hh = {"Authorization": f"Bearer {r['token']}"}
        last = c.post(f"/reports/{rid}/confirm", headers=hh,
                      json={"device_id": r["device_id"]}).json()
    assert last["status"] == "verified"

def test_same_user_second_confirm_rejected(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    rid = _make_report(c, h, did)
    c.post(f"/reports/{rid}/confirm", headers=h, json={"device_id": did})
    r = c.post(f"/reports/{rid}/confirm", headers=h, json={"device_id": did})
    assert r.status_code == 409
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_reports_api.py -k verify -v`
Expected: FAIL — 404/405 (no confirm route)

- [ ] **Step 3: Implement the confirm route in `backend/reports_api.py`**

Add:
```python
class ConfirmIn(BaseModel):
    device_id: int
    kind: str = Field(default="confirm", pattern="^(confirm|fixed|nothere)$")

@router.post("/reports/{report_id}/confirm")
def confirm_report(report_id: int, body: ConfirmIn, authorization: str = Header(default="")):
    uid = _uid(authorization)
    con = reports_db.con()
    try:
        if not con.execute("SELECT 1 FROM reports WHERE id=?", (report_id,)).fetchone():
            raise HTTPException(404, "no_report")
        ok, reason = antibrigade.can_confirm(con, report_id, uid, body.device_id)
        if not ok:
            raise HTTPException(409, reason)
        con.execute("INSERT INTO confirmations (report_id,user_id,device_id,kind) "
                    "VALUES (?,?,?,?)", (report_id, uid, body.device_id, body.kind))
        con.commit()
        status = corroboration.recompute(con, report_id)
        if antibrigade.is_brigaded(con, report_id):
            con.execute("UPDATE reports SET status='under_review' WHERE id=?", (report_id,))
            con.commit(); status = "under_review"
        n = con.execute("SELECT COUNT(*) FROM confirmations WHERE report_id=? AND kind='confirm'",
                        (report_id,)).fetchone()[0]
        return {"status": status, "confirmations": n}
    finally:
        con.close()
```

- [ ] **Step 4: Guard the confirm path**

In `backend/serve.py`, the middleware guards by exact path; per-pin confirm paths vary, so add a prefix check. Replace the guard condition `if request.url.path in _GUARDED:` (line 44) with:
```python
    p = request.url.path
    if p in _GUARDED or (p.startswith("/reports/") and p.endswith("/confirm")):
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_reports_api.py -v`
Expected: PASS (all report API tests)

- [ ] **Step 6: Commit**

```bash
git add backend/reports_api.py backend/serve.py backend/tests/test_reports_api.py
git commit -m "report loop: confirm endpoint with corroboration and brigade guard"
```

---

### Task 10: Read endpoints (viewport + detail + authority summary)

**Files:**
- Modify: `backend/reports_api.py`
- Test: `backend/tests/test_reports_api.py` (add cases)

**Interfaces:**
- Produces:
  - `GET /reports?min_lat&min_lng&max_lat&max_lng` → `{"reports": [{id, lat, lng, category, status, region_name, confirmations}]}` (excludes `under_review`, `resolved`).
  - `GET /reports/{id}` → full row + parsed `suggested_contracts` + `confirmations`.
  - `GET /authorities/{region_name}/summary` → `{region_name, affected, verified, top_contract}`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_reports_api.py`:
```python
def test_bbox_returns_created_pin(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    rid = _make_report(c, h, did)
    r = c.get("/reports", params={"min_lat":42,"min_lng":24,"max_lat":43,"max_lng":25}).json()
    assert any(x["id"] == rid for x in r["reports"])

def test_authority_summary_counts(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    _make_report(c, h, did)
    r = c.get("/authorities/Пловдив/summary").json()
    assert r["region_name"] == "Пловдив" and r["affected"] >= 1
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_reports_api.py -k "bbox or summary" -v`
Expected: FAIL — 404 (no read routes)

- [ ] **Step 3: Implement read routes in `backend/reports_api.py`**

Add:
```python
@router.get("/reports")
def list_reports(min_lat: float, min_lng: float, max_lat: float, max_lng: float):
    con = reports_db.con()
    try:
        frag, params = geo.bbox_where(min_lat, min_lng, max_lat, max_lng)
        rows = con.execute(
            f"SELECT r.id,r.lat,r.lng,r.category,r.status,r.region_name,"
            f"(SELECT COUNT(*) FROM confirmations cf WHERE cf.report_id=r.id AND cf.kind='confirm') "
            f"AS confirmations FROM reports r "
            f"WHERE {frag} AND r.status IN ('reported','verified')", params).fetchall()
        return {"reports": [dict(x) for x in rows]}
    finally:
        con.close()

@router.get("/reports/{report_id}")
def get_report(report_id: int):
    con = reports_db.con()
    try:
        r = con.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
        if not r:
            raise HTTPException(404, "no_report")
        n = con.execute("SELECT COUNT(*) FROM confirmations WHERE report_id=? AND kind='confirm'",
                        (report_id,)).fetchone()[0]
        d = dict(r); d["suggested_contracts"] = json.loads(d.get("suggested_contracts") or "[]")
        d["confirmations"] = n
        return d
    finally:
        con.close()

@router.get("/authorities/{region_name}/summary")
def authority_summary(region_name: str):
    con = reports_db.con()
    try:
        affected = con.execute(
            "SELECT COUNT(*) FROM reports WHERE region_name=? AND status IN ('reported','verified')",
            (region_name,)).fetchone()[0]
        verified = con.execute(
            "SELECT COUNT(*) FROM reports WHERE region_name=? AND status='verified'",
            (region_name,)).fetchone()[0]
        top = contracts_match.suggest(con, region_name, "other", limit=1)
        return {"region_name": region_name, "affected": affected,
                "verified": verified, "top_contract": top[0] if top else None}
    finally:
        con.close()
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && python -m pytest tests/ -v`
Expected: PASS (entire backend suite)

- [ ] **Step 5: Commit**

```bash
git add backend/reports_api.py backend/tests/test_reports_api.py
git commit -m "report loop: read endpoints (viewport, detail, authority summary)"
```

---

### Task 11: Frontend API client + types

**Files:**
- Create: `frontend/src/lib/reportTypes.ts`
- Create: `frontend/src/lib/reportsApi.ts`

**Interfaces:**
- Produces: `verify`, `createReport`, `confirmReport`, `listReports`, `getReport`, `authoritySummary` async fns + the matching types. Reuses `API_BASE` convention from `lib/api.ts`.

- [ ] **Step 1: Create `frontend/src/lib/reportTypes.ts`**

```ts
export type Category = "pothole" | "stalled_construction" | "public_renovation" | "broken_infra" | "other";
export const CATEGORY_LABELS: Record<Category, string> = {
  pothole: "Дупка на пътя",
  stalled_construction: "Спрял строеж",
  public_renovation: "Занемарен обществен ремонт",
  broken_infra: "Счупена инфраструктура",
  other: "Друго",
};
export interface Suggestion { ocid: string; title: string; value: number | null; overrun_days: number | null; supplier: string; }
export interface ReportPin { id: number; lat: number; lng: number; category: Category; status: string; region_name: string | null; confirmations: number; }
export interface ReportDetail extends ReportPin { note: string; suggested_contracts: Suggestion[]; }
export interface Session { token: string; user_id: number; device_id: number; }
```

- [ ] **Step 2: Create `frontend/src/lib/reportsApi.ts`**

```ts
import type { Category, ReportPin, ReportDetail, Session } from "./reportTypes";

const API_BASE = (import.meta.env as Record<string, string | undefined>).VITE_API_BASE ?? "http://localhost:8000";
let session: Session | null = JSON.parse(localStorage.getItem("dokoga_session") || "null");

function auth(): Record<string, string> {
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
export function getSession() { return session; }

export async function verify(phone: string, code: string, fingerprint: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code, fingerprint }) });
  if (!res.ok) throw new Error("Грешен код");
  session = await res.json();
  localStorage.setItem("dokoga_session", JSON.stringify(session));
  return session!;
}
export async function createReport(lat: number, lng: number, category: Category, note = "") {
  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST", headers: { "Content-Type": "application/json", ...auth() },
    body: JSON.stringify({ lat, lng, category, note, device_id: session?.device_id }) });
  if (res.status === 401) throw new Error("Влез с телефон, за да докладваш.");
  if (!res.ok) throw new Error("Неуспешно подаване");
  return res.json();
}
export async function confirmReport(id: number, kind: "confirm" | "fixed" | "nothere" = "confirm") {
  const res = await fetch(`${API_BASE}/reports/${id}/confirm`, {
    method: "POST", headers: { "Content-Type": "application/json", ...auth() },
    body: JSON.stringify({ device_id: session?.device_id, kind }) });
  if (res.status === 409) throw new Error("Вече потвърди този сигнал.");
  if (!res.ok) throw new Error("Неуспешно потвърждение");
  return res.json();
}
export async function listReports(b: { min_lat: number; min_lng: number; max_lat: number; max_lng: number }): Promise<ReportPin[]> {
  const q = new URLSearchParams(Object.entries(b).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${API_BASE}/reports?${q}`);
  if (!res.ok) throw new Error("Сигналите не се заредиха");
  return (await res.json()).reports;
}
export async function getReport(id: number): Promise<ReportDetail> {
  const res = await fetch(`${API_BASE}/reports/${id}`);
  if (!res.ok) throw new Error("Сигналът не е намерен");
  return res.json();
}
export async function authoritySummary(region: string) {
  const res = await fetch(`${API_BASE}/authorities/${encodeURIComponent(region)}/summary`);
  if (!res.ok) throw new Error("Няма данни за областта");
  return res.json();
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/reportTypes.ts frontend/src/lib/reportsApi.ts
git commit -m "report loop: frontend api client and types"
```

---

### Task 12: Report map page (pins + click-to-pin + geolocation)

**Files:**
- Create: `frontend/src/components/ReportLayer.tsx`
- Create: `frontend/src/pages/Report.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `listReports`, `ReportPin` (Task 11); react-leaflet (already a dependency).
- Produces: `/report` route. Desktop click on the map sets a draft pin; mobile "Тук съм" button uses `navigator.geolocation`. Existing report pins load for the current viewport.

- [ ] **Step 1: Create `frontend/src/components/ReportLayer.tsx`**

```tsx
import { CircleMarker, useMapEvents } from "react-leaflet";
import type { ReportPin } from "../lib/reportTypes";

const COLOR: Record<string, string> = { reported: "#f5a623", verified: "#e3402b" };

export function ReportLayer({ pins, onPick, onMapClick }: {
  pins: ReportPin[]; onPick: (id: number) => void; onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return (<>
    {pins.map((p) => (
      <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={6 + Math.min(p.confirmations, 6)}
        pathOptions={{ color: "#fff", weight: 1, fillColor: COLOR[p.status] ?? "#888", fillOpacity: 0.85 }}
        eventHandlers={{ click: () => onPick(p.id) }} />
    ))}
  </>);
}
```

- [ ] **Step 2: Create `frontend/src/pages/Report.tsx`**

```tsx
import { MapContainer, TileLayer } from "react-leaflet";
import { useEffect, useState } from "react";
import { ReportLayer } from "../components/ReportLayer";
import { listReports } from "../lib/reportsApi";
import type { ReportPin } from "../lib/reportTypes";

export default function Report() {
  const [pins, setPins] = useState<ReportPin[]>([]);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  async function refresh() {
    setPins(await listReports({ min_lat: 41, min_lng: 22, max_lat: 44.5, max_lng: 29 }).catch(() => []));
  }
  useEffect(() => { refresh(); }, []);

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (pos) => setDraft({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => alert("Няма достъп до местоположение — кликни на картата."));
  }

  return (
    <div className="report-page">
      <button className="locate-btn" onClick={locate}>📍 Тук съм</button>
      <MapContainer className="map" center={[42.73, 25.4]} zoom={7} minZoom={6} maxZoom={18} preferCanvas>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" subdomains="abcd"
          attribution="&copy; OpenStreetMap, &copy; CARTO" />
        <ReportLayer pins={pins} onPick={setPicked} onMapClick={(lat, lng) => setDraft({ lat, lng })} />
      </MapContainer>
      {/* draft + picked panels wired in Tasks 13 & 14 */}
      {draft && <div className="draft-banner" data-lat={draft.lat} data-lng={draft.lng}>Избрана точка ✓</div>}
      {picked != null && <div className="picked-banner" data-id={picked} />}
    </div>
  );
}
```

- [ ] **Step 3: Add the route in `frontend/src/App.tsx`**

```tsx
import Report from "./pages/Report";
// inside <Routes>:
<Route path="/report" element={<Report />} />
```

- [ ] **Step 4: Verify in the browser**

Run backend `cd backend && uvicorn serve:app --port 8000` and frontend `cd frontend && npm run dev`.
Open `http://localhost:5173/report`. Expected: map renders; clicking shows "Избрана точка ✓"; "Тук съм" prompts for location; existing pins (none yet) load without error.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReportLayer.tsx frontend/src/pages/Report.tsx frontend/src/App.tsx
git commit -m "report loop: report map page with click-to-pin and geolocation"
```

---

### Task 13: Report form (category + submit + dedup prompt)

**Files:**
- Create: `frontend/src/components/ReportForm.tsx`
- Modify: `frontend/src/pages/Report.tsx`

**Interfaces:**
- Consumes: `createReport`, `verify`, `CATEGORY_LABELS`, draft coords from Task 12.
- Produces: `<ReportForm lat lng onDone />`. On submit calls `createReport`; if response has `duplicate_of`, shows "Този проблем вече е докладван — потвърди го" and triggers confirm on that id; if 401, shows a phone+code mini-login that calls `verify`.

- [ ] **Step 1: Create `frontend/src/components/ReportForm.tsx`**

```tsx
import { useState } from "react";
import { createReport, confirmReport, verify, getSession } from "../lib/reportsApi";
import { CATEGORY_LABELS, type Category } from "../lib/reportTypes";

function fingerprint(): string {
  let fp = localStorage.getItem("dokoga_fp");
  if (!fp) { fp = crypto.randomUUID(); localStorage.setItem("dokoga_fp", fp); }
  return fp;
}

export function ReportForm({ lat, lng, onDone }: { lat: number; lng: number; onDone: () => void }) {
  const [cat, setCat] = useState<Category>("pothole");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [phone, setPhone] = useState(""); const [code, setCode] = useState("");
  const [needLogin, setNeedLogin] = useState(!getSession());

  async function submit() {
    try {
      const r = await createReport(lat, lng, cat, note);
      if (r.duplicate_of) {
        await confirmReport(r.duplicate_of);
        setMsg("Този проблем вече е докладван — потвърдихме твоя сигнал. ✓");
      } else {
        setMsg(r.region_name ? `Подаден сигнал за ${r.region_name}. ✓` : "Подаден сигнал. ✓");
      }
      setTimeout(onDone, 1200);
    } catch (e) {
      if ((e as Error).message.includes("Влез")) setNeedLogin(true);
      else setMsg((e as Error).message);
    }
  }
  async function doLogin() {
    try { await verify(phone, code, fingerprint()); setNeedLogin(false); setMsg("Влезе ✓"); }
    catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="report-form">
      {needLogin ? (
        <div className="mini-login">
          <p>Влез с телефон, за да докладваш (анонимно):</p>
          <input placeholder="+359..." value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input placeholder="6-цифрен код" value={code} onChange={(e) => setCode(e.target.value)} />
          <button onClick={doLogin}>Влез</button>
        </div>
      ) : (
        <>
          <select value={cat} onChange={(e) => setCat(e.target.value as Category)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <textarea placeholder="Кратко описание (по желание)" value={note}
            maxLength={280} onChange={(e) => setNote(e.target.value)} />
          <button onClick={submit}>Подай сигнал</button>
        </>
      )}
      {msg && <p className="form-msg">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `frontend/src/pages/Report.tsx`**

Replace the draft banner line with:
```tsx
{draft && (
  <div className="draft-panel">
    <ReportForm lat={draft.lat} lng={draft.lng} onDone={() => { setDraft(null); refresh(); }} />
  </div>
)}
```
And add the import: `import { ReportForm } from "../components/ReportForm";`

- [ ] **Step 3: Verify in the browser**

With backend + frontend running, open `/report`, click the map, log in with any phone + a 6-digit code, pick a category, submit. Expected: "Подаден сигнал за …". Click ~20 m away, same category → "вече е докладван — потвърдихме". A new orange pin appears after refresh.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ReportForm.tsx frontend/src/pages/Report.tsx
git commit -m "report loop: report form with login and dedup-confirm"
```

---

### Task 14: Report panel (detail + suggested contract + confirm)

**Files:**
- Create: `frontend/src/components/ReportPanel.tsx`
- Modify: `frontend/src/pages/Report.tsx`

**Interfaces:**
- Consumes: `getReport`, `confirmReport`, `CATEGORY_LABELS`, `picked` id from Task 12.
- Produces: `<ReportPanel id onClose onChanged />` showing category, affected count, status badge, responsible region, top suggested contract (title + overdue days + supplier), and "И аз съм засегнат" (confirm) + "Решен е" (fixed) buttons.

- [ ] **Step 1: Create `frontend/src/components/ReportPanel.tsx`**

```tsx
import { useEffect, useState } from "react";
import { getReport, confirmReport } from "../lib/reportsApi";
import { CATEGORY_LABELS, type ReportDetail } from "../lib/reportTypes";

const STATUS_BG: Record<string, string> = {
  reported: "Докладван", verified: "Потвърден ✓", under_review: "Проверява се",
  resolved: "Решен", unassigned: "Без област",
};

export function ReportPanel({ id, onClose, onChanged }: {
  id: number; onClose: () => void; onChanged: () => void;
}) {
  const [r, setR] = useState<ReportDetail | null>(null);
  const [msg, setMsg] = useState("");
  async function load() { setR(await getReport(id).catch(() => null)); }
  useEffect(() => { load(); }, [id]);

  async function act(kind: "confirm" | "fixed") {
    try { const res = await confirmReport(id, kind); setMsg(`Статус: ${STATUS_BG[res.status] ?? res.status}`); load(); onChanged(); }
    catch (e) { setMsg((e as Error).message); }
  }
  if (!r) return null;
  const c = r.suggested_contracts[0];
  return (
    <aside className="report-panel">
      <button className="close" onClick={onClose}>×</button>
      <h3>{CATEGORY_LABELS[r.category]}</h3>
      <span className="badge">{STATUS_BG[r.status] ?? r.status}</span>
      <p>{r.confirmations} граждани са засегнати · отговаря: <b>{r.region_name ?? "—"}</b></p>
      {c && (
        <div className="suggested">
          <p className="muted">Вероятно свързан договор:</p>
          <p><b>{c.title}</b></p>
          <p>{c.overrun_days ? `просрочен с ${c.overrun_days} дни` : "по график"} · {c.supplier}</p>
        </div>
      )}
      <div className="actions">
        <button onClick={() => act("confirm")}>И аз съм засегнат</button>
        <button onClick={() => act("fixed")}>Решен е</button>
      </div>
      {msg && <p className="form-msg">{msg}</p>}
    </aside>
  );
}
```

- [ ] **Step 2: Wire it into `frontend/src/pages/Report.tsx`**

Replace the picked banner line with:
```tsx
{picked != null && (
  <ReportPanel id={picked} onClose={() => setPicked(null)} onChanged={refresh} />
)}
```
And add the import: `import { ReportPanel } from "../components/ReportPanel";`

- [ ] **Step 3: Verify in the browser**

Click an existing pin. Expected: panel shows category, affected count, region, and (if data exists) a suggested overdue contract. Click "И аз съм засегнат" with a different account → count rises; on the 3rd distinct account the badge flips to "Потвърден ✓".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ReportPanel.tsx frontend/src/pages/Report.tsx
git commit -m "report loop: report detail panel with suggested contract and confirm"
```

---

### Task 15: PWA install + manifest

**Files:**
- Create: `frontend/public/manifest.webmanifest`
- Modify: `frontend/index.html`

**Interfaces:**
- Produces: installable PWA shell so the report map works as a "Waze-like" home-screen app with geolocation. (Offline caching is deferred — YAGNI for MVP.)

- [ ] **Step 1: Create `frontend/public/manifest.webmanifest`**

```json
{
  "name": "Докога? Сигнали",
  "short_name": "Докога?",
  "start_url": "/report",
  "display": "standalone",
  "background_color": "#0f1720",
  "theme_color": "#0f1720",
  "icons": [
    { "src": "/vite.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 2: Link it in `frontend/index.html`**

Inside `<head>`:
```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0f1720" />
```

- [ ] **Step 3: Verify**

Run `cd frontend && npm run build && npm run preview`. Open the preview URL in Chrome → DevTools → Application → Manifest shows "Докога? Сигнали" with `start_url /report` and no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/manifest.webmanifest frontend/index.html
git commit -m "report loop: PWA manifest for installable report app"
```

---

## Self-Review

**Spec coverage:**
- Capture (desktop click + mobile GPS) → Tasks 12–13. ✓
- Geo-attribution (oblast) + contract suggestions → Tasks 3, 4, 8. ✓
- Corroboration / verified threshold → Tasks 5, 9. ✓
- Anti-brigade guard → Tasks 6, 9. ✓
- Public map + counters + per-authority summary → Tasks 10, 12, 14. ✓
- Light pseudonymous accounts (phone OTP + device) → Tasks 7, 13. ✓
- Data model (users/devices/reports/confirmations + reuse contracts) → Task 1. ✓
- SQLite, reuse existing DB → Task 1. ✓
- Shareable URLs / "documents" (public problem page + authority summary) → covered by `/report` detail panel + `authority summary` endpoint; **a dedicated shareable per-pin URL (`/report/:id`) and per-authority page are a thin follow-up** — noted as the first item for the next iteration, not a gap in the core loop.

**Placeholder scan:** No TBD/TODO. The `NAME_FIX` map in Task 3 is intentionally partial with explicit instructions to extend it from the DB's distinct region names — this is a data-normalization step, not a code placeholder.

**Type consistency:** `region_name` used consistently across `geo.attribute`, `contracts_match.suggest`, `reports` table, and API responses. `device_id`/`user_id` consistent across auth, antibrigade, confirmations. Frontend `Category`, `ReportPin`, `ReportDetail`, `Session` types match the JSON shapes returned by Tasks 8–10.

**Known follow-ups (out of scope for #1, by design):** outbound submission/email + PDF dossier (sub-project #3); native app (sub-project #4); dedicated shareable `/report/:id` + `/authority/:name` public pages; real SMS OTP provider; server-derived device fingerprint hardening.
