"""Cost-overrun model from the ROP contract + annex CSVs (2024-2025).
Label: did the contract get an amendment that INCREASED its value?
Task is data-supported (annexes carry СТОЙНОСТ преди/след изменението).
Prints join + balance diagnostics, then trains LightGBM with 5-fold CV.
"""
import os, sys, glob, re
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import roc_auc_score, average_precision_score
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(__file__))
from sectors import classify

RAW = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
PROC = os.path.join(os.path.dirname(__file__), "..", "data", "processed")


def load(glob_pat):
    frames = []
    for f in sorted(glob.glob(os.path.join(RAW, glob_pat))):
        frames.append(pd.read_csv(f, sep=None, engine="python", encoding="utf-8-sig", dtype=str))
    return pd.concat(frames, ignore_index=True)


def num(x):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return np.nan
    s = re.sub(r"[^0-9,.\-]", "", str(x))
    if not s:
        return np.nan
    if "," in s and "." in s:           # european "1.234,56"
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:                       # "1234,56"
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return np.nan


con = load("*contracts*.csv")
ann = load("*izmeneniya*.csv") if glob.glob(os.path.join(RAW, "*izmeneniya*.csv")) else load("*annexes*.csv")
print(f"contracts rows: {len(con)} | annex rows: {len(ann)}")

KEY = ["УНП", "ДОГОВОР НОМЕР", "ЕИК на изпълнителя"]
for k in KEY:
    con[k] = con[k].astype(str).str.strip()
    ann[k] = ann[k].astype(str).str.strip()

ann["delta"] = ann["ИЗМЕНЕНИЕ на стойността"].map(num)
ann["before"] = ann["СТОЙНОСТ преди изменението"].map(num)
ann["after"] = ann["СТОЙНОСТ след изменението"].map(num)
ann["delta2"] = ann["after"] - ann["before"]
ann["incr"] = ((ann["delta"].fillna(0) > 0) | (ann["delta2"].fillna(0) > 0)).astype(int)

# per-contract: any value-increasing amendment?
amend = ann.groupby(KEY)["incr"].max().rename("cost_overrun").reset_index()
df = con.merge(amend, on=KEY, how="left")
df["cost_overrun"] = df["cost_overrun"].fillna(0).astype(int)

matched = df["cost_overrun"].sum()
print(f"contracts with a value-increasing amendment: {matched} ({100*matched/len(df):.1f}%)")
print(f"annex rows with positive delta: {int(ann['incr'].sum())}/{len(ann)}")

# ---- features ----
df["value"] = df["СТОЙНОСТ при сключване"].map(num)
df = df[df["value"].notna() & (df["value"] > 0)].copy()
df["log_value"] = np.log1p(df["value"])
df["sector"] = df["ПРЕДМЕТ на договора"].fillna("").map(classify).astype("category")
df["is_repair"] = df["ПРЕДМЕТ на договора"].fillna("").str.contains(
    r"ремонт|рехабилитац|реконструкц|път|улиц|тротоар|настилк|асфалт", case=False, regex=True).astype(int)
df["eu"] = df["EU ФИНАНСИРАНЕ"].fillna("").str.contains("да|yes|true", case=False, regex=True).astype(int)
df["n_tenderers"] = df["БРОЙ ОФЕРТИ"].map(num).fillna(0)
df["obj"] = df["ОБЕКТ"].fillna("NA").astype("category")
df["month"] = pd.to_datetime(df["ДОГОВОР ДАТА"], errors="coerce", dayfirst=True).dt.month.fillna(6).astype(int)

FEATS = ["log_value", "sector", "is_repair", "eu", "n_tenderers", "obj", "month"]
X, y = df[FEATS], df["cost_overrun"]
print(f"\nmodel rows: {len(df)} | positives: {int(y.sum())} ({100*y.mean():.1f}%)")
if y.sum() < 30:
    print("too few positives to model reliably."); sys.exit(0)

clf = lgb.LGBMClassifier(n_estimators=400, learning_rate=0.03, num_leaves=31,
                         subsample=0.8, colsample_bytree=0.8, is_unbalance=True,
                         min_child_samples=20, random_state=42, verbose=-1)
skf = StratifiedKFold(5, shuffle=True, random_state=42)
oof = cross_val_predict(clf, X, y, cv=skf, method="predict_proba")[:, 1]
auc = roc_auc_score(y, oof)
ap = average_precision_score(y, oof)
print(f"\n[COST-OVERRUN model]  ROC-AUC={auc:.3f}  PR-AUC={ap:.3f}  (baseline PR-AUC={y.mean():.3f})")
clf.fit(X, y)
imp = sorted(zip(FEATS, clf.feature_importances_), key=lambda t: -t[1])
print("importance:", ", ".join(f"{f}={v}" for f, v in imp))
