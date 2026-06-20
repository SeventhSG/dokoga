import reports_db, auth


def _db(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    c = reports_db.con(); reports_db.init_db(c); return c


def test_verify_creates_user_and_token(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    s = auth.verify_otp(c, "+359888123456", "123456", "fp-abc")
    assert s["user_id"] >= 1 and s["device_id"] >= 1
    assert auth.user_from_token(s["token"]) == s["user_id"]


def test_same_phone_reuses_user(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    a = auth.verify_otp(c, "+359888123456", "111111", "fp-1")
    b = auth.verify_otp(c, "+359888123456", "222222", "fp-2")
    assert a["user_id"] == b["user_id"]
    assert a["device_id"] != b["device_id"]
