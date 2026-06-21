"""Honest benchmark of the risk classifier. Compares the team's encoding
(buyer/supplier rates computed on the FULL target, then CV = leakage) against a
LEAK-FREE version (rates computed per-fold on train only). Reports ROC-AUC,
PR-AUC, and threshold accuracy/precision/recall/F1 + confusion matrix.
Read-only: does NOT overwrite models or metrics.
"""
import os, sys
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (roc_auc_score, average_precision_score, accuracy_score,
                             precision_score, recall_score, f1_score, confusion_matrix)
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
PROC = os.path.join(HERE, "..", "data", "processed")
df = pd.read_csv(os.path.join(PROC, "all_contracts.csv"))
df = df[df["value"].notna() & (df["value"] > 0)].copy().reset_index(drop=True)
df["log_value"] = np.log1p(df["value"])
df["planned_days"] = df["planned_days"].clip(lower=1)
df["value_per_day"] = np.log1p(df["value"] / df["planned_days"])
for c in ["category", "region", "sector"]:
    df[c] = df[c].fillna("NA").astype("category")
df["n_tenderers"] = pd.to_numeric(df["n_tenderers"], errors="coerce")
df["buyer"] = df["buyer"].fillna("")
df["supplier"] = df["supplier"].fillna("")
y = (df["overrun_days"] > 0).astype(int)
BASE = ["category", "sector", "log_value", "value_per_day", "region",
        "start_month", "planned_days", "is_repair", "n_tenderers"]
SMOOTH = 5


def smooth_rate(keys_train, y_train, keys_apply, gmean):
    means = y_train.groupby(keys_train).mean()
    counts = keys_train.value_counts()
    enc = (counts * means + SMOOTH * gmean) / (counts + SMOOTH)
    return keys_apply.map(enc).fillna(gmean).values


def model():
    return lgb.LGBMClassifier(n_estimators=400, learning_rate=0.015, num_leaves=15,
                              subsample=0.8, colsample_bytree=0.8, is_unbalance=True,
                              min_child_samples=20, reg_alpha=0.5, reg_lambda=0.5,
                              random_state=42, verbose=-1)


skf = StratifiedKFold(5, shuffle=True, random_state=42)


def run(leak_free: bool):
    oof = np.zeros(len(df))
    if not leak_free:
        # team's way: rates from the FULL target, then split
        gmean = y.mean()
        df["buyer_rate"] = smooth_rate(df["buyer"], y, df["buyer"], gmean)
        df["supplier_rate"] = smooth_rate(df["supplier"], y, df["supplier"], gmean)
    for tr, te in skf.split(df, y):
        Xtr, Xte = df.iloc[tr][BASE].copy(), df.iloc[te][BASE].copy()
        if leak_free:
            gmean = y.iloc[tr].mean()
            Xtr["buyer_rate"] = smooth_rate(df.iloc[tr]["buyer"], y.iloc[tr], df.iloc[tr]["buyer"], gmean)
            Xtr["supplier_rate"] = smooth_rate(df.iloc[tr]["supplier"], y.iloc[tr], df.iloc[tr]["supplier"], gmean)
            Xte["buyer_rate"] = smooth_rate(df.iloc[tr]["buyer"], y.iloc[tr], df.iloc[te]["buyer"], gmean)
            Xte["supplier_rate"] = smooth_rate(df.iloc[tr]["supplier"], y.iloc[tr], df.iloc[te]["supplier"], gmean)
        else:
            Xtr["buyer_rate"] = df.iloc[tr]["buyer_rate"]; Xtr["supplier_rate"] = df.iloc[tr]["supplier_rate"]
            Xte["buyer_rate"] = df.iloc[te]["buyer_rate"]; Xte["supplier_rate"] = df.iloc[te]["supplier_rate"]
        m = model(); m.fit(Xtr, y.iloc[tr])
        oof[te] = m.predict_proba(Xte)[:, 1]
    return oof


def report(name, oof):
    auc = roc_auc_score(y, oof); ap = average_precision_score(y, oof)
    pred = (oof >= 0.5).astype(int)
    acc = accuracy_score(y, pred)
    prec = precision_score(y, pred, zero_division=0)
    rec = recall_score(y, pred, zero_division=0)
    f1 = f1_score(y, pred, zero_division=0)
    tn, fp, fn, tp = confusion_matrix(y, pred).ravel()
    print(f"\n=== {name} ===")
    print(f"  ROC-AUC = {auc:.3f}   PR-AUC = {ap:.3f}   (baseline PR-AUC = {y.mean():.3f})")
    print(f"  @0.5: accuracy = {100*acc:.1f}%  precision = {100*prec:.1f}%  recall = {100*rec:.1f}%  F1 = {f1:.3f}")
    print(f"  confusion: TP={tp} FP={fp} FN={fn} TN={tn}")


print(f"n={len(df)}  overruns={int(y.sum())} ({100*y.mean():.1f}%)")
print(f"baseline accuracy (always 'no overrun') = {100*(1-y.mean()):.1f}%")
report("LEAKY (their training: rates from full target then CV)", run(False))
report("LEAK-FREE (rates per-fold, train only) = HONEST", run(True))
