import sqlite3, contracts_match


def _db():
    c = sqlite3.connect(":memory:"); c.row_factory = sqlite3.Row
    c.execute("""CREATE TABLE contracts (ocid TEXT, title TEXT, region_name TEXT,
        sector TEXT, value REAL, expected_days INT, overrun_days INT, supplier TEXT)""")
    c.execute("INSERT INTO contracts VALUES ('oc1','Ремонт на ул. Гладстон','Пловдив','roads',1200000,180,412,'ЕЛПИДА')")
    c.execute("INSERT INTO contracts VALUES ('oc2','Водопровод','Шумен','water',90000,60,0,'АКВА')")
    c.commit(); return c


def test_suggest_filters_by_region_and_category():
    rows = contracts_match.suggest(_db(), "Пловдив", "pothole")
    assert len(rows) == 1 and rows[0]["ocid"] == "oc1"
    assert rows[0]["overrun_days"] == 412


def test_suggest_other_category_no_sector_filter():
    rows = contracts_match.suggest(_db(), "Шумен", "other")
    assert {r["ocid"] for r in rows} == {"oc2"}
