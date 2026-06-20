import reports_db


def test_init_creates_tables(tmp_path, monkeypatch):
    db = tmp_path / "t.sqlite"
    monkeypatch.setattr(reports_db, "DB", str(db))
    con = reports_db.con()
    reports_db.init_db(con)
    names = {r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"users", "devices", "reports", "confirmations"} <= names
    con.close()
