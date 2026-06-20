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


def _auth(c, phone="+359888000111", fp="fp1"):
    r = c.post("/auth/verify", json={"phone": phone, "code": "123456",
               "fingerprint": fp}).json()
    return {"Authorization": f"Bearer {r['token']}"}, r["device_id"]


def _make_report(c, h, did):
    return c.post("/reports", headers=h, json={"lat": 42.1354, "lng": 24.7453,
        "category": "pothole", "device_id": did}).json()["id"]


def test_create_attributes_and_returns_status(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    r = c.post("/reports", headers=h, json={"lat": 42.1354, "lng": 24.7453,
               "category": "pothole", "device_id": did}).json()
    assert r["status"] == "reported"
    assert r["region_name"] == "Пловдив"
    assert "suggested_contracts" in r


def test_create_within_50m_is_duplicate(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    base = {"category": "pothole", "device_id": did}
    a = c.post("/reports", headers=h, json={"lat": 42.1354, "lng": 24.7453, **base}).json()
    b = c.post("/reports", headers=h, json={"lat": 42.13543, "lng": 24.74533, **base}).json()
    assert b["duplicate_of"] == a["id"]


def test_create_requires_auth(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    r = c.post("/reports", json={"lat": 42.1354, "lng": 24.7453,
               "category": "pothole", "device_id": 1})
    assert r.status_code == 401


def test_three_distinct_users_verify(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h0, d0 = _auth(c)
    rid = _make_report(c, h0, d0)
    last = None
    for i in range(3):
        r = c.post("/auth/verify", json={"phone": f"+35988800{i}", "code": "123456",
                   "fingerprint": f"fp{i}"}).json()
        hh = {"Authorization": f"Bearer {r['token']}"}
        last = c.post(f"/reports/{rid}/confirm", headers=hh,
                      json={"device_id": r["device_id"]}).json()
    assert last["status"] == "verified"


def test_same_user_second_confirm_rejected(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    rid = _make_report(c, h, did)
    c.post(f"/reports/{rid}/confirm", headers=h, json={"device_id": did})
    r = c.post(f"/reports/{rid}/confirm", headers=h, json={"device_id": did})
    assert r.status_code == 409


def test_bbox_returns_created_pin(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    rid = _make_report(c, h, did)
    r = c.get("/reports", params={"min_lat": 42, "min_lng": 24, "max_lat": 43, "max_lng": 25}).json()
    assert any(x["id"] == rid for x in r["reports"])


def test_authority_summary_counts(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch); h, did = _auth(c)
    _make_report(c, h, did)
    r = c.get("/authorities/Пловдив/summary").json()
    assert r["region_name"] == "Пловдив" and r["affected"] >= 1
