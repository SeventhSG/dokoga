"""S4 — supervised ML on the composite adverse-outcome label, LEAK-FREE.

Label (observable half available now): contract was *materially modified* (has a linked annex).
The other half (КЗК challenged/annulled) is deferred until cpc.bg is ingested — documented.

Anti-leakage (dokoga's hard lesson): buyer/supplier modification-rate target encodings are computed
ONLY from the train fold on each CV iteration. Reported ROC-AUC/PR-AUC therefore reflect unseen
contracts, not memorized targets. Out-of-fold probabilities are the per-contract ML signal; they are
blended at ~30% with the deterministic index — the ML never defines a flag, and never the headline.
"""
import sys, json
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, average_precision_score
from common import db, DB_PATH
import sqlite3

SMOOTH = 5
FEATS = ["log_value", "log_est", "offers_count", "disqualified_count", "cpv2", "buyer_rate", "supplier_rate"]


def load():
    con = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query(
        "SELECT c.id, c.buyer_eik, c.supplier_eik, c.cpv, c.contract_value, c.estimated_value, "
        "c.offers_count, c.disqualified_count, "
        "CASE WHEN EXISTS(SELECT 1 FROM annexes a WHERE a.unp=c.unp) THEN 1 ELSE 0 END AS y "
        "FROM contracts c", con)
    con.close()
    df = df[df["contract_value"].notna() & (df["contract_value"] > 0)].reset_index(drop=True)
    df["log_value"] = np.log1p(df["contract_value"])
    df["log_est"] = np.log1p(df["estimated_value"].fillna(df["contract_value"]))
    df["offers_count"] = pd.to_numeric(df["offers_count"], errors="coerce").fillna(1)
    df["disqualified_count"] = pd.to_numeric(df["disqualified_count"], errors="coerce").fillna(0)
    df["cpv2"] = df["cpv"].astype(str).str[:2].astype("category")
    df["buyer_eik"] = df["buyer_eik"].fillna(""); df["supplier_eik"] = df["supplier_eik"].fillna("")
    return df


def enc(train_keys, train_y, apply_keys, gm):
    g = train_y.groupby(train_keys)
    e = (g.sum() + SMOOTH * gm) / (g.count() + SMOOTH)
    return apply_keys.map(e).fillna(gm).values


def main():
    df = load()
    y = df["y"].astype(int)
    gm = float(y.mean())
    print(f"contracts={len(df)} | modified(label)={int(y.sum())} ({100*gm:.1f}%)")

    skf = StratifiedKFold(5, shuffle=True, random_state=42)
    oof = np.zeros(len(df))
    base_feats = [f for f in FEATS if f not in ("buyer_rate", "supplier_rate")]
    for tr, te in skf.split(df, y):
        g = float(y.iloc[tr].mean())
        Xtr, Xte = df.iloc[tr][base_feats].copy(), df.iloc[te][base_feats].copy()
        for col, src in (("buyer_rate", "buyer_eik"), ("supplier_rate", "supplier_eik")):
            Xtr[col] = enc(df.iloc[tr][src], y.iloc[tr], df.iloc[tr][src], g)
            Xte[col] = enc(df.iloc[tr][src], y.iloc[tr], df.iloc[te][src], g)
        m = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.02, num_leaves=15,
                               subsample=0.8, colsample_bytree=0.8, is_unbalance=True,
                               min_child_samples=30, reg_alpha=0.5, reg_lambda=0.5,
                               random_state=42, verbose=-1)
        m.fit(Xtr[FEATS], y.iloc[tr])
        oof[te] = m.predict_proba(Xte[FEATS])[:, 1]

    auc = roc_auc_score(y, oof)
    ap = average_precision_score(y, oof)
    print(f"\n[LEAK-FREE 5-fold CV]  ROC-AUC={auc:.3f}  PR-AUC={ap:.3f}  (baseline PR-AUC={gm:.3f}, ROC=0.500)")

    # Integrity check (dokoga's 13_benchmark discipline): the LEAKY version encodes rates from the
    # FULL target (incl. test rows) — this is the bug that once inflated dokoga 0.65 -> 0.98. A small
    # leaky-vs-leakfree gap confirms our reported number is honest, not memorized.
    leak = np.zeros(len(df))
    for tr, te in skf.split(df, y):
        Xtr, Xte = df.iloc[tr][base_feats].copy(), df.iloc[te][base_feats].copy()
        for col, src in (("buyer_rate", "buyer_eik"), ("supplier_rate", "supplier_eik")):
            Xtr[col] = enc(df[src], y, df.iloc[tr][src], gm)   # leak: rates from ALL rows
            Xte[col] = enc(df[src], y, df.iloc[te][src], gm)
        m = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.02, num_leaves=15, is_unbalance=True,
                               min_child_samples=30, random_state=42, verbose=-1)
        m.fit(Xtr[FEATS], y.iloc[tr]); leak[te] = m.predict_proba(Xte[FEATS])[:, 1]
    leak_auc = roc_auc_score(y, leak)
    print(f"[LEAKY (for contrast)]  ROC-AUC={leak_auc:.3f}  -> gap={leak_auc-auc:+.3f} (small gap = honest)")

    # store OOF probabilities as the per-contract ML signal (out-of-fold = not leaked)
    con = db(fresh=False)
    con.execute("CREATE TABLE IF NOT EXISTS ml_scores (contract_id TEXT PRIMARY KEY, p_adverse REAL)")
    con.execute("DELETE FROM ml_scores")
    con.executemany("INSERT OR REPLACE INTO ml_scores(contract_id,p_adverse) VALUES(?,?)",
                    list(zip(df["id"], [round(float(p), 4) for p in oof])))
    con.commit(); con.close()

    metrics = {"n": len(df), "label": "materially_modified(has_annex)", "base_rate": gm,
               "roc_auc": float(auc), "pr_auc": float(ap), "leak_free": True,
               "note": "КЗК annulment half deferred; blended at 30% with deterministic index, LLM-explains-only"}
    json.dump(metrics, open("data/ml_metrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("metrics -> data/ml_metrics.json ; OOF probs -> ml_scores")


if __name__ == "__main__":
    main()
