"""HTTP endpoint за 'Докога?' LLM слоя.
Стартиране:  uvicorn serve:app --reload   (от папка backend/)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import agent

app = FastAPI(title="Докога? API", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

class ChatIn(BaseModel):
    message: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat")
def chat(inp: ChatIn):
    """Въпрос на български -> граундиран отговор + ползваните данни."""
    try:
        return agent.answer(inp.message)
    except Exception as e:
        return {"answer": "Възникна грешка при заявката.", "error": str(e), "data": None}
