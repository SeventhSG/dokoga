"""Deterministic red-flag engine. Pure-ish: reads rows, writes flags(code,severity,evidence).

Every flag stores traceable evidence (values + source ids), never a bare boolean.
Flags are factual observations, not accusations.
"""
import json, datetime, statistics

NOW = datetime.datetime.utcnow().isoformat(timespec="seconds")
# Natural persons only: EGN-hash + foreigner LNCH. UIC-type related parties are excluded —
# live data showed they include banks/НАП (creditors, liens), not owners (false-positive source).
PERSON_TYPES = ("EGN", "LNCH")


def _add(con, ttype, tid, code, severity, evidence):
    con.execute("INSERT INTO flags(target_type,target_id,code,severity,evidence,computed_at) VALUES(?,?,?,?,?,?)",
                (ttype, tid, code, round(float(severity), 3), json.dumps(evidence, ensure_ascii=False), NOW))


def single_bidding(con):
    n = 0
    for r in con.execute("SELECT id,offers_count,cpv,amount_eur FROM contracts WHERE offers_count IS NOT NULL"):
        if r["offers_count"] <= 1:
            _add(con, "contract", r["id"], "single_bidding", 0.9,
                 {"offers_count": r["offers_count"], "cpv": r["cpv"], "amount_eur": r["amount_eur"]}); n += 1
        elif r["offers_count"] == 2:
            _add(con, "contract", r["id"], "low_competition", 0.4,
                 {"offers_count": r["offers_count"], "cpv": r["cpv"]}); n += 1
    return n


def short_tender_window(con, min_days=14):
    n = 0
    q = ("SELECT c.id,t.published_at p,t.deadline_at d FROM contracts c JOIN tenders t ON c.unp=t.unp "
         "WHERE t.published_at IS NOT NULL AND t.deadline_at IS NOT NULL")
    for r in con.execute(q):
        try:
            gap = (datetime.date.fromisoformat(r["d"]) - datetime.date.fromisoformat(r["p"])).days
        except ValueError:
            continue
        if 0 <= gap < min_days:
            _add(con, "contract", r["id"], "short_tender_window", round(1 - gap / min_days, 3),
                 {"published_at": r["p"], "deadline_at": r["d"], "gap_days": gap, "min_days": min_days}); n += 1
    return n


def price_anomaly_cpv(con, min_peers=15, factor=3.0, cpv_prefix=5, est_factor=3.0):
    n = 0
    buckets = {}
    for r in con.execute("SELECT id,cpv,amount_eur,estimated_value FROM contracts "
                         "WHERE amount_eur IS NOT NULL AND amount_eur>0 AND cpv IS NOT NULL"):
        buckets.setdefault(str(r["cpv"])[:cpv_prefix], []).append((r["id"], r["amount_eur"], r["estimated_value"]))
    for cpv, rows in buckets.items():
        if len(rows) < min_peers:
            continue
        vals = sorted(v for _, v, _ in rows)
        med = statistics.median(vals)
        p90 = vals[int(0.9 * (len(vals) - 1))]
        thr = max(factor * med, p90)
        for cid, v, est in rows:
            if v > thr and med > 0:
                # guard against framework/supply false positives: a contract within ~est_factor of its
                # OWN declared budget is large-but-budgeted, not overpriced. Only flag if it also blows
                # past its own estimate (or has none).
                if est and est > 0 and v <= est_factor * est:
                    continue
                _add(con, "contract", cid, "price_anomaly_cpv", min(1.0, (v / med) / 10),
                     {"cpv": cpv, "amount_eur": round(v), "cpv_median_eur": round(med),
                      "ratio_to_median": round(v / med, 1), "peers": len(rows)}); n += 1
    return n


def annex_value_inflation(con, ratio=0.25):
    # per-annex inflation (value_before -> value_after on the SAME modification), max per contract.
    # Avoids the earlier bug of summing every annex under a УНП against one contract's value.
    n = 0
    q = ("SELECT c.id cid, MAX(CASE WHEN a.value_before>0 AND a.value_after IS NOT NULL "
         "THEN (a.value_after-a.value_before)/a.value_before END) infl "
         "FROM annexes a JOIN contracts c ON a.unp=c.unp WHERE a.value_before>0 GROUP BY c.id")
    for r in con.execute(q):
        if r["infl"] is not None and r["infl"] >= ratio:
            _add(con, "contract", r["cid"], "annex_value_inflation", min(1.0, r["infl"]),
                 {"max_annex_inflation": round(r["infl"], 2)}); n += 1
    return n


def buyer_supplier_concentration(con, min_buyer_contracts=5, min_share=0.6):
    n = 0
    tot = {}
    for r in con.execute("SELECT buyer_eik,supplier_eik,amount_eur FROM contracts "
                         "WHERE buyer_eik IS NOT NULL AND supplier_eik IS NOT NULL AND amount_eur>0"):
        b = tot.setdefault(r["buyer_eik"], {"total": 0.0, "n": 0, "by": {}})
        b["total"] += r["amount_eur"]; b["n"] += 1
        s = b["by"].setdefault(r["supplier_eik"], {"sum": 0.0, "n": 0})
        s["sum"] += r["amount_eur"]; s["n"] += 1
    for buyer, b in tot.items():
        if b["n"] < min_buyer_contracts or b["total"] <= 0:
            continue
        for sup, s in b["by"].items():
            share = s["sum"] / b["total"]
            if share >= min_share and s["n"] >= 2:
                _add(con, "entity", sup, "buyer_supplier_concentration", round(share, 3),
                     {"buyer_eik": buyer, "supplier_eik": sup, "share_of_buyer_spend": round(share, 3),
                      "supplier_contracts": s["n"], "buyer_total_contracts": b["n"],
                      "supplier_eur": round(s["sum"]), "buyer_total_eur": round(b["total"])}); n += 1
    return n


def shared_owner_cross_tenders(con):
    """Distinct winning firms that share an owner/manager (stable person hash) — the differentiator."""
    winners = {r["supplier_eik"] for r in con.execute(
        "SELECT DISTINCT supplier_eik FROM contracts WHERE supplier_eik IS NOT NULL")}
    if not winners:
        return 0
    qmarks = ",".join("?" * len(winners))
    person_companies = {}
    rows = con.execute(
        f"SELECT r.person_key,r.eik,p.name,p.indent_type FROM roles r JOIN persons p ON r.person_key=p.person_key "
        f"WHERE r.eik IN ({qmarks}) AND p.indent_type IN ({','.join('?'*len(PERSON_TYPES))})",
        (*winners, *PERSON_TYPES))
    for r in rows:
        d = person_companies.setdefault(r["person_key"], {"name": r["name"], "type": r["indent_type"], "eiks": set()})
        d["eiks"].add(r["eik"])
    n = 0
    for pk, d in person_companies.items():
        if len(d["eiks"]) >= 2:
            ev_companies = []
            for eik in sorted(d["eiks"]):
                cs = [row["id"] for row in con.execute(
                    "SELECT id FROM contracts WHERE supplier_eik=? LIMIT 5", (eik,))]
                org = con.execute("SELECT name FROM organizations WHERE eik=?", (eik,)).fetchone()
                ev_companies.append({"eik": eik, "name": org["name"] if org else None, "sample_contracts": cs})
            _add(con, "entity", "person:" + pk, "shared_owner_cross_tenders", min(1.0, 0.5 + 0.1 * len(d["eiks"])),
                 {"person_hash": pk, "person_name": d["name"], "id_type": d["type"],
                  "winning_companies": ev_companies, "company_count": len(d["eiks"])}); n += 1
    return n


ALL = [single_bidding, short_tender_window, price_anomaly_cpv, annex_value_inflation,
       buyer_supplier_concentration, shared_owner_cross_tenders]


def compute_all(con):
    con.execute("DELETE FROM flags")
    out = {}
    for fn in ALL:
        out[fn.__name__] = fn(con)
    con.commit()
    return out
