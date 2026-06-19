"""Бърз тест на /chat без да вдигаме сървър (FastAPI TestClient)."""
import sys
from fastapi.testclient import TestClient
import serve
sys.stdout.reconfigure(encoding="utf-8")

c = TestClient(serve.app)
print("health:", c.get("/health").json())
for q in ["Кои изпълнители просрочват най-много?", "Какво е положението в Пловдив?"]:
    r = c.post("/chat", json={"message": q}).json()
    print(f"\nQ: {q}\n  tool: {r.get('tool')}({r.get('arg')!r})\n  A: {r.get('answer')}")
