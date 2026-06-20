"""HTTP endpoint за 'Докога?' — чат + предиктор, със защити.
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
_GUARDED = {"/chat", "/predict"}

app = FastAPI(title="Докога? API", version="0.2")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def guard(request: Request, call_next):
    if request.url.path in _GUARDED:
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
    value: float = Field(default=150000, ge=0, le=1e9)
    region: str = Field(default="София (столица)", max_length=40)
    month: int = Field(default=6, ge=1, le=12)
    planned_days: int = Field(default=120, ge=1, le=2000)
    n_tenderers: int = Field(default=1, ge=0, le=200)
    is_repair: int = Field(default=1, ge=0, le=1)


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
