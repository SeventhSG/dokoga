"""LLM слой за 'Докога?' - retrieve-then-narrate граундинг.
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

# flash-lite пръв - по-бърз; gemma моделите са fallback
MODELS = ["gemini-3.1-flash-lite-preview", "gemma-4-31b-it", "gemma-4-26b-a4b-it"]

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
- top_by_value(arg="")                         -> най-скъпите ремонти (най-голям бюджет/стойност)
- top_risky_regions(arg="")                    -> най-проблемните области
- top_risky_contractors(arg="")                -> най-просрочващите фирми

Въпрос: {q}
JSON:"""

NARRATE = """Ти си асистентът на „Докога?" - показва просрочването на обществените ремонти в България.
Отговори на въпроса САМО въз основа на данните по-долу. НЕ измисляй числа.
Ако данните са празни/found=false, кажи честно, че няма достатъчно данни.
Пиши на български, кратко (2-4 изречения), с конкретните числа. Тон: ясен, леко директен.

Въпрос: {q}

ПРОВЕРЕНИ ДАННИ (единственият ти източник на числа):
{data}

Отговор:"""

def _route(question: str):
    # бърз keyword shortcut за „най-голям бюджет/стойност" (преди LLM)
    if re.search(r"бюджет|най-скъп|най-голям[аи]?\s*(стойност|сума|пари)|най-много пари", question, re.I):
        return "top_by_value", ""
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


def _focus(tool: str, data) -> dict | None:
    """Къде да отлети картата според отговора (ocid на проект или област)."""
    if tool in ("search_contracts", "top_by_value") and isinstance(data, list) and data:
        d0 = data[0]
        return {"ocid": d0.get("ocid"), "region": d0.get("област")}
    if tool == "get_region_stats" and isinstance(data, dict) and data.get("found"):
        return {"region": data.get("region")}
    if tool == "top_risky_regions" and isinstance(data, list) and data:
        return {"region": data[0].get("област")}
    return None


def answer(question: str) -> dict:
    tool, arg = _route(question)
    fn = tools.TOOLS[tool]
    data = fn(arg) if arg else fn()
    text = generate(NARRATE.format(q=question, data=json.dumps(data, ensure_ascii=False, indent=1)))
    return {"answer": text, "tool": tool, "arg": arg, "data": data, "focus": _focus(tool, data)}


ANALYZE = """Ти си анализатор на „Докога?" - обясняваш ЗАЩО конкретен обществен ремонт
рискува да се проточи. Пиши на български, 3-5 изречения, конкретно и леко директно.
Ползвай САМО числата по-долу - НЕ измисляй. Свържи факторите в кратък разказ:
започни с присъдата (риск + очаквано забавяне), после обясни кои фактори тежат и
какво показва историята на областта/изпълнителя. Накрая едно изречение какво да
следи гражданинът. Без обвинения в измама - това е оценка по история.

ПРОЕКТ (проверени данни):
{facts}

Анализ:"""


def analyze(facts: dict) -> dict:
    """Граундиран LLM анализ за конкретен проект от картата."""
    region = facts.get("region") or ""
    supplier = facts.get("supplier") or ""
    reg = tools.get_region_stats(region) if region and region != "-" else {"found": False}
    con = tools.get_contractor_stats(supplier) if supplier else {"found": False}
    payload = {
        "заглавие": facts.get("title"),
        "сектор": facts.get("sector_name") or facts.get("sector"),
        "област": region,
        "стойност_лв": facts.get("value"),
        "обещан_срок_дни": facts.get("planned_days"),
        "риск_процент": round(float(facts.get("risk", 0)) * 100),
        "очаквано_забавяне_дни": facts.get("expected_days"),
        "рискови_фактори": facts.get("drivers", []),
        "статистика_област": reg,
        "история_изпълнител": con if con.get("found") else "няма данни за изпълнителя",
    }
    text = generate(ANALYZE.format(facts=json.dumps(payload, ensure_ascii=False, indent=1)), temperature=0.3)
    text = re.sub(r"^\s*Анализ\s*:?\s*", "", text).strip()
    return {"analysis": text, "drivers": facts.get("drivers", []),
            "region_stats": reg, "contractor_stats": con}

if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or "Кои са най-просрочващите изпълнители?"
    out = answer(q)
    print(f"\nИнструмент: {out['tool']}({out['arg']!r})")
    print(f"Данни: {json.dumps(out['data'], ensure_ascii=False)[:300]}")
    print(f"\nОтговор:\n{out['answer']}")
