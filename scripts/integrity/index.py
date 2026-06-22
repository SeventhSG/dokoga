"""Contract Integrity Index (S3): combine deterministic flags into a transparent 0..1 score.

Noisy-OR of weighted flag severities: score = 1 - Π(1 - severity_i * weight_i).
Saturates in [0,1], rewards independent corroborating flags, stays fully reproducible.
Weights come from the D3 catalogue (refined here); the index is NOT an ML output.
"""

# Weights recalibrated on real data (S3): single-bidding is 68% of BG contracts, so it is a
# LOW-weight baseline that must be corroborated — not "high" on its own. Network/price/concentration
# signals carry the real weight. High tier therefore requires genuine multi-signal corroboration.
WEIGHTS = {
    "shared_owner_cross_tenders": 1.0,
    "buyer_supplier_concentration": 0.85,
    "annex_value_inflation": 0.85,
    "price_anomaly_cpv": 0.8,
    "short_tender_window": 0.65,
    "single_bidding": 0.5,
    "low_competition": 0.25,
}


def _level(score: float) -> str:
    return "high" if score >= 0.80 else "med" if score >= 0.50 else "low"


def compute_index(con):
    con.execute("DELETE FROM integrity_scores")
    rows = con.execute("SELECT target_type, target_id, code, severity FROM flags").fetchall()
    agg = {}
    for r in rows:
        key = (r["target_type"], r["target_id"])
        d = agg.setdefault(key, {"prod": 1.0, "codes": set()})
        w = WEIGHTS.get(r["code"], 0.5)
        d["prod"] *= (1.0 - max(0.0, min(1.0, r["severity"])) * w)
        d["codes"].add(r["code"])
    out = []
    for (tt, tid), d in agg.items():
        score = round(1.0 - d["prod"], 4)
        out.append((tt, tid, score, _level(score), ",".join(sorted(d["codes"]))))
    con.executemany(
        "INSERT OR REPLACE INTO integrity_scores(target_type,target_id,score,level,flag_codes) VALUES(?,?,?,?,?)", out)
    con.commit()
    levels = {}
    for _, _, _, lvl, _ in out:
        levels[lvl] = levels.get(lvl, 0) + 1
    return {"scored": len(out), "levels": levels}
