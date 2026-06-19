"""Инспектира amendments + класификация (CPV) в OCDS, за да дефинира етикета:
може ли да се извади просрочване в ДНИ и как се филтрират ремонтите.
"""
import io, os, sys, json, time, zipfile, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
UA = {"User-Agent": "Mozilla/5.0"}
U = "082f5f2b-42d1-4ce2-ab94-ddcf214d151e"
TRIGGER = f"https://data.egov.bg/dataset/{U}/resources/download/json"
ZIP = "https://data.egov.bg/dataset/resources/download/zip/{f}/{u}/{d}"
def _get(url, t=180): return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t).read()
meta = json.loads(_get(TRIGGER).decode())
zurl = ZIP.format(f=meta["format"], u=meta["uri"], d=str(meta.get("delete_only_zip", True)).lower())
for _ in range(4):
    data = _get(zurl)
    if data[:2] == b"PK": break
    time.sleep(2)
z = zipfile.ZipFile(io.BytesIO(data))
doc = json.loads(z.read([n for n in z.namelist() if n.endswith(".json")][0]).decode("utf-8","replace"))
rel = doc["releases"]

# 1) release с amendments -> структура
am004 = next((r for r in rel if any(c.get("amendments") for c in (r.get("contracts") or []))), None)
print("=== AMENDMENT пример ===")
if am004:
    for c in am004["contracts"]:
        if c.get("amendments"):
            print("contract.period:", json.dumps(c.get("period"), ensure_ascii=False))
            print("contract.dateSigned:", c.get("dateSigned"))
            print("amendments:", json.dumps(c["amendments"], ensure_ascii=False)[:900])
            break

# 2) класификация / CPV
cls = next((r for r in rel if (r.get("tender") or {}).get("classification")), None)
print("\n=== CPV/classification ===")
if cls:
    t = cls["tender"]
    print("classification:", json.dumps(t.get("classification"), ensure_ascii=False))
    print("items[0].classification:", json.dumps(((t.get("items") or [{}])[0]).get("classification"), ensure_ascii=False))
    print("mainProcurementCategory:", cls.get("tender",{}).get("mainProcurementCategory"))

# 3) разпределение по категория + колко имат period
from collections import Counter
cat = Counter()
nperiod = 0; nstart = 0
for r in rel:
    t = r.get("tender") or {}
    cat[t.get("mainProcurementCategory")] += 1
    for c in (r.get("contracts") or []):
        p = c.get("period") or {}
        if p.get("endDate"): nperiod += 1
        if p.get("startDate") and p.get("endDate"): nstart += 1
print("\nmainProcurementCategory:", dict(cat))
print("contracts с endDate:", nperiod, "| с start+end:", nstart)

# 4) buyer (възложител) за регион
b = next((r for r in rel if r.get("buyer")), None)
print("\nbuyer пример:", json.dumps((b or {}).get("buyer"), ensure_ascii=False)[:300])
parties = (next((r for r in rel if r.get("parties")), {}) or {}).get("parties")
if parties:
    print("party[0] keys:", list(parties[0].keys()))
    print("party[0].address:", json.dumps(parties[0].get("address"), ensure_ascii=False))
