"""Fetch Bulgaria oblast (ADM1) polygons -> data/app/bg_oblasti.geojson with
properties.region_name normalized to the exact Cyrillic strings used in the
contracts table. Source: geoBoundaries gbOpen ADM1 (open data)."""
import json, os, urllib.request

SRC = ("https://github.com/wmgeolab/geoBoundaries/raw/9469f09/"
       "releaseData/gbOpen/BGR/ADM1/geoBoundaries-BGR-ADM1.geojson")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "app", "bg_oblasti.geojson")

# geoBoundaries shapeName (Latin) -> region_name (Cyrillic, matches contracts table)
NAME_FIX = {
    "Blagoevgrad": "Благоевград", "Burgas": "Бургас", "Dobrich": "Добрич",
    "Gabrovo": "Габрово", "Haskovo": "Хасково", "Kardzhali": "Кърджали",
    "Kyustendil": "Кюстендил", "Lovech": "Ловеч", "Montana": "Монтана",
    "Pazardzhik": "Пазарджик", "Pernik": "Перник", "Pleven": "Плевен",
    "Plovdiv": "Пловдив", "Razgrad": "Разград", "Ruse": "Русе",
    "Shumen": "Шумен", "Silistra": "Силистра", "Sliven": "Сливен",
    "Smolyan": "Смолян", "Sofia": "София област", "Sofia City": "София (столица)",
    "Stara Zagora": "Стара Загора", "Targovishte": "Търговище", "Varna": "Варна",
    "Veliko Tarnovo": "Велико Търново", "Vidin": "Видин", "Vratsa": "Враца",
    "Yambol": "Ямбол",
}


def main():
    raw = urllib.request.urlopen(SRC, timeout=120).read().decode("utf-8")
    fc = json.loads(raw)
    missing = []
    for f in fc["features"]:
        sn = f.get("properties", {}).get("shapeName", "")
        rn = NAME_FIX.get(sn)
        if rn is None:
            missing.append(sn)
        f["properties"] = {"region_name": rn or sn}
    if missing:
        raise SystemExit(f"Unmapped shapeNames (extend NAME_FIX): {missing}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(fc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print("wrote", os.path.normpath(OUT), "features:", len(fc["features"]))


if __name__ == "__main__":
    main()
