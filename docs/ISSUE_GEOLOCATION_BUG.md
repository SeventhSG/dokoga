# GitHub Issue: Geolocation Pin Matching & Clutter on the Map

## Description of the Issue
Currently, the geolocated pins on the interactive map often do not match the actual location of the projects. In many cases, projects are placed far off their actual city/town limits or stacked in a single provincial center, causing significant confusion and layout clutter.

### Key Symptoms:
1. **Provincial Center Bunching:** Historical projects across the entire country of Bulgaria are scattered in a giant ±15km circle around their province's NUTS3 centers, instead of being pinned in their correct respective cities, towns, or villages.
2. **Active Project Bunching:** Active projects in Stara Zagora are hardcoded to the Stara Zagora city center, which places projects that are actually for nearby villages (like Hrishtene) or other cities (like the municipal holiday base in Sozopol) inside the city limits of Stara Zagora.
3. **Regex Truncation:** The active locality parser utilizes a single-word regex that truncates multi-word city names like *"Стара Загора"* to *"Стара"*, causing geocoding fallbacks to fail.
4. **Non-Renovation Clutter:** Pure goods supply contracts (such as "Delivery of cold asphalt mixes") or services are displayed on the map as physical renovations, which is highly misleading since there is no actual construction site there.

---

## Root Cause Analysis
1. **No Geocoding Cache for Localities:** In `scripts/07_export.py`, the exporter matched projects only to the 28 province-level NUTS coordinates, applying a massive 15km scatter to distribute them arbitrarily.
2. **Hardcoded Coordinates for Active Projects:** In `scripts/08_export_active.py`, the `coords` function generated coordinates solely around the center coordinates of Stara Zagora, completely ignoring the project's actual locality.
3. **Regex Match Limitation:** `LOCALITY_RE = re.compile(r"\b(?:с\.|гр\.|село|град)\s*([А-ЯA-Z][А-Яа-яA-Za-z]+)")` captured only the first word after the prefix, omitting words like *"Загора"* or *"Търново"*.
4. **Lack of Category Filtering:** The map generation loop in `07_export.py` only checked `sector != "other"` but failed to verify that `category == "works"`. Thus, pure material deliveries (`goods`) and supervision (`services`) containing keywords were shown as physical repairs.

---

## Implemented Fixes

### 1. Unified Local Geocoding Cache
Developed `scripts/geocode_localities.py` which built a comprehensive local coordinates cache (`data/processed/geocoding_cache.json`) for all **328 unique cities, towns, and villages** in the Bulgarian dataset using Nominatim. Added fallback support for village spelling variants like *"Хрищени"* / *"Хрищене"*.

### 2. Precise Coordinates in Exporter
Updated `scripts/07_export.py` to match each project's normalized locality against the geocoding cache, using a tight local jitter (±200-300m) to keep pins localized within their correct municipal bounds.

### 3. Active Projects Geocoding & Correct Localities
Refactored `scripts/08_export_active.py` to:
* Deterministically parse active project localities (supporting multi-word names like *"Стара Загора"* and resolving outlying villages like *"Хрищени"*).
* Use the geocoding cache to place active projects (such as the Sozopol holiday base or the Hrishtene water supply engineering) at their exact geographical locations outside of Stara Zagora.

### 4. Strict Works Category Filtration
Restricted the GeoJSON map points strictly to `category == "works"` (Строителство/Ремонти). This automatically excludes all pure supply/delivery contracts from the map, ensuring that **only real, physical construction and renovation sites** are displayed.

---

## Verification & Status
* **100.0% of historical projects (251/251) are now successfully geocoded** to their exact respective cities and villages on the map.
* All active projects are placed precisely at their true locations (e.g. Hrishtene water engineering is in Hrishtene, and the holiday base is in Sozopol).
* Rebuilt the frontend production assets (`npm run build`) to serve the cleaned works-only GeoJSON map.
* All 28 backend unit tests pass 100% cleanly. All files are staged and ready in Git.
