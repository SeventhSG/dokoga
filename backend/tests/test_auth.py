import pytest
import reports_db, auth


def _db(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    c = reports_db.con(); reports_db.init_db(c); return c


def test_request_rejects_disposable_domain(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    with pytest.raises(ValueError) as e:
        auth.request_code(c, "Ivan", "x@mailinator.com")
    assert str(e.value) == "bad_domain"


def test_request_and_verify_creates_user(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    r = auth.request_code(c, "Ivan", "ivan@gmail.com")
    assert r["dev_code"] and len(r["dev_code"]) == 6
    s = auth.verify_code(c, "ivan@gmail.com", r["dev_code"])
    assert s["user_id"] >= 1 and s["name"] == "Ivan"
    assert auth.user_from_token(c, s["token"]) == s["user_id"]


def test_same_email_reuses_user(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    a = auth.verify_code(c, "ivan@gmail.com", auth.request_code(c, "Ivan", "ivan@gmail.com")["dev_code"])
    b = auth.verify_code(c, "ivan@gmail.com", auth.request_code(c, "Ivan", "ivan@gmail.com")["dev_code"])
    assert a["user_id"] == b["user_id"]


def test_wrong_code_rejected(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    r = auth.request_code(c, "Ivan", "ivan@gmail.com")
    wrong = f"{(int(r['dev_code']) + 1) % 1000000:06d}"
    with pytest.raises(ValueError) as e:
        auth.verify_code(c, "ivan@gmail.com", wrong)
    assert str(e.value) == "bad_code"


def test_rate_limit_after_three(tmp_path, monkeypatch):
    c = _db(tmp_path, monkeypatch)
    for _ in range(3):
        auth.request_code(c, "Ivan", "ivan@gmail.com")
    with pytest.raises(ValueError) as e:
        auth.request_code(c, "Ivan", "ivan@gmail.com")
    assert str(e.value) == "rate_limited"
