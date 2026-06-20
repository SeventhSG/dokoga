"""Discover yearly ROP datasets (contracts + annexes) on data.egov.bg and their
UUIDs, so we can download 2015..2025. Prints what years actually exist.
"""
import os, sys, re, json, time, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
UA = {"User-Agent": "Mozilla/5.0"}
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "rop_datasets.json")

LINK = re.compile(r'href="(?:https://data\.egov\.bg)?/data/view/([0-9a-f-]{36})"[^>]*>(.*?)</a>', re.S)
YEAR = re.compile(r"\b(20\d{2})\b")


def get(url):
    last = None
    for _ in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "replace")
        except Exception as e:
            last = e; time.sleep(2)
    raise last


def discover(query, kind):
    q = urllib.parse.quote(query)
    found = {}
    for page in range(1, 30):
        try:
            html = get(f"https://data.egov.bg/data?q={q}&page={page}")
        except Exception as e:
            print("  page", page, "err", e); break
        hits = LINK.findall(html)
        new = 0
        for uuid, title in hits:
            title = re.sub(r"<[^>]+>", "", title).strip()
            low = title.lower()
            if "договор" not in low and "contract" not in low and "анекс" not in low and "измен" not in low:
                continue
            m = YEAR.search(title)
            yr = m.group(1) if m else None
            key = (yr, kind)
            if yr and key not in found:
                found[key] = {"year": yr, "kind": kind, "uuid": uuid, "title": title[:90]}
                new += 1
        print(f"  [{kind}] page {page}: {len(hits)} links, +{new}")
        if new == 0 and page > 2:
            break
        time.sleep(0.3)
    return found


all_found = {}
print("contracts:")
all_found.update(discover("Договори сключени в резултат на проведени процедури за обществени поръчки", "contracts"))
print("annexes:")
all_found.update(discover("Информация за измененията на договори за обществени поръчки", "annexes"))

items = sorted(all_found.values(), key=lambda d: (d["year"], d["kind"]))
json.dump(items, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
years = sorted({d["year"] for d in items})
print(f"\nfound {len(items)} datasets across years: {years}")
for d in items:
    print(f"  {d['year']} {d['kind']:9} {d['uuid']}  {d['title']}")
print("->", OUT)
