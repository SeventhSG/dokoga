"""Изброява всички OCDS двуседмични датасети на data.egov.bg чрез търсене.
Извлича UUID + период от заглавието; запазва списък за сваляне.
"""
import os, sys, re, json, time, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
UA = {"User-Agent": "Mozilla/5.0"}
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
os.makedirs(OUT, exist_ok=True)

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8","replace")

q = urllib.parse.quote("ЦАИС ЕОП съгласно стандарт OCDS")
LINK = re.compile(r'href="(?:https://data\.egov\.bg)?/data/view/([0-9a-f-]{36})"[^>]*>(.*?)</a>', re.S)
PERIOD = re.compile(r'от\s*(\d{2}-\d{2}-\d{4})\s*до\s*(\d{2}-\d{2}-\d{4})')

found = {}
for page in range(1, 60):
    html = get(f"https://data.egov.bg/data?q={q}&page={page}")
    hits = LINK.findall(html)
    new = 0
    for uuid, title in hits:
        title = re.sub(r"<[^>]+>", "", title).strip()
        if "OCDS" in title and uuid not in found:
            m = PERIOD.search(title)
            found[uuid] = {"uuid": uuid, "title": title[:90],
                           "from": m.group(1) if m else None,
                           "to": m.group(2) if m else None}
            new += 1
    print(f"page {page}: {len(hits)} links, +{new} new OCDS (total {len(found)})")
    if new == 0 and page > 1:
        break
    time.sleep(0.3)

items = [v for v in found.values() if v["from"]]
def key(v):
    d, m, y = v["from"].split("-")
    return (y, m, d)
items.sort(key=key)
print(f"\nОБЩО OCDS датасети с период: {len(items)}")
if items:
    print("най-стар:", items[0]["from"], "| най-нов:", items[-1]["to"])
path = os.path.join(OUT, "ocds_datasets.json")
json.dump(items, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("записан списък ->", path)
