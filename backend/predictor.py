"""Единичен прогнозен модел за предиктор формата.
Зарежда risk.txt (LightGBM) + медиани на просрочване; връща риск + очаквани дни.
"""
import os
import json
import numpy as np
import pandas as pd
import lightgbm as lgb

HERE = os.path.dirname(__file__)
MODEL = os.path.join(HERE, "..", "models", "risk.txt")
DAYS_MODEL = os.path.join(HERE, "..", "models", "days.txt")
DATA = os.path.join(HERE, "..", "data", "processed", "all_contracts.csv")
RATES_FILE = os.path.join(HERE, "..", "data", "processed", "rates.json")

try:
    with open(RATES_FILE, encoding="utf-8") as f:
        _rates = json.load(f)
except Exception:
    _rates = {"global": 0.065, "buyer": {}, "supplier": {}}

FEATS = ["category", "sector", "log_value", "value_per_day", "region",
         "start_month", "planned_days", "is_repair", "n_tenderers", "buyer_rate", "supplier_rate"]
SECTORS = ["roads", "water", "parks", "lighting", "public", "other"]

# име на област -> NUTS код (както в експорта)
NAME2CODE = {
    "Видин": "BG311", "Монтана": "BG312", "Враца": "BG313", "Плевен": "BG314", "Ловеч": "BG315",
    "Велико Търново": "BG321", "Габрово": "BG322", "Русе": "BG323", "Разград": "BG324", "Силистра": "BG325",
    "Варна": "BG331", "Добрич": "BG332", "Шумен": "BG333", "Търговище": "BG334", "Бургас": "BG341",
    "Сливен": "BG342", "Ямбол": "BG343", "Стара Загора": "BG344", "София (столица)": "BG411",
    "София област": "BG412", "Благоевград": "BG413", "Перник": "BG414", "Кюстендил": "BG415",
    "Пловдив": "BG421", "Пазарджик": "BG422", "Смолян": "BG423", "Хасково": "BG424", "Кърджали": "BG425",
}

_booster = lgb.Booster(model_file=MODEL)
_days = lgb.Booster(model_file=DAYS_MODEL)
_df = pd.read_csv(DATA)
_df = _df[_df["value"].notna() & (_df["value"] > 0)]
if "sector" not in _df.columns:
    _df["sector"] = "other"
# същите категории/подредба като при трениране
CATS = {c: pd.CategoricalDtype(categories=sorted(_df[c].fillna("NA").astype(str).unique())) for c in ["category", "region"]}
CATS["sector"] = pd.CategoricalDtype(categories=SECTORS)
_pos = _df[_df["overrun_days"] > 0]
MED = {k: int(v) for k, v in _pos.groupby("sector")["overrun_days"].median().items()}
OVERALL = int(_pos["overrun_days"].median())


def predict(d: dict) -> dict:
    region = NAME2CODE.get(str(d.get("region", "")), str(d.get("region", "NA")))
    value = float(d.get("value", 0) or 0)
    planned = max(1, int(d.get("planned_days", 120)))
    sector = str(d.get("sector", "roads"))
    if sector not in SECTORS:
        sector = "other"
    
    buyer = str(d.get("buyer") or "")
    supplier = str(d.get("supplier") or "")
    buyer_rate = _rates["buyer"].get(buyer, _rates["global"])
    supplier_rate = _rates["supplier"].get(supplier, _rates["global"])

    row = pd.DataFrame([{
        "category": str(d.get("category", "works")),
        "sector": sector,
        "log_value": np.log1p(value),
        "value_per_day": np.log1p(value / planned),
        "region": region,
        "start_month": int(d.get("month", 6)),
        "planned_days": planned,
        "is_repair": int(d.get("is_repair", 1)),
        "n_tenderers": float(d.get("n_tenderers", 1)),
        "buyer_rate": buyer_rate,
        "supplier_rate": supplier_rate,
    }])
    for c in ("category", "region", "sector"):
        row[c] = row[c].astype(CATS[c])
    p = float(_booster.predict(row[FEATS])[0])
    p = max(0.0, min(1.0, p))
    level = "high" if p >= 0.6 else "med" if p >= 0.33 else "low"
    # очаквани дни от регресора (варира), blend с медианата по сектор за пол
    pred = float(np.expm1(_days.predict(row[FEATS])[0]))
    floor = MED.get(sector, OVERALL)
    exp = int(max(7, min(900, round(0.7 * pred + 0.3 * floor))))
    return {"risk": round(p, 3), "level": level, "expected_days": exp,
            "drivers": _drivers(value, planned, sector, int(d.get("month", 6)), float(d.get("n_tenderers", 1)), buyer_rate, supplier_rate)}


def _drivers(value, planned, sector, month, ntend, buyer_rate, supplier_rate):
    """Кратки човешки обяснения кои фактори тежат - за AI анализа/UI."""
    out = []
    if supplier_rate > _rates["global"] * 1.5:
        out.append("рисков изпълнител (чести просрочвания в миналото)")
    if buyer_rate > _rates["global"] * 1.5:
        out.append("рисков възложител (чести забавяния на този възложител)")
    if value >= 500000:
        out.append("висока стойност (по-големите договори се удължават по-често)")
    if planned <= 60:
        out.append("кратък обещан срок (амбициозни срокове трудно се спазват)")
    elif planned >= 365:
        out.append("дълъг срок (повече време за непредвидени пречки)")
    if month in (11, 12, 1, 2):
        out.append("зимен старт (метеорологичните пречки бавят строежа)")
    if ntend <= 1:
        out.append("слаба конкуренция (1 оферта → по-малък натиск за срочност)")
    if sector in ("roads", "water"):
        out.append("инфраструктурен сектор (зависим от подземни/външни условия)")
    return out[:4]
