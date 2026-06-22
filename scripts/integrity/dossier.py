"""Entity dossier (S1/S3 output): evidence-linked, factual ledger for a company or person.

Never editorial — every line traces to source rows. Accepts a supplier ЕИК or a 'person:'+hash key.
"""
import json


def company_dossier(con, eik: str) -> dict:
    org = con.execute("SELECT name,legal_form FROM organizations WHERE eik=?", (eik,)).fetchone()
    won = con.execute(
        "SELECT COUNT(*) n, COALESCE(SUM(amount_eur),0) eur, COUNT(DISTINCT buyer_eik) buyers, "
        "SUM(CASE WHEN offers_count<=1 THEN 1 ELSE 0 END) single FROM contracts WHERE supplier_eik=?", (eik,)).fetchone()
    flags = con.execute(
        "SELECT code,COUNT(*) n FROM flags WHERE (target_type='contract' AND target_id IN "
        "(SELECT id FROM contracts WHERE supplier_eik=?)) OR (target_type='entity' AND target_id=?) "
        "GROUP BY code", (eik, eik)).fetchall()
    # owners/managers + co-owned companies via shared person hash
    owners = con.execute(
        "SELECT p.name,p.indent_type,r.role,r.person_key FROM roles r JOIN persons p ON r.person_key=p.person_key "
        "WHERE r.eik=?", (eik,)).fetchall()
    co = con.execute(
        "SELECT DISTINCT o2.eik,o2.name FROM roles r1 JOIN roles r2 ON r1.person_key=r2.person_key AND r1.eik!=r2.eik "
        "JOIN organizations o2 ON r2.eik=o2.eik WHERE r1.eik=? LIMIT 25", (eik,)).fetchall()
    score = con.execute("SELECT score,level,flag_codes FROM integrity_scores WHERE target_type='entity' AND target_id=?", (eik,)).fetchone()
    return {
        "eik": eik, "name": org["name"] if org else None, "legal_form": org["legal_form"] if org else None,
        "contracts_won": won["n"], "won_eur": round(won["eur"]), "distinct_buyers": won["buyers"],
        "single_bid_wins": won["single"],
        "flags": {f["code"]: f["n"] for f in flags},
        "owners_managers": [{"name": o["name"], "id_type": o["indent_type"], "role": o["role"]} for o in owners],
        "co_owned_companies": [{"eik": c["eik"], "name": c["name"]} for c in co],
        "integrity": {"score": score["score"], "level": score["level"], "codes": score["flag_codes"]} if score else None,
    }


def print_dossier(con, eik: str):
    d = company_dossier(con, eik)
    print(f"\n===== DOSSIER · {d['name']} (ЕИК {d['eik']}, {d['legal_form']}) =====")
    print(f"  won {d['contracts_won']} contracts | {d['won_eur']:,} EUR | {d['distinct_buyers']} buyers | {d['single_bid_wins']} single-bid wins")
    if d["flags"]:
        print(f"  flags: {json.dumps(d['flags'], ensure_ascii=False)}")
    if d["owners_managers"]:
        print("  owners/managers: " + "; ".join(f"{o['name']} ({o['role']})" for o in d["owners_managers"][:6]))
    if d["co_owned_companies"]:
        print(f"  co-owned companies ({len(d['co_owned_companies'])}): " + ", ".join(c["name"] or c["eik"] for c in d["co_owned_companies"][:8]))
    if d["integrity"]:
        print(f"  INTEGRITY: {d['integrity']['level'].upper()} ({d['integrity']['score']}) — {d['integrity']['codes']}")
