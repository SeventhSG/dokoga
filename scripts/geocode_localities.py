import os
import re
import json
import time
import urllib.request
import urllib.parse
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
PROC = os.path.join(HERE, "..", "data", "processed")
CACHE_FILE = os.path.join(PROC, "geocoding_cache.json")
CSV_FILE = os.path.join(PROC, "all_contracts.csv")

# Seed with standard capitals
SEED = {
    "София": [42.6977, 23.3219],
    "Пловдив": [42.1354, 24.7453],
    "Варна": [43.2141, 27.9147],
    "Бургас": [42.5048, 27.4626],
    "Русе": [43.8356, 25.9657],
    "Стара Загора": [42.4258, 25.6345],
    "Плевен": [43.4170, 24.6067],
    "Сливен": [42.6817, 26.3229],
    "Добрич": [43.5726, 27.8273],
    "Шумен": [43.2712, 26.9361],
    "Перник": [42.6052, 23.0378],
    "Хасково": [41.9344, 25.5554],
    "Ямбол": [42.4842, 26.5035],
    "Пазарджик": [42.1928, 24.3297],
    "Благоевград": [42.0206, 23.0943],
    "Велико Търново": [43.0757, 25.6172],
    "Враца": [43.2102, 23.5529],
    "Габрово": [42.8742, 25.3187],
    "Видин": [43.9962, 22.8679],
    "Асеновград": [42.0117, 24.8775],
    "Казанлък": [42.6200, 25.3944],
    "Кюстендил": [42.2839, 22.6906],
    "Кърджали": [41.6338, 25.3777],
    "Димитровград": [42.0583, 25.5903],
    "Ловеч": [43.1371, 24.7142],
    "Монтана": [43.4125, 23.2250],
    "Търговище": [43.2512, 26.5721],
    "Разград": [43.5254, 26.5234],
    "Силистра": [44.1147, 27.2671],
    "Смолян": [41.5744, 24.7120],
}

def normalize_locality(s):
    if not isinstance(s, str):
        return ""
    s = s.strip()
    s = re.sub(r"^(гр\.\s*|с\.\s*|град\s+|село\s+|община\s+|общ\.\s*)", "", s, flags=re.IGNORECASE)
    return s.strip()

def geocode_nominatim(locality):
    query = f"{locality}, Bulgaria"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "limit": 1
    })
    headers = {
        "User-Agent": "dokoga-geocoder/1.0 (ozi.serbest@gmail.com)"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                return [lat, lon]
    except Exception as e:
        print(f"Error geocoding {locality}: {e}")
    return None

def main():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            cache = {}
    else:
        cache = {}

    # Seed initial capitals
    for k, v in SEED.items():
        if k not in cache:
            cache[k] = v

    df = pd.read_csv(CSV_FILE)
    localities = df["locality"].dropna().unique()
    normalized_list = sorted(list(set(normalize_locality(l) for l in localities if normalize_locality(l))))

    print(f"Total normalized localities to verify: {len(normalized_list)}")
    
    missing = [l for l in normalized_list if l not in cache]
    print(f"Missing from cache: {len(missing)}")

    for i, locality in enumerate(missing, 1):
        print(f"[{i}/{len(missing)}] Geocoding '{locality}'...")
        coords = geocode_nominatim(locality)
        if coords:
            cache[locality] = coords
            print(f"  -> SUCCESS: {coords}")
            # Save progress immediately
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
        else:
            print(f"  -> FAILED")
        
        # Polite delay
        time.sleep(1.2)

    # Save final cache
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    print("Geocoding process finished!")

if __name__ == "__main__":
    main()
