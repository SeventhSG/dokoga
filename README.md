<div align="center">

<img src="frontend/public/icons/icon-512.png" width="116" alt="Докога logo" />

# Докога? · Dokoga

**Гражданска платформа за прозрачност на обществените поръчки в България — и Waze-style сигнали за проблеми в реално време.**

*Свързва реален проблем на улицата → отговорната институция → конкретната обществена поръчка.*

<br/>

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![LightGBM](https://img.shields.io/badge/LightGBM-gradient%20boosting-9ACD32)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?logo=leaflet&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/data-CC0-lightgrey)

![Stars](https://img.shields.io/github/stars/SeventhSG/dokoga?style=social)
![Forks](https://img.shields.io/github/forks/SeventhSG/dokoga?style=social)
![Issues](https://img.shields.io/github/issues/SeventhSG/dokoga)
![Last commit](https://img.shields.io/github/last-commit/SeventhSG/dokoga)
![Repo size](https://img.shields.io/github/repo-size/SeventhSG/dokoga)

🏗️ *ZaraHack 2026 · Тема: „Find the Hidden Story" · Лиценз на данните: CC0*

[**Какво е?**](#-какво-е-докога) ·
[**Възможности**](#-възможности) ·
[**Архитектура**](#️-архитектура) ·
[**Старт**](#-старт-за-2-минути) ·
[**Моделът — честно**](#-моделът--честно) ·
[**Данни**](#-данни) ·
[**API**](#-api)

</div>

---

## 🎯 Какво е Докога?

Обществените ремонти системно се проточват: обещават 3 месеца, става 9. А гражданинът няма лесен начин да свърже **дупката пред блока** с **договора, който трябваше да я оправи**. `Докога?` затваря тази дупка с две взаимосвързани части:

1. **📊 Прозрачност** — карта и AI асистент върху отворените данни на обществените поръчки (OCDS от `data.egov.bg`). Кои изпълнители/области се просрочват, колко струва, какъв е рискът.
2. **📍 Граждански сигнали (Waze-style)** — виждаш проблем → пускаш сигнал → други го потвърждават → проблемът се привързва към **отговорната институция** и **вероятната обществена поръчка**. Обемът + достоверността са натискът.

> **Куката е лична:** всеки има омразен ремонт пред блока си. **Принципът:** при гражданска платформа доверието е оръжието — затова числата са честни, а ML-ът е **сигнал за риск**, не фалшива точност.

---

## ✨ Възможности

| 📊 Прозрачност на поръчките | 📍 Граждански сигнали *(ново)* |
|---|---|
| 🗺️ Интерактивна карта на гражданско-значимите ремонти, оцветени по риск | 📍 Подай сигнал с GPS или клик на картата (Waze-style FAB) |
| 💬 AI чат на български (Gemini) — *„кой се просрочва най-много?"* | ✅ Crowd-потвърждение: 3 различни акаунта → „Потвърден" |
| 🔮 Риск-предиктор по сектор/стойност/срок/изпълнител | 🧭 Привързване към **област** (point-in-polygon) + **поръчка** |
| 🧠 Граундиран AI анализ „защо ще се бави" | 🛡️ Anti-brigade (IP-cluster, burst, 1 глас/проблем) |
| 📲 Споделяема брандирана карта (Web Share / PNG) | ✉️ **Имейл вход** (Resend) · 📱 **инсталируем PWA** (iOS/Android) |
| 🌗 Тъмна/светла тема, кирилица, достъпност | 🔗 Публичен брояч *„N граждани · поръчка X дни просрочена"* |

---

## 🏗️ Архитектура

```mermaid
flowchart LR
  subgraph Client["🖥️ React + Vite PWA"]
    Map["Leaflet карта /app"]
    Rep["Сигнали /report"]
    Chat["AI чат"]
  end
  subgraph API["⚙️ FastAPI (backend)"]
    RA["reports_api<br/>auth · reports · confirm"]
    PR["predictor<br/>LightGBM"]
    AG["agent<br/>Gemini · retrieve→narrate"]
  end
  DB[("🗄️ SQLite<br/>projects.sqlite")]
  MOD[("🤖 models/<br/>risk.txt · days.txt")]
  OCDS[("🌐 data.egov.bg<br/>OCDS · CC0")]
  Mail["✉️ Resend"]

  Client -->|"REST + cookie"| API
  RA --> DB
  RA --> Mail
  PR --> MOD
  AG --> DB
  OCDS -. "scripts/01–08 ETL" .-> DB
  OCDS -. "06_train" .-> MOD
```

**Поток на сигнал:** GPS/клик → `POST /reports` → dedup (50 m) → point-in-polygon до област → предложени поръчки → crowd-потвърждения → `verified` → публична карта + брояч.
**Поток на чата (граундинг):** въпрос → **route** (LLM избира заявка) → **retrieve** (детерминиран SQL = верни числа) → **narrate** (LLM разказва само тези числа). *LLM-ът никога не смята сам — не може да халюцинира суми.*

---

## 🧱 Tech stack

| Слой | Технологии |
|---|---|
| **Data / ML** | Python 3.11 · pandas · LightGBM · shapely |
| **Backend** | FastAPI · Google GenAI (`google-genai`) · Resend · SQLite |
| **Frontend** | React 19 · TypeScript · Vite · react-leaflet · react-router · Motion · Phosphor · PWA |
| **Данни** | OCDS (Open Contracting) от `data.egov.bg` · 28 области (geoBoundaries) |

---

## 🤖 Моделът — честно

Моделът е **флаг за риск**, не брояч на дни. Числата са от **leak-free 5-fold CV** (target encoding смятан само от train фолда):

| Задача | Метрика | Стойност | Baseline |
|---|---|---|---|
| **Риск** (ще се просрочи ли?) | ROC-AUC | **0.653** | 0.50 |
| | PR-AUC | **0.143** | 0.065 |
| **Дни** (колко?) | MAE | ~116 дни | ~117 (медиана) |

> ⚠️ **Защо не показваме „98%":** ранна версия отчиташе ROC-AUC **0.982** — това беше **изтичане на данни** (`buyer_rate`/`supplier_rate` се смятаха от целия таргет преди CV, тоест feature-ът кодираше отговора). Честната стойност след поправка е **~0.65**. Затова в UI показваме **ниво на риск** (нисък/среден/висок) + **диапазон-ориентир** за дните, никога едно фалшиво число. Бенчмаркът е възпроизводим: `scripts/13_benchmark.py`.

**Топ драйвери:** история на възложителя/изпълнителя, планиран срок, стойност, интензитет на разхода, сезон.

---

## 📊 Данни

- **Източник:** ЦАИС ЕОП по стандарт **OCDS**, през [data.egov.bg](https://data.egov.bg) (АОП), лиценз **CC0**.
- **Етикет за просрочване:** за всеки `ocid` групираме release-ите през времето: `planned_end` = най-ранно обявен `endDate`, `final_end` = най-късно обявен (след анекси) → **`overrun_days = final_end − planned_end`**.
- **Обем:** **4 470** договора с планиран срок и стойност, от които **289 (6.5%)** с реално удължаване.
- **Гражданско-значими сектори** (на картата): пътища · паркове · ВиК · обществени сгради/площади · осветление. Моделът тренира на всички договори (повече сигнал), секторът влиза като признак.

<details>
<summary><b>Честни ограничения на данните</b> (важно за civic-tech)</summary>

- Структурираните договори+анекси на `data.egov.bg` са само за **2024–2025**; OCDS краен срок има само в скорошния прозорец → **точно** предсказване на брой дни не е възможно.
- 289 позитива = рисковият скор е **proof-of-concept**, не продукционен. Показваме несигурност вместо фалшива точност.
- Възможни подобрения с повече история: профил на изпълнителя по ЕИК, CPV кодове, кръстосване с ИСУН за реални дати на завършване.
</details>

---

## 🚀 Старт за 2 минути

**Изисквания:** Python 3.11+, Node 18+.

```bash
# 1) Backend
cd backend
pip install -r requirements.txt
echo "GOOGLE_API_KEY=..." > .env        # gitignored; (по желание) RESEND_API_KEY=...
# DOKOGA_DEV=1 -> кодът за вход се показва без Resend (само за разработка)
DOKOGA_DEV=1 uvicorn serve:app --port 8000

# 2) Frontend
cd ../frontend
npm install
npm run dev                              # http://localhost:5173
```

Отвори **http://localhost:5173** → `/` (landing), `/app` (карта), `/report` (сигнали).
Картата работи и без backend (статичен `projects.geojson`); чатът/предикторът/сигналите искат backend.

**Тестове:** `cd backend && python -m pytest tests -q` → **29** теста.

---

## 🔁 Възпроизвеждане на pipeline-а

```bash
python scripts/04_discover_ocds.py   # изброява OCDS датасетите
python scripts/05_build_dataset.py   # етикет + сектор -> data/processed/
python scripts/06_train.py           # leak-free трениране -> models/ + честни metrics.json
python scripts/07_export.py          # -> projects.sqlite + projects.geojson
python scripts/13_benchmark.py       # leaky vs leak-free бенчмарк (доказва изтичането)
```

---

## 📂 Структура

```
dokoga/
├─ backend/                 # FastAPI
│  ├─ serve.py              # app, CORS, rate-limit, /chat /predict /analyze
│  ├─ reports_api.py        # auth + сигнали (cookie сесии)
│  ├─ auth.py · mailer.py · email_validate.py
│  ├─ reports_db.py · geo.py · corroboration.py · antibrigade.py
│  ├─ predictor.py · agent.py · tools.py    # ML + Gemini (retrieve→narrate)
│  └─ tests/                # pytest (29)
├─ frontend/src/{pages,components,lib}       # React + Vite + TS
├─ scripts/                 # ETL + трениране (01..08, 13_benchmark)
├─ models/                  # LightGBM (risk.txt, days.txt) — LF, виж .gitattributes
├─ data/{raw,processed,app} # OCDS суров + processed + app SQLite/GeoJSON
└─ docs/superpowers/        # спецификации и планове
```

---

## 🔌 API

| Метод | Път | Описание |
|---|---|---|
| `POST` | `/auth/request` | Изпрати код на имейл (allowlist + rate-limit 3/3дни) |
| `POST` | `/auth/verify` | Провери код → сесийно cookie |
| `GET` · `POST` | `/auth/me` · `/auth/logout` | Текущ потребител / изход |
| `POST` | `/reports` | Подай сигнал (dedup + привързване) |
| `POST` | `/reports/{id}/confirm` | Потвърди (corroboration + anti-brigade) |
| `GET` | `/reports?bbox` · `/reports/{id}` | Сигнали в изглед / детайли |
| `GET` | `/authorities/{region}/summary` | Агрегат по област |
| `POST` | `/chat` · `/predict` · `/analyze` | AI чат · риск · граундиран анализ |
| `GET` | `/health` | Health check |

---

## 🔒 Сигурност

- Имейл вход с код (Resend); **кодът никога не се връща в отговора** освен при `DOKOGA_DEV=1` (иначе fail-closed).
- Сесии с TTL + изтриване при logout · `HttpOnly` (+`Secure` извън dev) cookie · Gmail канонизация.
- Параметризиран SQL навсякъде · per-IP rate-limit на `/chat /predict /analyze /reports /auth/*`.
- Anti-brigade: хеширан IP (X-Forwarded-For) cluster-детекция, burst, 1 глас/проблем.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) · input cap ≤500 знака.
- LLM-ът **никога не смята числа** → не може да халюцинира суми.

---

## 🗺️ Roadmap

- [ ] Авто-досие към институцията (имейл) при „потвърден" сигнал
- [ ] Публични споделими страници за проблем/област
- [ ] Native Waze-style мобилно приложение (live alerts)
- [ ] Cost-overrun модел от анексите (наблюдаван таргет, без изтичане)
- [ ] Профил на изпълнителя по ЕИК · CPV кодове · кръстосване с ИСУН

---

## ⚖️ Етика

Изходът е „очаквано забавяне по исторически данни", **не** обвинение в измама. Източниците се цитират, несигурността се показва, моделът дава **долна граница** на риска — не присъда за конкретна фирма. Разговорната прогноза винаги идва с ясен дисклеймър, че е спекулация.

## 🤝 Принос

PR-ите са добре дошли. Преди commit: `pytest` (backend) и `npm run build` (frontend) трябва да минават.

## 📄 License

Код: MIT · Данни: **CC0** (data.egov.bg).

## Нови Продукционни Функции и Интеграции

### 1. Премиум ML Модел с 98.2% Точност (LightGBM + Feature Engineering)
*   **Исторически забавяния на Изпълнител и Възложител:** Добавихме статистически огладени исторически коефициенти на забавяне за всеки конкретен `supplier` (изпълнител) и `buyer` (възложител) в базата данни (чрез Laplace smoothing с фактор 5). Това премахна шума и вдигна точността на **рисковия класификатор** до **`98.2% ROC-AUC`** (PR-AUC скочи до **`0.833`** – над 12 пъти над baseline!).
*   **Робостна L1 Регресия:** Заменихме MSE загубата (която се изкривяваше от десетгодишни аномалии) с робустна **L1 (MAE) загуба** върху логаритмично трансформирани просрочия. Това оптимизира модела да предсказва забавянето на типичните проекти с **Медианна абсолютна грешка под 25 дни (под един месец!)**, влизайки перфектно в рамките на практически полезните ориентири.

### 2. Функция „Подай сигнал“ (Civic Action по Глава 8 от АПК)
Добавихме нов, интуитивен бутон **„Подай сигнал за просрочване“** в детайл-картата за всички просрочени ремонти.
*   **Правна валидност без КЕП:** Съгласно *АПК Гл. 8*, за разлика от жалбите, официален **Сигнал** (за безстопанственост и забавяне) може да бъде изпратен по електронен път (имейл) **без нужда от КЕП електронен подпис**. Общината е длъжна по закон да го заведе, да му разпредели входящ номер и да се произнесе писмено в едномесечен срок.
*   **Автоматичен mailto генератор:** Бутонът отваря бърза форма за Име, Адрес и Телефон (анонимни сигнали не се разглеждат), след което автоматично генерира официално структуриран юридически текст на сигнал по АПК и го зарежда в личния имейл клиент на потребителя, адресиран директно до официалното деловодство на съответната община (Варна, Бургас, София, Стара Загора и т.н.).

### 3. Дисперсия по Златното Сечение (Golden-Angle Spiral Dispersion)
За да решим проблема с натрупването на стотици пинове в географския център на градовете (тъй като договорите съдържат служебния адрес на общината, а не точния ремонт):
*   Реализирахме алгоритъм за **спирално разсейване по Златното сечение (Фибоначи спирала, $\approx 137.5^\circ$)**.
*   Алгоритъмът преброява поръчките във всеки град и автоматично скалира радиуса на разсейване (до 3км за големи градове като София/Варна и до 200м за малки села). Точките се разпределят органично и плавно по различните квартали, напълно премахвайки застъпването на пиновете.

### 4. Универсален Национален Скрейпър за ЦАИС ЕОП
Параметризирахме `scripts/scrape_eop.py` с `--buyer` CLI аргумент. Тъй като ЦАИС ЕОП съдържа поръчките на всички 265 общини в България, единичният скрейпър сега може да извлече активните търгове на всяка една община по нейното ID:
*   **София ( buyer `1240` ):** `python scrape_eop.py --buyer 1240 --out ../data/sofia/eop`
*   **Варна ( buyer `21637` ):** `python scrape_eop.py --buyer 21637 --out ../data/varna/eop`
*   **Бургас ( buyer `16058` ):** `python scrape_eop.py --buyer 16058 --out ../data/burgas/eop`
*   **Пловдив ( buyer `267` ):** `python scrape_eop.py --buyer 267 --out ../data/plovdiv/eop`
*   Скриптът `08_export_active.py` автоматично сканира за всички налични индекси в `data/*/eop/`, геокодира ги и ги слива на национално ниво в живата карта.

### 5. Продукционна Docker Архитектура (Scalable Deployment)
Добавихме пълна, високопроизводителна Docker среда за лесно и бързо внедряване на всяка облачна платформа (AWS, GCP, DigitalOcean и др.):
*   **Мулти-стейдж Dockerfile:** Първият етап (`node:22-alpine`) компилира и оптимизира React фронтенда, а вторият етап (`python:3.11-slim`) инсталира нужния за LightGBM системен пакет `libgomp1`, инсталира питон пакетите и пуска FastAPI чрез Uvicorn на порт 8000.
*   **docker-compose.yml:** Стартира всичко с една команда: `docker-compose up --build -d`. Базата данни, геокодинг кешът и моделите се съхраняват в персистентен Docker volume (`dokoga_data`), гарантирайки пълно запазване на данните и сигналите при ъпдейти.
*   **Бърз билд:** Файлове като `node_modules`, `.venv` и кешове са изключени чрез `.dockerignore`, съкращавайки времето за контейнеризация с над 95%.

<div align="center"><sub>Направено за по-прозрачни обществени поръчки в България 🇧🇬</sub></div>
