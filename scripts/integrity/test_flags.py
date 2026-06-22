"""Unit tests: flag logic fires correctly on crafted rows (independent of live data overlap)."""
import json, os, sqlite3, tempfile
import flags as F
from common import db as _db


def mkdb():
    fd, path = tempfile.mkstemp(suffix=".sqlite"); os.close(fd); os.remove(path)
    con = sqlite3.connect(path); con.row_factory = sqlite3.Row
    con.executescript(open(os.path.join(os.path.dirname(__file__), "schema.sql"), encoding="utf-8").read())
    return con


def codes(con, target=None):
    q = "SELECT code FROM flags" + (f" WHERE target_id='{target}'" if target else "")
    return {r["code"] for r in con.execute(q)}


def test_single_bidding():
    con = mkdb()
    con.execute("INSERT INTO contracts(id,offers_count,cpv,amount_eur) VALUES('c1',1,'45000000',1000)")
    con.execute("INSERT INTO contracts(id,offers_count,cpv,amount_eur) VALUES('c2',2,'45000000',1000)")
    con.execute("INSERT INTO contracts(id,offers_count,cpv,amount_eur) VALUES('c3',5,'45000000',1000)")
    F.single_bidding(con)
    assert "single_bidding" in codes(con, "c1")
    assert "low_competition" in codes(con, "c2")
    assert codes(con, "c3") == set()


def test_short_tender_window():
    con = mkdb()
    con.execute("INSERT INTO tenders(unp,published_at,deadline_at) VALUES('u1','2026-06-01','2026-06-05')")
    con.execute("INSERT INTO tenders(unp,published_at,deadline_at) VALUES('u2','2026-06-01','2026-07-15')")
    con.execute("INSERT INTO contracts(id,unp) VALUES('c1','u1')")
    con.execute("INSERT INTO contracts(id,unp) VALUES('c2','u2')")
    F.short_tender_window(con)
    assert "short_tender_window" in codes(con, "c1")  # 4-day gap
    assert codes(con, "c2") == set()                   # 44-day gap


def test_price_anomaly_cpv():
    con = mkdb()
    for i in range(25):
        con.execute("INSERT INTO contracts(id,cpv,amount_eur) VALUES(?,?,?)", (f"n{i}", "45000000", 1000))
    con.execute("INSERT INTO contracts(id,cpv,amount_eur) VALUES('outlier','45000000',50000)")
    F.price_anomaly_cpv(con, min_peers=20, factor=3.0)
    assert "price_anomaly_cpv" in codes(con, "outlier")
    assert codes(con, "n0") == set()


def test_annex_value_inflation():
    con = mkdb()
    con.execute("INSERT INTO contracts(id,unp,amount_eur) VALUES('c1','u1',1000)")
    con.execute("INSERT INTO annexes(id,unp,value_delta) VALUES('a1','u1',400)")
    F.annex_value_inflation(con, ratio=0.25)
    assert "annex_value_inflation" in codes(con, "c1")  # 40% inflation


def test_buyer_supplier_concentration():
    con = mkdb()
    for i in range(4):  # supplier S wins 4 of buyer B's 5 contracts, 80% of spend
        con.execute("INSERT INTO contracts(id,buyer_eik,supplier_eik,amount_eur) VALUES(?,?,?,?)", (f"c{i}", "B", "S", 1000))
    con.execute("INSERT INTO contracts(id,buyer_eik,supplier_eik,amount_eur) VALUES('c9','B','OTHER',1000)")
    F.buyer_supplier_concentration(con, min_buyer_contracts=5, min_share=0.6)
    assert "buyer_supplier_concentration" in codes(con, "S")


def test_shared_owner_cross_tenders():
    con = mkdb()
    # two distinct winning firms share the same owner hash
    con.execute("INSERT INTO contracts(id,supplier_eik) VALUES('c1','EIK_A')")
    con.execute("INSERT INTO contracts(id,supplier_eik) VALUES('c2','EIK_B')")
    con.execute("INSERT INTO organizations(eik,name) VALUES('EIK_A','Alpha OOD')")
    con.execute("INSERT INTO organizations(eik,name) VALUES('EIK_B','Beta OOD')")
    con.execute("INSERT INTO persons(person_key,indent_type,name) VALUES('HASH1','EGN','Ivan Ivanov')")
    con.execute("INSERT INTO roles(eik,person_key,role) VALUES('EIK_A','HASH1','owner')")
    con.execute("INSERT INTO roles(eik,person_key,role) VALUES('EIK_B','HASH1','manager')")
    n = F.shared_owner_cross_tenders(con)
    assert n == 1
    ev = json.loads(con.execute("SELECT evidence FROM flags WHERE code='shared_owner_cross_tenders'").fetchone()["evidence"])
    assert ev["company_count"] == 2 and {c["eik"] for c in ev["winning_companies"]} == {"EIK_A", "EIK_B"}


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    ok = 0
    for t in tests:
        try:
            t(); print(f"PASS {t.__name__}"); ok += 1
        except Exception:
            print(f"FAIL {t.__name__}"); traceback.print_exc()
    print(f"\n{ok}/{len(tests)} passed")
