#!/usr/bin/env python3
"""Добавя АКТИВНИТЕ обществени поръчки на Община Стара Загора (от scrape_eop ->
eop_index.json) към data/app/projects.geojson, БЕЗ да променя историческите
договори. Рискът НЕ е фабрикуван per-item ML скор, а реалната историческа
честота на просрочка за съответния сектор (база от all_contracts.csv).

Идемпотентно: маха предишно добавени активни (is_active==1) и ги пресъздава.
Прави .bak преди запис.
"""
import os, re, csv, sys, json, hashlib, shutil, statistics
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from sectors import classify, SECTORS

PROC = os.path.join(ROOT, "data", "processed", "all_contracts.csv")
GEO = os.path.join(ROOT, "data", "app", "projects.geojson")
PUBLIC = os.path.join(ROOT, "frontend", "public", "projects.geojson")  # това сервира фронтендът
IDX = os.path.join(ROOT, "data", "starazagora", "eop", "eop_index.json")
EUR_BGN = 1.95583
SZ_LAT, SZ_LON = 42.4258, 25.6345          # център на гр. Стара Загора
BUYER_PROFILE = "https://app.eop.bg/buyer/21609"

REPAIR_RE = re.compile(r"ремонт|рехабилитац|реконструкц|възстановяв|поддържан", re.I)
LOCALITY_RE = re.compile(r"\b(?:с\.|гр\.|село|град)\s*([А-ЯA-Z][А-Яа-яA-Za-z]+)")

def base_rates():
    """Историческа честота на просрочка + медиана дни закъснение по сектор."""
    rows = list(csv.DictReader(open(PROC, encoding="utf-8-sig")))
    by = {}
    allov = []
    for r in rows:
        sec = (r.get("sector") or "other").strip()
        try:
            ov = float(r.get("overrun_days") or 0)
        except ValueError:
            ov = 0
        by.setdefault(sec, []).append(ov)
        allov.append(ov)
    def stats(ovs):
        n = len(ovs)
        over = [o for o in ovs if o > 0]
        rate = round(len(over) / n, 3) if n else 0.0
        med = int(statistics.median(over)) if over else 0
        return {"n": n, "overrun_rate": rate, "median_overrun_days": med}
    out = {s: stats(v) for s, v in by.items()}
    out["__all__"] = stats(allov)
    return out

# Load geocoding cache if available
CACHE_FILE = os.path.join(ROOT, "data", "processed", "geocoding_cache.json")
GEO_CACHE = {}
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            GEO_CACHE = json.load(f)
    except Exception:
        pass

def normalize_locality(s):
    if not isinstance(s, str):
        return ""
    s = s.strip()
    s = re.sub(r"^(гр\.\s*|с\.\s*|град\s+|село\s+|община\s+|общ\.\s*)", "", s, flags=re.IGNORECASE)
    return s.strip()

def coords(key, locality=None):
    norm_loc = normalize_locality(locality)
    lat, lon = SZ_LAT, SZ_LON
    if norm_loc and norm_loc in GEO_CACHE:
        lat, lon = GEO_CACHE[norm_loc]

    h = int(hashlib.md5(str(key).encode()).hexdigest(), 16)
    jx = ((h % 1000) / 1000 - 0.5) * 0.008
    jy = (((h // 1000) % 1000) / 1000 - 0.5) * 0.008
    return round(lat + jy, 5), round(lon + jx, 5)

def main():
    rates = base_rates()
    allr = rates["__all__"]
    idx = json.load(open(IDX, encoding="utf-8"))
    geo = json.load(open(GEO, encoding="utf-8"))

    # махни предишно добавени активни (идемпотентност)
    before = len(geo["features"])
    geo["features"] = [f for f in geo["features"]
                       if not f.get("properties", {}).get("is_active")]
    stripped = before - len(geo["features"])

    added = 0
    for p in idx["procedures"]:
        title = p.get("title") or ""
        sec = classify(title)
        sr = rates.get(sec, allr)
        is_repair = 1 if REPAIR_RE.search(title) else 0
        val_eur = p.get("value")
        if "Созопол" in title:
            locality = "гр.Созопол"
        elif "Хрищени" in title or "Хрищене" in title:
            locality = "с. Хрищени"
        else:
            locality = "гр. Стара Загора"
        lat, lon = coords(p.get("regnum") or title, locality)
        docs = [{"filename": d.get("filename"), "url": d.get("url")}
                for d in p.get("documents", []) if d.get("filename")]
        props = {
            "ocid": p.get("regnum"),
            "regnum": p.get("regnum"),
            "title": title,
            "value": int(val_eur) if val_eur else None,
            "value_num": int(val_eur) if val_eur else None,
            "value_currency": p.get("value_currency") or ("EUR" if val_eur else None),
            "region": "Стара Загора",
            "locality": locality,
            "buyer": "ОБЩИНА - СТАРА ЗАГОРА",
            "supplier": None,
            "sector": sec,
            "sector_name": SECTORS.get(sec, SECTORS["other"]),
            "planned_days": 0,
            "risk": sr["overrun_rate"],
            "expected_days": sr["median_overrun_days"],
            "overrun_days": 0,
            "is_repair": is_repair,
            # --- активни-специфични ---
            "is_active": 1,
            "deadline": p.get("deadline"),
            "deadline_raw": p.get("deadline_raw"),
            "procedure": p.get("procedure"),
            "object_type": p.get("object_type"),
            "n_documents": p.get("n_documents", len(docs)),
            "documents": docs,
            "eop_url": BUYER_PROFILE,
            "risk_basis": f"историческа честота на просрочка в сектор „{SECTORS.get(sec, sec)}“ "
                          f"({sr['n']} договора)",
        }
        geo["features"].append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": props,
        })
        added += 1
        print(f"  + {props['ocid']:18} {sec:8} risk={props['risk']:.0%} "
              f"exp={props['expected_days']}d  {props['value_currency']} {props['value']}  {title[:40]}")

    shutil.copyfile(GEO, GEO + ".bak")
    json.dump(geo, open(GEO, "w", encoding="utf-8"), ensure_ascii=False)
    if os.path.isdir(os.path.dirname(PUBLIC)):
        json.dump(geo, open(PUBLIC, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nсвалени стари активни={stripped}  добавени активни={added}  "
          f"общо точки={len(geo['features'])}")
    print(f"backup -> {GEO}.bak")
    print(f"served -> {PUBLIC}")

if __name__ == "__main__":
    main()
