# dokoga — Citizen Report Loop (Sub-project #1)

**Date:** 2026-06-20
**Status:** Approved design — ready for implementation planning
**Scope:** The core report → corroborate → attribute → public-map loop. No outbound filing.

---

## 1. Purpose

dokoga already holds Bulgarian public-procurement (OCDS) contract data: who was paid,
for what, and by when. This sub-project adds the missing half — a citizen-reporting
layer that ties a real-world problem (pothole, stalled construction, half-finished
public renovation, broken infrastructure) back to the **authority responsible** and,
where possible, the **specific overdue contract** — then turns crowd reports into
public pressure.

**Goal model:** public pressure / petition. Volume + credibility are the weapon.
A verified problem appears on a public map as
*"N citizens affected · responsible: Plovdiv Municipality · likely contract #BG-2024-1234 is 412 days overdue."*

**Out of scope for #1:** outbound submission to authorities, formal PDF dossiers,
native mobile app, legal-grade identity. These are later sub-projects.

### Decomposition (full product, for context)
| # | Sub-project | Notes |
|---|---|---|
| **1** | **Core loop** (this spec) | capture → corroborate → attribute → public map + counters |
| 2 | Contract-matching engine | ingest OCDS → geo/category/keyword index → suggest API (starts as stub here) |
| 3 | Pressure output | shareable PDF dossier + email/submission to authority on threshold |
| 4 | Native mobile app | Waze-like live alerts, background GPS, push |

---

## 2. Key decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Report's purpose | Public pressure / petition | Viral reach; legal identity not required |
| Identity strictness | Light: phone OTP + device fingerprint, pseudonymous | Anti-bot + one-person-one-confirm, not legal standing |
| Sign verification | **Crowd corroboration**, no photo | Frictionless, viral; brigade risk accepted, mitigated cheaply |
| Verified threshold | ≥3 confirmations from distinct accounts **and** devices within 30 days | Raises cost of faking without adding honest-user friction |
| Responsibility link | **Authority-first** (admin boundary, always) + contract suggestion (bonus) | OCDS often lacks worksite GPS; authority is always knowable |
| First client | One responsive web app / PWA (desktop click-to-pin + mobile GPS) | Fastest path to a live, shareable map |
| Database | **SQLite** (geohash + bbox queries; PostGIS later) | Time constraint; backend has no DB yet |
| "Documents" for #1 | Public per-problem page + per-authority summary page | Formal dossier/email is sub-project #3 |

---

## 3. Components (each isolated and independently testable)

### 3.1 Capture (client)
- **Desktop:** click map → place pin. **Mobile:** "Report here" → Geolocation API fix.
- Category picker: pothole, stalled construction, public renovation, broken infrastructure
  (lighting/sidewalk), other. (Bulgarian labels in UI.)
- Optional short note/title.
- Requires a logged-in, phone-verified account.
- **No GPS fix on mobile** → fall back to manual map pin, flagged lower-trust.

### 3.2 Geo-attribution (backend)
- Input `lat,lng` → **responsible authority** via point-in-polygon against Bulgarian
  municipality boundary polygons (shapely). Always resolves inside BG.
- Then query `contracts` by `authority + category + location_name keyword` →
  **suggested contracts** with overdue days. Empty result is acceptable.
- Outside BG / no polygon → `authority_id = null`, status `unassigned`, manual queue.

### 3.3 Corroboration engine (backend)
- **Dedup on create:** if a same-category pin exists within ~50 m, return it and prompt
  "confirm this one" instead of creating a duplicate.
- **Verified status:** ≥3 `confirm` votes from **distinct accounts + distinct devices**
  within a 30-day window.
- **Resolution/decay:** `fixed` / `not-here` votes from ≥3 distinct accounts → status
  `resolved`, removed from active counters. Stale unconfirmed pins decay in ranking.

### 3.4 Anti-brigade guard (backend)
- One `confirm` per account per pin; distinct device required.
- Server-side flags: same IP/device/ASN cluster, impossible geo-velocity, burst timing.
- Flagged pin → status `under_review`, **excluded from public counters** until cleared.
- No extra taps for honest users.

### 3.5 Public map + counters (client + read API)
- Pins colored by status (reported / verified / under_review / resolved); clustered at
  low zoom.
- Per-pin panel: category, affected count (confirmations), age, responsible authority,
  suggested contract (value + overdue days), "I'm affected too / confirm" button.
- Per-authority summary: aggregate "N citizens affected · contract X is Y days overdue."
- **Shareable URLs** per pin and per authority for virality.

### 3.6 Accounts (backend)
- Phone OTP (primary) or email; device fingerprint stored.
- Pseudonymous public display (no real name shown).
- Purpose: anti-bot + one-person-one-confirm. Not legal identity.

---

## 4. Data model (SQLite)

```
users          (id, phone_hash, email_hash, trust_score, banned, created_at)
devices        (id, user_id, fingerprint, first_seen)
reports        (id, lat, lng, geohash, category, note, created_by,
                status, authority_id, suggested_contract_ids_json, created_at)
confirmations  (id, report_id, user_id, device_id, ip_hash,
                kind[confirm|fixed|nothere], created_at)
authorities    (id, name, type[municipality|oblast|private_owner], boundary_ref)
contracts      (id, authority, title, category, value, deadline,
                overdue_days, location_name)        -- loaded from existing OCDS JSON
```

- Spatial queries: store `geohash`; query a viewport by bounding box + geohash prefix.
- `status` ∈ {reported, verified, under_review, resolved, unassigned}.

---

## 5. Stack & new dependencies

- **Frontend:** existing React/Vite/TS + **MapLibre GL** (or Leaflet) + OSM/MapTiler
  free tiles; PWA manifest + service worker (installable, geolocation).
- **Backend:** existing FastAPI. **SQLite** + **shapely** (point-in-polygon).
- **Two data assets to source:**
  1. Bulgarian **municipality boundary GeoJSON** (OSM / NSI) — for attribution.
  2. **Map tiles** (OSM raster or MapTiler free tier).
- Contract data already present (`data/raw/ocds_json/*`); load into `contracts` table.

---

## 6. API surface (initial)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/otp/request` | send phone OTP |
| POST | `/auth/otp/verify` | verify OTP → session |
| POST | `/reports` | create pin (dedup + geo-attribute) |
| GET  | `/reports?bbox=` | pins in viewport |
| GET  | `/reports/{id}` | pin detail + suggested contracts |
| POST | `/reports/{id}/confirm` | confirm / fixed / nothere (anti-brigade) |
| GET  | `/authorities/{id}/summary` | aggregate counters |

---

## 7. Flows & error handling

**Create:** GPS/click → `POST /reports` → dedup check (nearby same-category) →
if duplicate, return existing + prompt confirm; else geo-attribute (authority +
suggested contracts) → store → return.
- No GPS fix → manual pin, lower-trust flag.
- Outside BG / no polygon → `unassigned`, manual queue.
- No contract match → authority only.

**Confirm:** `POST /reports/{id}/confirm` → anti-brigade checks → insert confirmation →
recompute status (≥3 distinct → `verified`) → return.
- Brigade cluster detected → `under_review`, excluded from counters.

**Read:** `GET /reports?bbox=` (viewport) · `GET /reports/{id}` (detail) ·
`GET /authorities/{id}/summary` (counters).

---

## 8. Testing

- **Unit:** point-in-polygon attribution (known coords → known municipality);
  dedup radius logic; verified-threshold logic; anti-brigade rules
  (distinct device/account, cluster detection).
- **Integration (FastAPI TestClient, matching `backend/test_endpoint.py`):**
  create → confirm×3 → `verified`; brigade case stays unverified;
  read endpoints return expected shapes.
- **Frontend:** map renders pins; create flow places pin + shows suggested contract;
  confirm flow increments count and flips to Verified at threshold.

---

## 9. Open items for the plan

- Source & licence-check the municipality boundary GeoJSON.
- Choose OTP provider (or stub OTP in dev).
- Device fingerprint method (client lib vs server-derived).
- Confirm `contracts` schema mapping from the raw OCDS JSON.
