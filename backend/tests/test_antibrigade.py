import reports_db, antibrigade


def _seed(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    c = reports_db.con(); reports_db.init_db(c)
    c.execute("INSERT INTO reports (id, lat, lng, category) VALUES (1,42.1,24.7,'pothole')")
    c.commit(); return c


def _add(c, uid, did, ip="1.1.1.1"):
    c.execute("INSERT INTO confirmations (report_id,user_id,device_id,ip_hash) VALUES (1,?,?,?)",
              (uid, did, ip)); c.commit()


def test_same_user_cannot_confirm_twice(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch); _add(c, 5, 5)
    ok, _ = antibrigade.can_confirm(c, 1, 5, 5)
    assert ok is False


def test_different_user_can_confirm(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch); _add(c, 5, 99)
    ok, _ = antibrigade.can_confirm(c, 1, 6, 99)  # different account → allowed
    assert ok is True


def test_single_ip_cluster_flags_brigade(tmp_path, monkeypatch):
    c = _seed(tmp_path, monkeypatch)
    for uid in (1, 2, 3): _add(c, uid, uid, ip="9.9.9.9")
    assert antibrigade.is_brigaded(c, 1) is True
