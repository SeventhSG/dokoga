import reports_db, reports_api
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _client(tmp_path, monkeypatch):
    monkeypatch.setattr(reports_db, "DB", str(tmp_path / "t.sqlite"))
    c = reports_db.con(); reports_db.init_db(c)
    c.execute("""CREATE TABLE IF NOT EXISTS contracts (ocid TEXT, title TEXT,
        region_name TEXT, sector TEXT, value REAL, expected_days INT,
        overrun_days INT, supplier TEXT)""")
    c.commit(); c.close()
    app = FastAPI(); app.include_router(reports_api.router)
    return TestClient(app)


def _auth(c, email="ivan@gmail.com", name="Ivan"):
    """Verify an email and return an Authorization header (cookie cleared so the
    header is authoritative for multi-user tests)."""
    r = c.post("/auth/request", json={"name": name, "email": email}).json()
    v = c.post("/auth/verify", json={"email": email, "code": r["dev_code"]}).json()
    c.cookies.clear()
    return {"Authorization": f"Bearer {v['token']}"}


def _make_report(c, h):
    return c.post("/reports", headers=h, json={"lat": 42.1354, "lng": 24.7453,
        "category": "pothole"}).json()["id"]


def test_request_bad_domain_400(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    r = c.post("/auth/request", json={"name": "X", "email": "x@mailinator.com"})
    assert r.status_code == 400


def test_create_attributes_and_returns_status(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h = _auth(c)
    r = c.post("/reports", headers=h, json={"lat": 42.1354, "lng": 24.7453,
               "category": "pothole"}).json()
    assert r["status"] == "reported" and r["region_name"] == "Пловдив"


def test_create_requires_auth(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    r = c.post("/reports", json={"lat": 42.1354, "lng": 24.7453, "category": "pothole"})
    assert r.status_code == 401


def test_cookie_auth_works(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    rq = c.post("/auth/request", json={"name": "Ivan", "email": "ivan@gmail.com"}).json()
    c.post("/auth/verify", json={"email": "ivan@gmail.com", "code": rq["dev_code"]})
    # no header — the cookie set by /auth/verify should authenticate
    me = c.get("/auth/me")
    assert me.status_code == 200 and me.json()["name"] == "Ivan"
    r = c.post("/reports", json={"lat": 42.1354, "lng": 24.7453, "category": "pothole"})
    assert r.status_code == 200


def test_create_within_50m_is_duplicate(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h = _auth(c)
    a = c.post("/reports", headers=h, json={"lat": 42.1354, "lng": 24.7453, "category": "pothole"}).json()
    b = c.post("/reports", headers=h, json={"lat": 42.13543, "lng": 24.74533, "category": "pothole"}).json()
    assert b["duplicate_of"] == a["id"]


def test_three_distinct_users_verify(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    rid = _make_report(c, _auth(c, "owner@gmail.com", "Owner"))
    last = None
    for i in range(3):
        h = {**_auth(c, f"user{i}@gmail.com", f"User{i}"), "X-Forwarded-For": f"10.0.0.{i}"}
        last = c.post(f"/reports/{rid}/confirm", headers=h, json={}).json()
    assert last["status"] == "verified"


def test_same_ip_cluster_flags_brigade(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    rid = _make_report(c, _auth(c, "owner@gmail.com", "Owner"))
    last = None
    for i in range(3):  # different accounts, SAME ip -> brigade
        h = {**_auth(c, f"b{i}@gmail.com", f"B{i}"), "X-Forwarded-For": "9.9.9.9"}
        last = c.post(f"/reports/{rid}/confirm", headers=h, json={}).json()
    assert last["status"] == "under_review"


def test_same_user_second_confirm_rejected(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h = _auth(c)
    rid = _make_report(c, h)
    c.post(f"/reports/{rid}/confirm", headers=h, json={})
    r = c.post(f"/reports/{rid}/confirm", headers=h, json={})
    assert r.status_code == 409


def test_bbox_returns_created_pin(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h = _auth(c)
    rid = _make_report(c, h)
    r = c.get("/reports", params={"min_lat": 42, "min_lng": 24, "max_lat": 43, "max_lng": 25}).json()
    assert any(x["id"] == rid for x in r["reports"])


def test_authority_summary_counts(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); _make_report(c, _auth(c))
    r = c.get("/authorities/Пловдив/summary").json()
    assert r["region_name"] == "Пловдив" and r["affected"] >= 1
