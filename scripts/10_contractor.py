"""Test whether a leak-free contractor-history feature improves the RISK model.
Per-fold smoothed target encoding of supplier_eik -> prior overrun rate, plus
supplier contract count (experience). Compares LightGBM risk AUC with/without.
"""
import os, sys
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, average_precision_score
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
PROC = os.path.join(HERE, "..", "data", "processed")
df = pd.read_csv(os.path.join(PROC, "all_contracts.csv"))
df = df[df["value"].notna() & (df["value"] > 0)].copy().reset_index(drop=True)
df["log_value"] = np.log1p(df["value"])
df["planned_days"] = df["planned_days"].clip(lower=1)
df["value_per_day"] = np.log1p(df["value"] / df["planned_days"])
for c in ["category", "sector", "region"]:
    df[c] = df[c].fillna("NA").astype("category")
df["n_tenderers"] = pd.to_numeric(df["n_tenderers"], errors="coerce").fillna(0)
df["supplier_eik"] = df["supplier_eik"].fillna("NA").astype(str)
y = (df["overrun_days"] > 0).astype(int)

# --- supplier repeat stats ---
vc = df["supplier_eik"].value_counts()
multi = vc[vc > 1]
print(f"suppliers: {df['supplier_eik'].nunique()} | appearing >1x: {len(multi)} "
      f"| contracts covered by repeat suppliers: {int(multi.sum())}/{len(df)} "
      f"({100*multi.sum()/len(df):.0f}%)")
pos = df[y == 1]
print(f"overrun rows whose supplier repeats: "
      f"{int(pos['supplier_eik'].isin(multi.index).sum())}/{len(pos)}")

BASE = ["category", "sector", "log_value", "value_per_day", "region",
        "start_month", "planned_days", "is_repair", "n_tenderers"]


def smooth_enc(tr_df, tr_y, keys, m=10):
    g = pd.DataFrame({"k": tr_df["supplier_eik"].values, "y": tr_y.values})
    stats = g.groupby("k")["y"].agg(["mean", "count"])
    gm = tr_y.mean()
    enc = (stats["mean"] * stats["count"] + gm * m) / (stats["count"] + m)
    cnt = stats["count"]
    return keys.map(enc).fillna(gm).values, keys.map(cnt).fillna(0).values


def run(use_supplier):
    skf = StratifiedKFold(5, shuffle=True, random_state=42)
    oof = np.zeros(len(df))
    for tr, te in skf.split(df, y):
        Xtr, Xte = df.iloc[tr][BASE].copy(), df.iloc[te][BASE].copy()
        if use_supplier:
            enc_tr, cnt_tr = smooth_enc(df.iloc[tr], y.iloc[tr], df.iloc[tr]["supplier_eik"])
            enc_te, cnt_te = smooth_enc(df.iloc[tr], y.iloc[tr], df.iloc[te]["supplier_eik"])
            Xtr["sup_overrun_rate"] = enc_tr; Xtr["sup_count"] = cnt_tr
            Xte["sup_overrun_rate"] = enc_te; Xte["sup_count"] = cnt_te
        m = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=31,
                               subsample=0.8, colsample_bytree=0.8, is_unbalance=True,
                               min_child_samples=20, random_state=42, verbose=-1)
        m.fit(Xtr, y.iloc[tr])
        oof[te] = m.predict_proba(Xte)[:, 1]
    return roc_auc_score(y, oof), average_precision_score(y, oof)


a0, p0 = run(False)
a1, p1 = run(True)
print(f"\nRISK without contractor feat:  ROC-AUC={a0:.3f}  PR-AUC={p0:.3f}")
print(f"RISK with    contractor feat:  ROC-AUC={a1:.3f}  PR-AUC={p1:.3f}")
print(f"delta:                         ROC-AUC={a1-a0:+.3f}  PR-AUC={p1-p0:+.3f}")
