"""FastAPI router for the citizen report loop."""
import json, math
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

import reports_db, geo, contracts_match, corroboration, antibrigade, auth

router = APIRouter()
DUP_RADIUS_M = 50


def _uid(authorization):
    uid = auth.user_from_token((authorization or "").removeprefix("Bearer ").strip())
    if not uid:
        raise HTTPException(401, "unauthorized")
    return uid


def _meters(a_lat, a_lng, b_lat, b_lng):
    R = 6371000
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat); dl = math.radians(b_lng - a_lng)
    x = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


class VerifyIn(BaseModel):
    phone: str = Field(min_length=5, max_length=20)
    code: str = Field(min_length=6, max_length=6)
    fingerprint: str = Field(min_length=1, max_length=120)


class ReportIn(BaseModel):
    lat: float = Field(ge=41.0, le=44.5)
    lng: float = Field(ge=22.0, le=29.0)
    category: str = Field(max_length=30)
    note: str = Field(default="", max_length=280)
    device_id: int


class ConfirmIn(BaseModel):
    device_id: int
    kind: str = Field(default="confirm", pattern="^(confirm|fixed|nothere)$")


@router.post("/auth/request")
def auth_request(body: dict):
    auth.request_otp(body.get("phone", "")); return {"sent": True}


@router.post("/auth/verify")
def auth_verify(body: VerifyIn):
    con = reports_db.con()
    try:
        return auth.verify_otp(con, body.phone, body.code, body.fingerprint)
    except ValueError:
        raise HTTPException(400, "bad_code")
    finally:
        con.close()


@router.post("/reports")
def create_report(body: ReportIn, authorization: str = Header(default="")):
    uid = _uid(authorization)
    con = reports_db.con()
    try:
        gh = geo.encode(body.lat, body.lng)
        for row in con.execute(
            "SELECT id, lat, lng FROM reports WHERE category=? AND status IN "
            "('reported','verified','under_review') AND geohash LIKE ?",
            (body.category, gh[:6] + "%")):
            if _meters(body.lat, body.lng, row["lat"], row["lng"]) <= DUP_RADIUS_M:
                return {"duplicate_of": row["id"], "id": row["id"], "status": "duplicate"}
        region = geo.attribute(body.lat, body.lng)
        status = "reported" if region else "unassigned"
        sugg = contracts_match.suggest(con, region, body.category) if region else []
        cur = con.execute(
            "INSERT INTO reports (lat,lng,geohash,category,note,created_by,status,"
            "region_name,suggested_contracts) VALUES (?,?,?,?,?,?,?,?,?)",
            (body.lat, body.lng, gh, body.category, body.note, uid, status,
             region, json.dumps(sugg, ensure_ascii=False)))
        con.commit()
        return {"id": cur.lastrowid, "status": status, "region_name": region,
                "suggested_contracts": sugg}
    finally:
        con.close()


@router.post("/reports/{report_id}/confirm")
def confirm_report(report_id: int, body: ConfirmIn, authorization: str = Header(default="")):
    uid = _uid(authorization)
    con = reports_db.con()
    try:
        if not con.execute("SELECT 1 FROM reports WHERE id=?", (report_id,)).fetchone():
            raise HTTPException(404, "no_report")
        ok, reason = antibrigade.can_confirm(con, report_id, uid, body.device_id)
        if not ok:
            raise HTTPException(409, reason)
        con.execute("INSERT INTO confirmations (report_id,user_id,device_id,kind) "
                    "VALUES (?,?,?,?)", (report_id, uid, body.device_id, body.kind))
        con.commit()
        status = corroboration.recompute(con, report_id)
        if antibrigade.is_brigaded(con, report_id):
            con.execute("UPDATE reports SET status='under_review' WHERE id=?", (report_id,))
            con.commit(); status = "under_review"
        n = con.execute("SELECT COUNT(*) FROM confirmations WHERE report_id=? AND kind='confirm'",
                        (report_id,)).fetchone()[0]
        return {"status": status, "confirmations": n}
    finally:
        con.close()


@router.get("/reports")
def list_reports(min_lat: float, min_lng: float, max_lat: float, max_lng: float):
    con = reports_db.con()
    try:
        frag, params = geo.bbox_where(min_lat, min_lng, max_lat, max_lng)
        rows = con.execute(
            f"SELECT r.id,r.lat,r.lng,r.category,r.status,r.region_name,"
            f"(SELECT COUNT(*) FROM confirmations cf WHERE cf.report_id=r.id AND cf.kind='confirm') "
            f"AS confirmations FROM reports r "
            f"WHERE {frag} AND r.status IN ('reported','verified')", params).fetchall()
        return {"reports": [dict(x) for x in rows]}
    finally:
        con.close()


@router.get("/reports/{report_id}")
def get_report(report_id: int):
    con = reports_db.con()
    try:
        r = con.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
        if not r:
            raise HTTPException(404, "no_report")
        n = con.execute("SELECT COUNT(*) FROM confirmations WHERE report_id=? AND kind='confirm'",
                        (report_id,)).fetchone()[0]
        d = dict(r); d["suggested_contracts"] = json.loads(d.get("suggested_contracts") or "[]")
        d["confirmations"] = n
        return d
    finally:
        con.close()


@router.get("/authorities/{region_name}/summary")
def authority_summary(region_name: str):
    con = reports_db.con()
    try:
        affected = con.execute(
            "SELECT COUNT(*) FROM reports WHERE region_name=? AND status IN ('reported','verified')",
            (region_name,)).fetchone()[0]
        verified = con.execute(
            "SELECT COUNT(*) FROM reports WHERE region_name=? AND status='verified'",
            (region_name,)).fetchone()[0]
        top = contracts_match.suggest(con, region_name, "other", limit=1)
        return {"region_name": region_name, "affected": affected,
                "verified": verified, "top_contract": top[0] if top else None}
    finally:
        con.close()
