import reports_db, corroboration


def _seed(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    c = reports_db.con(); reports_db.init_db(c)
    c.execute("INSERT INTO reports (id, lat, lng, category) VALUES (1, 42.1, 24.7, 'pothole')")
    c.commit(); return c


def _confirm(c, uid, kind="confirm"):
    c.execute("INSERT INTO confirmations (report_id, user_id, device_id, kind) VALUES (1,?,?,?)",
              (uid, uid, kind)); c.commit()


def test_three_distinct_confirms_make_verified(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch)
    for uid in (10, 11): _confirm(c, uid)
    assert corroboration.recompute(c, 1) == "reported"
    _confirm(c, 12)
    assert corroboration.recompute(c, 1) == "verified"


def test_three_fixed_votes_resolve(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch)
    for uid in (20, 21, 22): _confirm(c, uid, "fixed")
    assert corroboration.recompute(c, 1) == "resolved"
