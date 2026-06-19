"""LLM слой за 'Докога?' — retrieve-then-narrate граундинг.
1) routera избира заявка   2) SQLite връща ВЕРНИ числа   3) LLM само ги разказва.
Моделът никога не измисля числа. Работи и с Gemma (без native function calling).
"""
import os, re, json, sys
from google import genai
from google.genai import types
from dotenv import load_dotenv
import tools

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

MODELS = ["gemma-4-31b-it", "gemini-3.1-flash-lite-preview", "gemma-4-26b-a4b-it"]

def generate(prompt: str, temperature: float = 0.2) -> str:
    """Опитва моделите по ред; връща текст от първия успешен."""
    last = None
    for m in MODELS:
        try:
            r = _client.models.generate_content(
                model=m, contents=prompt,
                config=types.GenerateContentConfig(temperature=temperature, max_output_tokens=600))
            if r.text:
                return r.text.strip()
        except Exception as e:
            last = f"{m}: {e}"
            continue
    raise RuntimeError(f"всички модели се провалиха · последна грешка: {last}")

ROUTER = """Ти си рутер за инструменти. Според въпроса избери ЕДИН инструмент и аргумент.
Върни САМО JSON, без друг текст. Формат: {{"tool": "<име>", "arg": "<стойност>"}}

Инструменти:
- get_region_stats(arg=име на област)         -> просрочване по област
- get_contractor_stats(arg=име на фирма/ЕИК)   -> история на изпълнител
- search_contracts(arg=ключова дума)           -> конкретни ремонтни договори
- top_risky_regions(arg="")                    -> най-проблемните области
- top_risky_contractors(arg="")                -> най-просрочващите фирми

Въпрос: {q}
JSON:"""

NARRATE = """Ти си асистентът на „Докога?" — показва просрочването на обществените ремонти в България.
Отговори на въпроса САМО въз основа на данните по-долу. НЕ измисляй числа.
Ако данните са празни/found=false, кажи честно, че няма достатъчно данни.
Пиши на български, кратко (2-4 изречения), с конкретните числа. Тон: ясен, леко директен.

Въпрос: {q}

ПРОВЕРЕНИ ДАННИ (единственият ти източник на числа):
{data}

Отговор:"""

def _route(question: str):
    raw = generate(ROUTER.format(q=question), temperature=0.0)
    m = re.search(r"\{.*\}", raw, re.S)
    if m:
        try:
            j = json.loads(m.group(0))
            tool = j.get("tool"); arg = j.get("arg", "")
            if tool in tools.TOOLS:
                return tool, arg
        except Exception:
            pass
    return "search_contracts", question  # безопасен fallback

def answer(question: str) -> dict:
    tool, arg = _route(question)
    fn = tools.TOOLS[tool]
    data = fn(arg) if arg else fn()
    text = generate(NARRATE.format(q=question, data=json.dumps(data, ensure_ascii=False, indent=1)))
    return {"answer": text, "tool": tool, "arg": arg, "data": data}

if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or "Кои са най-просрочващите изпълнители?"
    out = answer(q)
    print(f"\nИнструмент: {out['tool']}({out['arg']!r})")
    print(f"Данни: {json.dumps(out['data'], ensure_ascii=False)[:300]}")
    print(f"\nОтговор:\n{out['answer']}")
