"""Единичен прогнозен модел за предиктор формата.
Зарежда risk.txt (LightGBM) + медиани на просрочване; връща риск + очаквани дни.
"""
import os
import numpy as np
import pandas as pd
import lightgbm as lgb

HERE = os.path.dirname(__file__)
MODEL = os.path.join(HERE, "..", "models", "risk.txt")
DATA = os.path.join(HERE, "..", "data", "processed", "all_contracts.csv")

FEATS = ["category", "log_value", "region", "start_month", "planned_days", "is_repair", "n_tenderers"]

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
_df = pd.read_csv(DATA)
_df = _df[_df["value"].notna() & (_df["value"] > 0)]
# същите категории/подредба като при трениране
CATS = {c: pd.CategoricalDtype(categories=sorted(_df[c].fillna("NA").astype(str).unique())) for c in ["category", "region"]}
_pos = _df[_df["overrun_days"] > 0]
MED = {k: int(v) for k, v in _pos.groupby("category")["overrun_days"].median().items()}
OVERALL = int(_pos["overrun_days"].median())


def predict(d: dict) -> dict:
    region = NAME2CODE.get(str(d.get("region", "")), str(d.get("region", "NA")))
    row = pd.DataFrame([{
        "category": str(d.get("category", "works")),
        "log_value": np.log1p(float(d.get("value", 0) or 0)),
        "region": region,
        "start_month": int(d.get("month", 6)),
        "planned_days": int(d.get("planned_days", 120)),
        "is_repair": int(d.get("is_repair", 1)),
        "n_tenderers": float(d.get("n_tenderers", 1)),
    }])
    for c in ("category", "region"):
        row[c] = row[c].astype(CATS[c])
    p = float(_booster.predict(row[FEATS])[0])
    p = max(0.0, min(1.0, p))
    level = "high" if p >= 0.6 else "med" if p >= 0.33 else "low"
    exp = MED.get(str(d.get("category", "works")), OVERALL)
    return {"risk": round(p, 3), "level": level, "expected_days": exp}
