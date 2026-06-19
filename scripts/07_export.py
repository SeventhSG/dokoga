"""Експорт за приложението:
  data/app/projects.sqlite  — договори + риск + статистики (за LLM tool функции)
  data/app/projects.geojson — точки за картата (по център на областта + jitter)
"""
import os, sys, json, sqlite3, hashlib
import numpy as np, pandas as pd, lightgbm as lgb
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
PROC = os.path.join(HERE, "..", "data", "processed")
APP = os.path.join(HERE, "..", "data", "app"); os.makedirs(APP, exist_ok=True)

# NUTS3 (28 области) -> (име, lat, lon)
NUTS = {
 "BG311":("Видин",43.99,22.88),"BG312":("Монтана",43.41,23.23),"BG313":("Враца",43.21,23.55),
 "BG314":("Плевен",43.42,24.61),"BG315":("Ловеч",43.13,24.71),"BG321":("Велико Търново",43.08,25.63),
 "BG322":("Габрово",42.87,25.32),"BG323":("Русе",43.85,25.97),"BG324":("Разград",43.53,26.52),
 "BG325":("Силистра",44.12,27.26),"BG331":("Варна",43.20,27.91),"BG332":("Добрич",43.57,27.83),
 "BG333":("Шумен",43.27,26.93),"BG334":("Търговище",43.25,26.57),"BG341":("Бургас",42.50,27.47),
 "BG342":("Сливен",42.68,26.32),"BG343":("Ямбол",42.48,26.50),"BG344":("Стара Загора",42.43,25.64),
 "BG411":("София (столица)",42.70,23.32),"BG412":("София област",42.55,23.50),"BG413":("Благоевград",42.02,23.10),
 "BG414":("Перник",42.60,23.04),"BG415":("Кюстендил",42.28,22.69),"BG421":("Пловдив",42.14,24.75),
 "BG422":("Пазарджик",42.19,24.33),"BG423":("Смолян",41.57,24.71),"BG424":("Хасково",41.93,25.56),
 "BG425":("Кърджали",41.65,25.37),
}

df = pd.read_csv(os.path.join(PROC, "all_contracts.csv"))
df = df[df["value"].notna() & (df["value"] > 0)].copy()
df["log_value"] = np.log1p(df["value"])
df["region"] = df["region"].fillna("NA")
df["category"] = df["category"].fillna("NA")
for c in ["category", "region"]:
    df[c] = df[c].astype("category")
df["n_tenderers"] = pd.to_numeric(df["n_tenderers"], errors="coerce")
FEATS = ["category", "log_value", "region", "start_month", "planned_days", "is_repair", "n_tenderers"]

# риск (рефит върху всички + предсказание за показване)
clf = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=31, subsample=0.8,
                         colsample_bytree=0.8, is_unbalance=True, min_child_samples=20,
                         random_state=42, verbose=-1)
clf.fit(df[FEATS], (df["overrun_days"] > 0).astype(int))
df["risk"] = clf.predict_proba(df[FEATS])[:, 1].round(3)

# очаквани дни = историческа медиана по категория (модел не бие baseline -> честно)
pos = df[df["overrun_days"] > 0]
med_by_cat = pos.groupby("category", observed=True)["overrun_days"].median().to_dict()
overall_med = int(pos["overrun_days"].median())
df["expected_days"] = df["category"].map(lambda c: int(med_by_cat.get(c, overall_med)))

df["region"] = df["region"].astype(str)
df["region_name"] = df["region"].map(lambda r: NUTS.get(r, ("—", None, None))[0])

def coords(ocid, region):
    name, lat, lon = NUTS.get(region, ("—", 42.73, 25.48))  # център на БГ при липса
    h = int(hashlib.md5(str(ocid).encode()).hexdigest(), 16)
    jx = ((h % 1000) / 1000 - 0.5) * 0.25
    jy = (((h // 1000) % 1000) / 1000 - 0.5) * 0.25
    return (lat or 42.73) + jy, (lon or 25.48) + jx

# ---------- SQLite ----------
db = os.path.join(APP, "projects.sqlite")
if os.path.exists(db): os.remove(db)
con = sqlite3.connect(db)
cols = ["ocid","title","category","is_repair","value","region","region_name","locality",
        "buyer","supplier","supplier_eik","planned_days","start_month","overrun_days",
        "risk","expected_days"]
df[cols].to_sql("contracts", con, index=False)

# contractor_stats (за get_contractor_stats)
g = df.groupby(["supplier_eik","supplier"], dropna=True)
cstats = g.agg(n_contracts=("ocid","count"),
               n_overrun=("overrun_days", lambda s:(s>0).sum()),
               avg_overrun_days=("overrun_days", lambda s: round(s[s>0].mean(),0) if (s>0).any() else 0),
               avg_risk=("risk","mean")).reset_index()
cstats["overrun_rate"] = (cstats["n_overrun"]/cstats["n_contracts"]).round(3)
cstats = cstats[cstats["supplier_eik"].notna() & (cstats["n_contracts"]>=1)]
cstats.to_sql("contractor_stats", con, index=False)

# region_stats (за get_region_stats)
rg = df.groupby(["region","region_name"], observed=True)
rstats = rg.agg(n=("ocid","count"),
                n_overrun=("overrun_days", lambda s:(s>0).sum()),
                median_overrun_days=("overrun_days", lambda s:int(s[s>0].median()) if (s>0).any() else 0),
                avg_risk=("risk","mean")).reset_index()
rstats["overrun_rate"] = (rstats["n_overrun"]/rstats["n"]).round(3)
rstats.to_sql("region_stats", con, index=False)
con.execute("CREATE INDEX i_reg ON contracts(region)")
con.execute("CREATE INDEX i_sup ON contracts(supplier_eik)")
con.commit(); con.close()

# ---------- GeoJSON (works + ремонти за картата) ----------
mp = df[(df["category"]=="works") | (df["is_repair"]==1)].copy()
feats = []
for _, r in mp.iterrows():
    lat, lon = coords(r["ocid"], r["region"])
    feats.append({"type":"Feature","geometry":{"type":"Point","coordinates":[round(lon,5),round(lat,5)]},
        "properties":{"ocid":r["ocid"],"title":r["title"],"value":None if pd.isna(r["value"]) else int(r["value"]),
            "region":r["region_name"],"locality":None if pd.isna(r["locality"]) else r["locality"],
            "buyer":None if pd.isna(r["buyer"]) else r["buyer"],"supplier":None if pd.isna(r["supplier"]) else r["supplier"],
            "risk":float(r["risk"]),"expected_days":int(r["expected_days"]),
            "overrun_days":int(r["overrun_days"]),"is_repair":int(r["is_repair"])}})
geo = {"type":"FeatureCollection","features":feats}
json.dump(geo, open(os.path.join(APP,"projects.geojson"),"w",encoding="utf-8"), ensure_ascii=False)

print(f"SQLite -> {db}")
print(f"  contracts={len(df)}  contractor_stats={len(cstats)}  region_stats={len(rstats)}")
print(f"GeoJSON -> projects.geojson  ({len(feats)} точки за картата)")
print(f"очаквани дни (медиана) по категория: {{k: int(v) for k,v in med_by_cat.items()}}".replace("med_by_cat",""))
print("\nТОП 5 области по риск:")
print(rstats.sort_values('avg_risk',ascending=False)[['region_name','n','overrun_rate','avg_risk']].head().to_string(index=False))
