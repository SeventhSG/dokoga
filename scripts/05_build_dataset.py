"""Сваля всички OCDS датасети, сглобява per-договор таблица с етикет
'просрочване в дни' (планиран vs финален срок чрез групиране по ocid).
Кешира сваленото; печата статистики. Изход: data/processed/works.csv
"""
import io, os, sys, re, json, time, zipfile, urllib.request
from datetime import datetime, timezone
from collections import defaultdict
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "data", "raw")
CACHE = os.path.join(RAW, "ocds_json")
PROC = os.path.join(HERE, "..", "data", "processed")
os.makedirs(CACHE, exist_ok=True); os.makedirs(PROC, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}

def _get(url, t=180):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t).read()

def download_json(uuid):
    cache = os.path.join(CACHE, f"{uuid}.json")
    if os.path.exists(cache):
        return json.load(open(cache, encoding="utf-8"))
    meta = json.loads(_get(f"https://data.egov.bg/dataset/{uuid}/resources/download/json").decode())
    zurl = ("https://data.egov.bg/dataset/resources/download/zip/"
            f"{meta['format']}/{meta['uri']}/{str(meta.get('delete_only_zip', True)).lower()}")
    for _ in range(5):
        data = _get(zurl)
        if data[:2] == b"PK":
            break
        time.sleep(2)
    z = zipfile.ZipFile(io.BytesIO(data))
    doc = json.loads(z.read([n for n in z.namelist() if n.endswith(".json")][0]).decode("utf-8","replace"))
    json.dump(doc, open(cache, "w", encoding="utf-8"), ensure_ascii=False)
    return doc

def pdate(s):
    if not s: return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        return None

REPAIR = re.compile(r"ремонт|рехабилитац|реконструкц|път|улиц|тротоар|паркинг|парк|настилк|асфалт|пътна|благоустр", re.I)

# ---- събиране по ocid ----
ds = json.load(open(os.path.join(RAW, "ocds_datasets.json"), encoding="utf-8"))
by_ocid = defaultdict(list)
total_rel = 0
for i, d in enumerate(ds, 1):
    doc = download_json(d["uuid"])
    rel = doc.get("releases", [])
    total_rel += len(rel)
    for r in rel:
        by_ocid[r.get("ocid")].append(r)
    print(f"[{i}/{len(ds)}] {d['from']}..{d['to']}  releases={len(rel)}  ocids={len(by_ocid)}")
print(f"\nОБЩО releases={total_rel}  уникални ocid={len(by_ocid)}")

def party_addr(rels):
    for r in rels:
        for p in (r.get("parties") or []):
            if "buyer" in (p.get("roles") or []):
                a = p.get("address") or {}
                return a.get("region"), a.get("locality"), a.get("streetAddress"), p.get("name")
    return None, None, None, None

def supplier_eik(rels):
    for r in rels:
        for p in (r.get("parties") or []):
            if "supplier" in (p.get("roles") or []):
                return (p.get("identifier") or {}).get("id"), p.get("name")
    return None, None

rows = []
for ocid, rels in by_ocid.items():
    tender = {}
    cat = None; title = ""; ntenders = None; value = None
    starts, planned_ends, all_ends, signs = [], [], [], []
    has_amend = False
    for r in rels:
        t = r.get("tender") or {}
        cat = cat or t.get("mainProcurementCategory")
        title = title or t.get("title") or ""
        if t.get("numberOfTenderers"): ntenders = t["numberOfTenderers"]
        for c in (r.get("contracts") or []):
            p = c.get("period") or {}
            s, e = pdate(p.get("startDate")), pdate(p.get("endDate"))
            if s: starts.append(s)
            if e: all_ends.append(e)
            sd = pdate(c.get("dateSigned"))
            if sd: signs.append(sd)
            v = (c.get("value") or {}).get("amount")
            if v: value = v
            if c.get("amendments"): has_amend = True
        for a in (r.get("awards") or []):
            v = (a.get("value") or {}).get("amount")
            if v and not value: value = v
    if not all_ends:
        continue
    start = min(starts) if starts else (min(signs) if signs else None)
    if not start:
        continue
    planned_end = min(all_ends)      # най-ранно обявен срок = планиран
    final_end = max(all_ends)        # най-късно обявен = реален/удължен
    planned_days = (planned_end - start).days
    overrun_days = (final_end - planned_end).days
    if planned_days <= 0 or planned_days > 2000:
        continue
    region, locality, street, buyer = party_addr(rels)
    sup_eik, sup_name = supplier_eik(rels)
    rows.append({
        "ocid": ocid, "category": cat, "is_repair": int(bool(REPAIR.search(title))),
        "title": title[:120].replace("\n", " "),
        "value": value, "region": region, "locality": locality, "street": street,
        "buyer": buyer, "supplier_eik": sup_eik, "supplier": sup_name,
        "n_tenderers": ntenders, "start_month": start.month,
        "planned_days": planned_days, "overrun_days": max(overrun_days, 0),
        "has_amendment": int(has_amend),
    })

# ---- запис + статистики ----
import csv
works = [r for r in rows if r["category"] == "works"]
cols = list(rows[0].keys())
with open(os.path.join(PROC, "all_contracts.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
with open(os.path.join(PROC, "works.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(works)

def stats(name, R):
    over = [r for r in R if r["overrun_days"] > 0]
    rep = [r for r in R if r["is_repair"]]
    print(f"\n[{name}] договори със срок: {len(R)}")
    print(f"  с просрочване>0: {len(over)} ({100*len(over)//max(len(R),1)}%)")
    print(f"  ремонти (keyword): {len(rep)}")
    if over:
        ods = sorted(r["overrun_days"] for r in over)
        print(f"  просрочване дни: med={ods[len(ods)//2]} max={ods[-1]} avg={sum(ods)//len(ods)}")
    with_reg = sum(1 for r in R if r["region"])
    with_val = sum(1 for r in R if r["value"])
    print(f"  с регион: {with_reg} | със стойност: {with_val}")

stats("ВСИЧКИ", rows)
stats("WORKS (строителство)", works)
print("\nизход -> data/processed/works.csv  &  all_contracts.csv")
