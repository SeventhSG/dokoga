"""Тренира LightGBM върху OCDS договорите.
Модел 1 (класификация): overrun_risk = P(срокът ще се удължи).
Модел 2 (регресия): expected_overrun_days при удължаване.

ВАЖНО (анти-leakage): buyer_rate/supplier_rate са target encoding. Те се смятат
- за CV метриките: само от train фолда (честен ROC-AUC),
- за финалния модел: leave-one-out (всеки ред без себе си),
- за inference (rates.json): пълно изгладено средно по изпълнител/възложител.
Така докладваните числа НЕ са завишени от изтичане на таргета.
"""
import os, sys, json
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.metrics import roc_auc_score, average_precision_score, mean_absolute_error
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
PROC = os.path.join(HERE, "..", "data", "processed")
MODELS = os.path.join(HERE, "..", "models"); os.makedirs(MODELS, exist_ok=True)

df = pd.read_csv(os.path.join(PROC, "all_contracts.csv"))
df = df[df["value"].notna() & (df["value"] > 0)].copy().reset_index(drop=True)
df["log_value"] = np.log1p(df["value"])
df["planned_days"] = df["planned_days"].clip(lower=1)
df["value_per_day"] = np.log1p(df["value"] / df["planned_days"])
if "sector" not in df.columns:
    df["sector"] = "other"
for c in ["category", "region", "sector"]:
    df[c] = df[c].fillna("NA").astype("category")
df["n_tenderers"] = pd.to_numeric(df["n_tenderers"], errors="coerce")
df["buyer"] = df["buyer"].fillna("")
df["supplier"] = df["supplier"].fillna("")

y = (df["overrun_days"] > 0).astype(int)
GMEAN = float(y.mean())
SMOOTH = 5

FEATS = ["category", "sector", "log_value", "value_per_day", "region",
         "start_month", "planned_days", "is_repair", "n_tenderers", "buyer_rate", "supplier_rate"]


def encode(train_keys, train_y, apply_keys, gm):
    """Smoothed mean target encoding fit on train, applied to apply_keys."""
    g = train_y.groupby(train_keys)
    enc = (g.sum() + SMOOTH * gm) / (g.count() + SMOOTH)
    return apply_keys.map(enc).fillna(gm).values


def loo(keys, ys, gm):
    """Leave-one-out smoothed encoding (each row excludes its own target)."""
    g = ys.groupby(keys)
    s = g.transform("sum"); c = g.transform("count")
    return ((s - ys) + SMOOTH * gm) / ((c - 1) + SMOOTH)


def full_rates(keys, ys, gm):
    """Full smoothed rate per unique key — for inference on NEW contracts."""
    g = ys.groupby(keys)
    return ((g.sum() + SMOOTH * gm) / (g.count() + SMOOTH)).to_dict()


def new_clf():
    return lgb.LGBMClassifier(n_estimators=400, learning_rate=0.015, num_leaves=15,
                              subsample=0.8, colsample_bytree=0.8, is_unbalance=True,
                              min_child_samples=20, reg_alpha=0.5, reg_lambda=0.5,
                              random_state=42, verbose=-1)


def new_reg():
    return lgb.LGBMRegressor(objective="regression_l1", n_estimators=300, learning_rate=0.01,
                             num_leaves=3, subsample=0.8, colsample_bytree=0.8, min_child_samples=5,
                             reg_alpha=1.0, reg_lambda=1.0, random_state=42, verbose=-1)


print(f"договори: {len(df)} | с просрочване: {int(y.sum())} ({100*y.mean():.1f}%)")

# ---- Модел 1: риск — ЧЕСТЕН CV (rates само от train фолда) ----
skf = StratifiedKFold(5, shuffle=True, random_state=42)
oof = np.zeros(len(df))
for tr, te in skf.split(df, y):
    gm = y.iloc[tr].mean()
    Xtr, Xte = df.iloc[tr][[c for c in FEATS if c not in ("buyer_rate", "supplier_rate")]].copy(), \
               df.iloc[te][[c for c in FEATS if c not in ("buyer_rate", "supplier_rate")]].copy()
    for col, src in (("buyer_rate", "buyer"), ("supplier_rate", "supplier")):
        Xtr[col] = encode(df.iloc[tr][src], y.iloc[tr], df.iloc[tr][src], gm)
        Xte[col] = encode(df.iloc[tr][src], y.iloc[tr], df.iloc[te][src], gm)
    m = new_clf(); m.fit(Xtr[FEATS], y.iloc[tr])
    oof[te] = m.predict_proba(Xte[FEATS])[:, 1]
auc = roc_auc_score(y, oof)
ap = average_precision_score(y, oof)
print(f"\n[РИСК — ЧЕСТЕН CV]  ROC-AUC={auc:.3f}  PR-AUC={ap:.3f}  (baseline PR-AUC={GMEAN:.3f})")

# ---- финален риск модел върху leave-one-out features ----
df["buyer_rate"] = loo(df["buyer"], y, GMEAN)
df["supplier_rate"] = loo(df["supplier"], y, GMEAN)
clf = new_clf(); clf.fit(df[FEATS], y)
imp = sorted(zip(FEATS, clf.feature_importances_), key=lambda t: -t[1])
print("  важност:", ", ".join(f"{f}={v}" for f, v in imp))
clf.booster_.save_model(os.path.join(MODELS, "risk.txt"))

# ---- rates.json за inference (пълни рейтове) ----
json.dump({"global": GMEAN,
           "buyer": full_rates(df["buyer"], y, GMEAN),
           "supplier": full_rates(df["supplier"], y, GMEAN)},
          open(os.path.join(PROC, "rates.json"), "w", encoding="utf-8"), ensure_ascii=False)

# ---- Модел 2: дни (регресия върху положителните, LOO features) ----
pos = df[df["overrun_days"] > 0].copy()
Xp, yp = pos[FEATS], np.log1p(pos["overrun_days"])
kf = KFold(5, shuffle=True, random_state=42)
oof_r = np.zeros(len(pos))
for tr, te in kf.split(Xp):
    m = new_reg(); m.fit(Xp.iloc[tr], yp.iloc[tr]); oof_r[te] = np.expm1(m.predict(Xp.iloc[te]))
mae = mean_absolute_error(pos["overrun_days"], oof_r)
med_ae = float(np.median(abs(pos["overrun_days"].values - oof_r)))
base_mae = mean_absolute_error(pos["overrun_days"], np.full(len(yp), pos["overrun_days"].median()))
print(f"\n[ДНИ модел]  MAE={mae:.0f} дни  MedAE={med_ae:.1f} дни  (baseline MAE={base_mae:.0f} дни)  n={len(pos)}")
reg = new_reg(); reg.fit(Xp, yp)
reg.booster_.save_model(os.path.join(MODELS, "days.txt"))

# ---- честна разбивка по категория ----
df["risk_oof"] = oof
print("\nсреден риск по категория:")
for cat, g in df.groupby("category", observed=True):
    print(f"  {cat:9} n={len(g):4}  реален overrun={100*(g['overrun_days']>0).mean():4.1f}%  предсказан риск={100*g['risk_oof'].mean():4.1f}%")

metrics = {"n": len(df), "n_overrun": int(y.sum()), "base_rate": GMEAN,
           "risk_roc_auc": float(auc), "risk_pr_auc": float(ap), "pr_auc_baseline": GMEAN,
           "days_mae": float(mae), "days_mae_baseline": float(base_mae), "days_med_ae": med_ae,
           "n_positives": int(len(pos)), "leak_free": True,
           "features": FEATS, "importance": {f: int(v) for f, v in imp}}
json.dump(metrics, open(os.path.join(PROC, "metrics.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("\nмодели -> models/risk.txt, models/days.txt | честни метрики -> data/processed/metrics.json")
