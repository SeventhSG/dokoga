"""Тренира LightGBM върху OCDS договорите.
Модел 1 (класификация): overrun_risk = P(срокът ще се удължи).
Модел 2 (регресия): expected_overrun_days при удължаване.
Стратифицирана 5-fold CV, сравнение с baseline, feature importance.
"""
import os, sys, json
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.model_selection import StratifiedKFold, cross_val_predict, KFold
from sklearn.metrics import roc_auc_score, average_precision_score, mean_absolute_error
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
PROC = os.path.join(HERE, "..", "data", "processed")
MODELS = os.path.join(HERE, "..", "models"); os.makedirs(MODELS, exist_ok=True)

df = pd.read_csv(os.path.join(PROC, "all_contracts.csv"))
df = df[df["value"].notna() & (df["value"] > 0)].copy()
df["log_value"] = np.log1p(df["value"])
df["planned_days"] = df["planned_days"].clip(lower=1)
df["value_per_day"] = np.log1p(df["value"] / df["planned_days"])  # интензитет на разхода
if "sector" not in df.columns:
    df["sector"] = "other"
for c in ["category", "region", "sector"]:
    df[c] = df[c].fillna("NA").astype("category")
df["n_tenderers"] = pd.to_numeric(df["n_tenderers"], errors="coerce")
FEATS = ["category", "sector", "log_value", "value_per_day", "region",
         "start_month", "planned_days", "is_repair", "n_tenderers"]
X = df[FEATS]
y_clf = (df["overrun_days"] > 0).astype(int)

print(f"договори: {len(df)} | с просрочване: {int(y_clf.sum())} ({100*y_clf.mean():.1f}%)")

# ---- Модел 1: риск (класификация) ----
clf = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=31,
                         subsample=0.8, colsample_bytree=0.8, is_unbalance=True,
                         min_child_samples=20, random_state=42, verbose=-1)
skf = StratifiedKFold(5, shuffle=True, random_state=42)
oof = cross_val_predict(clf, X, y_clf, cv=skf, method="predict_proba")[:, 1]
auc = roc_auc_score(y_clf, oof)
ap = average_precision_score(y_clf, oof)
base_ap = y_clf.mean()
print(f"\n[РИСК модел]  ROC-AUC={auc:.3f}  PR-AUC={ap:.3f}  (baseline PR-AUC={base_ap:.3f})")

clf.fit(X, y_clf)
imp = sorted(zip(FEATS, clf.feature_importances_), key=lambda t: -t[1])
print("  важност:", ", ".join(f"{f}={v}" for f, v in imp))
clf.booster_.save_model(os.path.join(MODELS, "risk.txt"))

# ---- Модел 2: очаквани дни просрочване (регресия върху положителните) ----
pos = df[df["overrun_days"] > 0].copy()
Xp, yp = pos[FEATS], np.log1p(pos["overrun_days"])
reg = lgb.LGBMRegressor(n_estimators=250, learning_rate=0.03, num_leaves=15,
                        subsample=0.8, colsample_bytree=0.8, min_child_samples=10,
                        random_state=42, verbose=-1)
kf = KFold(5, shuffle=True, random_state=42)
oof_r = cross_val_predict(reg, Xp, yp, cv=kf)
mae = mean_absolute_error(np.expm1(yp), np.expm1(oof_r))
base_mae = mean_absolute_error(np.expm1(yp), np.full(len(yp), np.expm1(yp).median()))
print(f"\n[ДНИ модел]  MAE={mae:.0f} дни  (baseline=median -> {base_mae:.0f} дни)  n={len(pos)}")
reg.fit(Xp, yp)
reg.booster_.save_model(os.path.join(MODELS, "days.txt"))

# ---- честна разбивка по категория ----
df["risk_oof"] = oof
print("\nсреден риск по категория:")
for cat, g in df.groupby("category", observed=True):
    print(f"  {cat:9} n={len(g):4}  реален overrun={100*(g['overrun_days']>0).mean():4.1f}%  предсказан риск={100*g['risk_oof'].mean():4.1f}%")

metrics = {"n": len(df), "n_overrun": int(y_clf.sum()), "base_rate": float(y_clf.mean()),
           "risk_roc_auc": float(auc), "risk_pr_auc": float(ap), "pr_auc_baseline": float(base_ap),
           "days_mae": float(mae), "days_mae_baseline": float(base_mae), "n_positives": int(len(pos)),
           "features": FEATS, "importance": {f: int(v) for f, v in imp}}
json.dump(metrics, open(os.path.join(PROC, "metrics.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("\nмодели -> models/risk.txt, models/days.txt | метрики -> data/processed/metrics.json")
