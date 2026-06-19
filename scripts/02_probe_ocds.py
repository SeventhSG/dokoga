"""Сваля един ЦАИС ЕОП OCDS пакет и проверява дали има структуриран срок
(contractPeriod / tenderPeriod / duration) и изменения (amendments).
Това решава дали duration-моделът е възможен изобщо.
"""
import io, os, sys, json, time, zipfile, urllib.request
sys.stdout.reconfigure(encoding="utf-8")

UA = {"User-Agent": "Mozilla/5.0"}
OCDS_UUID = "082f5f2b-42d1-4ce2-ab94-ddcf214d151e"  # период 21-05..03-06-2026
TRIGGER = f"https://data.egov.bg/dataset/{OCDS_UUID}/resources/download/json"
ZIP = "https://data.egov.bg/dataset/resources/download/zip/{f}/{u}/{d}"

def _get(url, t=180):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t).read()

meta = json.loads(_get(TRIGGER).decode("utf-8"))
zurl = ZIP.format(f=meta["format"], u=meta["uri"], d=str(meta.get("delete_only_zip", True)).lower())
data = None
for _ in range(4):
    data = _get(zurl)
    if data[:2] == b"PK":
        break
    time.sleep(2)
print("zip bytes:", len(data))
z = zipfile.ZipFile(io.BytesIO(data))
print("files:", z.namelist())

# зареждаме първия json
name = [n for n in z.namelist() if n.endswith(".json")][0]
doc = json.loads(z.read(name).decode("utf-8", "replace"))

# OCDS: {releases:[{tender, awards, contracts, ...}]} или {records:[...]}
releases = doc.get("releases") or doc.get("records") or (doc if isinstance(doc, list) else [])
print("top keys:", list(doc.keys()) if isinstance(doc, dict) else "list")
print("releases:", len(releases))

def deep_find(obj, keys, path=""):
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}"
            if k in keys:
                hits.append((p, v if not isinstance(v, (dict, list)) else type(v).__name__))
            hits += deep_find(v, keys, p)
    elif isinstance(obj, list) and obj:
        hits += deep_find(obj[0], keys, path + "[0]")
    return hits

WANT = {"startDate", "endDate", "durationInDays", "contractPeriod",
        "tenderPeriod", "amendments", "amendment", "period", "dateSigned"}
sample = releases[0] if releases else {}
print("\n--- срок/период полета в 1 release ---")
for p, v in deep_find(sample, WANT):
    s = str(v)[:60]
    print(f"  {p} = {s}")

# колко release-а имат contractPeriod.endDate
def has_end(r):
    for c in (r.get("contracts") or []):
        if (c.get("period") or {}).get("endDate"):
            return True
    return False
n_end = sum(has_end(r) for r in releases)
n_amend = sum(1 for r in releases if any((c.get("amendments") for c in (r.get("contracts") or []))))
print(f"\nrelease-и с contracts.period.endDate: {n_end}/{len(releases)}")
print(f"release-и с contract amendments: {n_amend}/{len(releases)}")
print("\nпример release (отрязан):")
print(json.dumps(sample, ensure_ascii=False)[:1200])
