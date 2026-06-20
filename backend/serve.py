"""HTTP endpoint за 'Докога?' - чат + предиктор, със защити.
Стартиране:  uvicorn serve:app --port 8000   (от папка backend/)
"""
import os
import re
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import agent
import predictor
import reports_api

# ---- защита: CORS allowlist (конфигурируем) ----
ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173"
    ).split(",")
    if o.strip()
]

# ---- защита: rate limit (per IP) ----
RATE_N = int(os.environ.get("RATE_LIMIT", "30"))   # заявки
RATE_WINDOW = 60                                    # секунди
_hits: dict[str, deque] = defaultdict(deque)
_GUARDED = {"/chat", "/predict", "/analyze", "/reports"}

app = FastAPI(title="Докога? API", version="0.2")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    max_age=600,
)
app.include_router(reports_api.router)


@app.middleware("http")
async def guard(request: Request, call_next):
    p = request.url.path
    if p in _GUARDED or (p.startswith("/reports/") and p.endswith("/confirm")):
        ip = request.client.host if request.client else "anon"
        now = time.time()
        dq = _hits[ip]
        while dq and now - dq[0] > RATE_WINDOW:
            dq.popleft()
        if len(dq) >= RATE_N:
            return JSONResponse(
                {"error": "Твърде много заявки. Опитай пак след малко."}, status_code=429
            )
        dq.append(now)
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


def _clean(s: str) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", s).strip()[:500]


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class PredictIn(BaseModel):
    category: str = Field(default="works", max_length=20)
    sector: str = Field(default="roads", max_length=20)
    value: float = Field(default=150000, ge=0, le=1e9)
    region: str = Field(default="София (столица)", max_length=40)
    month: int = Field(default=6, ge=1, le=12)
    planned_days: int = Field(default=120, ge=1, le=2000)
    n_tenderers: int = Field(default=1, ge=0, le=200)
    is_repair: int = Field(default=1, ge=0, le=1)


class AnalyzeIn(BaseModel):
    ocid: str = Field(default="", max_length=80)
    title: str = Field(default="", max_length=240)
    sector: str = Field(default="roads", max_length=20)
    sector_name: str = Field(default="", max_length=60)
    region: str = Field(default="", max_length=40)
    value: float = Field(default=0, ge=0, le=1e9)
    planned_days: int = Field(default=120, ge=1, le=2000)
    supplier: str = Field(default="", max_length=160)
    buyer: str = Field(default="", max_length=160)
    risk: float = Field(default=0, ge=0, le=1)
    expected_days: int = Field(default=0, ge=0, le=2000)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
def chat(inp: ChatIn):
    try:
        return agent.answer(_clean(inp.message))
    except Exception:
        return {"answer": "Възникна грешка при заявката.", "data": None}


@app.post("/predict")
def predict(inp: PredictIn):
    try:
        return predictor.predict(inp.model_dump())
    except Exception:
        return {"error": "Прогнозата не успя."}


@app.post("/analyze")
def analyze(inp: AnalyzeIn):
    facts = inp.model_dump()
    facts["title"] = _clean(facts.get("title", ""))
    try:
        # драйверите идват от модела - за конкретния сектор/стойност/срок
        drivers = predictor.predict({
            "category": "works", "sector": facts["sector"], "value": facts["value"],
            "region": facts["region"], "month": 6, "planned_days": facts["planned_days"],
            "n_tenderers": 1, "is_repair": 1,
        }).get("drivers", [])
        facts["drivers"] = drivers
        return agent.analyze(facts)
    except Exception:
        return {"analysis": "AI анализът не успя. Опитай пак.", "drivers": []}
