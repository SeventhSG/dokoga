"""Сваля договори+анекси (CSV zip) от data.egov.bg и инспектира съдържанието.
Само stdlib — за бърза валидация преди да слагаме pandas/lightgbm.
"""
import io
import os
import csv
import sys
import json
import time
import zipfile
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

RAW = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
os.makedirs(RAW, exist_ok=True)

DATASETS = {
    "2024": "88ea1672-944b-4b9a-b074-528e316eab46",
    "2025": "7990cb41-719d-4616-b656-c750ebb487d7",
}
TRIGGER = "https://data.egov.bg/dataset/{uuid}/resources/download/csv"
ZIP_URL = "https://data.egov.bg/dataset/resources/download/zip/{format}/{uri}/{de}"
UA = {"User-Agent": "Mozilla/5.0"}

def _get(url, timeout=180):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def download(year, uuid):
    # стъпка 1: trigger -> JSON {uri, format, delete_only_zip}
    meta = json.loads(_get(TRIGGER.format(uuid=uuid)).decode("utf-8"))
    de = str(meta.get("delete_only_zip", True)).lower()
    zurl = ZIP_URL.format(format=meta["format"], uri=meta["uri"], de=de)
    print(f"[{year}] zip URL -> {zurl}")
    # стъпка 2: реалния zip (малко изчакване за генериране)
    for attempt in range(4):
        data = _get(zurl)
        if data[:2] == b"PK":
            print(f"[{year}] downloaded {len(data):,} bytes")
            return data
        time.sleep(2)
    raise RuntimeError(f"не е zip ({len(data)} bytes): {data[:120]!r}")

def inspect_zip(year, data):
    z = zipfile.ZipFile(io.BytesIO(data))
    # запази суровия zip
    with open(os.path.join(RAW, f"contracts_{year}.zip"), "wb") as f:
        f.write(data)
    for name in z.namelist():
        raw = z.read(name)
        # извличаме всеки csv за по-нататък
        out_path = os.path.join(RAW, f"{year}__{os.path.basename(name)}")
        with open(out_path, "wb") as f:
            f.write(raw)
        # хедъри + брой редове
        text = raw.decode("utf-8-sig", errors="replace")
        lines = text.splitlines()
        # авто-детекция на разделител
        sample = lines[0] if lines else ""
        delim = ";" if sample.count(";") > sample.count(",") else ","
        reader = csv.reader(lines, delimiter=delim)
        rows = list(reader)
        headers = rows[0] if rows else []
        print(f"\n=== [{year}] {name}  (delim='{delim}', {len(rows)-1:,} реда) ===")
        for i, h in enumerate(headers):
            print(f"  [{i:2}] {h}")

if __name__ == "__main__":
    for year, uuid in DATASETS.items():
        try:
            data = download(year, uuid)
            inspect_zip(year, data)
        except Exception as e:
            print(f"[{year}] ГРЕШКА: {e!r}")
    print("\nГотово. Суровите файлове са в data/raw/")
