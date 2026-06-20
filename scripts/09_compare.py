"""Head-to-head: current LightGBM vs CatBoost challenger on the same data and
the same CV folds. Two tasks:
  - RISK (classification): P(overrun_days > 0)  -> ROC-AUC, PR-AUC
  - DAYS (regression on overruns): expected overrun days (log target) -> MAE
Writes data/processed/comparison.json and prints a table.
"""
import os, sys, json
import numpy as np, pandas as pd
import lightgbm as lgb
from catboost import CatBoostClassifier, CatBoostRegressor
from sklearn.model_selection import StratifiedKFold, KFold, cross_val_predict
from sklearn.metrics import roc_auc_score, average_precision_score, mean_absolute_error
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
PROC = os.path.join(HERE, "..", "data", "processed")

df = pd.read_csv(os.path.join(PROC, "all_contracts.csv"))
df = df[df["value"].notna() & (df["value"] > 0)].copy()
df["log_value"] = np.log1p(df["value"])
df["planned_days"] = df["planned_days"].clip(lower=1)
df["value_per_day"] = np.log1p(df["value"] / df["planned_days"])
CATS = ["category", "sector", "region"]
for c in CATS:
    df[c] = df[c].fillna("NA").astype(str)
df["n_tenderers"] = pd.to_numeric(df["n_tenderers"], errors="coerce").fillna(0)
FEATS = ["category", "sector", "log_value", "value_per_day", "region",
         "start_month", "planned_days", "is_repair", "n_tenderers"]
cat_idx = [FEATS.index(c) for c in CATS]

X = df[FEATS].copy()
y_clf = (df["overrun_days"] > 0).astype(int)
pos = df[df["overrun_days"] > 0].copy()
Xp = pos[FEATS].copy()
yp = np.log1p(pos["overrun_days"])

skf = StratifiedKFold(5, shuffle=True, random_state=42)
kf = KFold(5, shuffle=True, random_state=42)


def lgb_cats(frame):
    f = frame.copy()
    for c in CATS:
        f[c] = f[c].astype("category")
    return f


# ---------- RISK ----------
def risk_lgbm():
    m = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=31,
                           subsample=0.8, colsample_bytree=0.8, is_unbalance=True,
                           min_child_samples=20, random_state=42, verbose=-1)
    oof = cross_val_predict(m, lgb_cats(X), y_clf, cv=skf, method="predict_proba")[:, 1]
    return oof


def risk_cat():
    oof = np.zeros(len(X))
    for tr, te in skf.split(X, y_clf):
        m = CatBoostClassifier(iterations=400, learning_rate=0.03, depth=6,
                               loss_function="Logloss", auto_class_weights="Balanced",
                               random_seed=42, verbose=0)
        m.fit(X.iloc[tr], y_clf.iloc[tr], cat_features=cat_idx)
        oof[te] = m.predict_proba(X.iloc[te])[:, 1]
    return oof


# ---------- DAYS ----------
def days_lgbm():
    m = lgb.LGBMRegressor(n_estimators=250, learning_rate=0.03, num_leaves=15,
                          subsample=0.8, colsample_bytree=0.8, min_child_samples=10,
                          random_state=42, verbose=-1)
    return cross_val_predict(m, lgb_cats(Xp), yp, cv=kf)


def days_cat():
    oof = np.zeros(len(Xp))
    yp_arr = yp.to_numpy()
    for tr, te in kf.split(Xp):
        m = CatBoostRegressor(iterations=300, learning_rate=0.03, depth=5,
                              loss_function="MAE", random_seed=42, verbose=0)
        m.fit(Xp.iloc[tr], yp_arr[tr], cat_features=cat_idx)
        oof[te] = m.predict(Xp.iloc[te])
    return oof


def risk_metrics(oof):
    return {"roc_auc": float(roc_auc_score(y_clf, oof)),
            "pr_auc": float(average_precision_score(y_clf, oof))}


def days_metrics(oof):
    return {"mae": float(mean_absolute_error(np.expm1(yp), np.expm1(oof)))}


res = {
    "n": int(len(df)), "n_overrun": int(y_clf.sum()), "base_rate": float(y_clf.mean()),
    "risk": {"lightgbm": risk_metrics(risk_lgbm()), "catboost": risk_metrics(risk_cat())},
    "days": {"lightgbm": days_metrics(days_lgbm()), "catboost": days_metrics(days_cat()),
             "baseline_median": float(mean_absolute_error(
                 np.expm1(yp), np.full(len(yp), np.expm1(yp).median())))},
}
res["risk"]["winner"] = max(("lightgbm", "catboost"), key=lambda k: res["risk"][k]["pr_auc"])
res["days"]["winner"] = min(("lightgbm", "catboost"), key=lambda k: res["days"][k]["mae"])

json.dump(res, open(os.path.join(PROC, "comparison.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

print(f"\nn={res['n']}  overrun={res['n_overrun']} ({100*res['base_rate']:.1f}%)\n")
print("RISK (higher better)        ROC-AUC   PR-AUC")
for k in ("lightgbm", "catboost"):
    r = res["risk"][k]
    print(f"  {k:10}              {r['roc_auc']:.3f}    {r['pr_auc']:.3f}")
print(f"  winner: {res['risk']['winner']}")
print("\nDAYS (lower MAE better)     MAE days")
for k in ("lightgbm", "catboost"):
    print(f"  {k:10}              {res['days'][k]['mae']:.1f}")
print(f"  baseline (median)         {res['days']['baseline_median']:.1f}")
print(f"  winner: {res['days']['winner']}")
print("\n-> data/processed/comparison.json")
