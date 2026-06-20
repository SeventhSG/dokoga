"""Recover start_year / end_year per ocid from the cached OCDS releases and
merge them into all_contracts.csv -> all_contracts_dated.csv. Offline (cache
only); ocids without cached data get null years and are skipped by the backtest.
"""
import os, sys, json
from datetime import datetime, timezone
from collections import defaultdict
import pandas as pd
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "data", "raw")
CACHE = os.path.join(RAW, "ocds_json")
PROC = os.path.join(HERE, "..", "data", "processed")


def pdate(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        return None


ds = json.load(open(os.path.join(RAW, "ocds_datasets.json"), encoding="utf-8"))
by_ocid = defaultdict(list)
loaded = 0
for d in ds:
    cf = os.path.join(CACHE, f"{d['uuid']}.json")
    if not os.path.exists(cf):
        continue
    loaded += 1
    doc = json.load(open(cf, encoding="utf-8"))
    for r in doc.get("releases", []):
        by_ocid[r.get("ocid")].append(r)

years = {}
for ocid, rels in by_ocid.items():
    starts, all_ends, signs = [], [], []
    for r in rels:
        for c in (r.get("contracts") or []):
            p = c.get("period") or {}
            s, e = pdate(p.get("startDate")), pdate(p.get("endDate"))
            if s:
                starts.append(s)
            if e:
                all_ends.append(e)
            sd = pdate(c.get("dateSigned"))
            if sd:
                signs.append(sd)
    if not all_ends:
        continue
    start = min(starts) if starts else (min(signs) if signs else None)
    if not start:
        continue
    years[ocid] = {"start_year": start.year, "end_year": max(all_ends).year}

df = pd.read_csv(os.path.join(PROC, "all_contracts.csv"))
df["start_year"] = df["ocid"].map(lambda o: years.get(o, {}).get("start_year"))
df["end_year"] = df["ocid"].map(lambda o: years.get(o, {}).get("end_year"))
out = os.path.join(PROC, "all_contracts_dated.csv")
df.to_csv(out, index=False, encoding="utf-8-sig")

has = df["end_year"].notna()
print(f"cached datasets: {loaded}/{len(ds)} | ocids with years: {len(years)}")
print(f"rows: {len(df)} | with end_year: {int(has.sum())}")
print("end_year distribution:")
print(df.loc[has, "end_year"].astype(int).value_counts().sort_index().to_string())
fin2025 = df[(df["end_year"] == 2025)]
print(f"finished-2025 rows: {len(fin2025)} | of which overran (>0 days): {int((fin2025['overrun_days']>0).sum())}")
print("wrote", out)
