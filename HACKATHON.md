# ZaraHack 2026 - Project Submission (HACKATHON.md)

Welcome, and nice work getting this far!

This file is your project's "story card."

---

## 1. Team

*Who are you, and where does everything live?*
**(helps your score on: Team Work)**

- **Team name: MU3**
- **Members (name — what each person did):**
    Ozan Serbest - backend and frontend
    Andrian Atanasov - backend, frontend, bug fixer
    Alexsandra Daneva - frontend
    Simeon Indzhov - quality assessment, presenter
- **How did you split the tasks? Who did what?:**
  Ozan focused entirely on backend architecture and data processing.
  Alexsandra took the lead in building the frontend interface and visual components.
  Adrian acted as a full-stack bridge, contributing to both backend logic and frontend development while taking charge of debugging and bug fixing.
  Simeon took on the QA (Quality Assessment) role, rigorously testing the application for defects and ensuring the system ran smoothly.

---

## 2. What Problem Are You Solving?

*What's the problem, and who actually has it?*
**(helps your score on: Idea & Data Integrity)**
Public renovations in Bulgaria are systematically delayed—projects promised to take 3 months often end up taking 9 or more. Every Bulgarian citizen, driver, pedestrian, or city resident feels this problem daily when a renovation outside their apartment building or on a key road disrupts their life. Citizens lack transparency and a realistic expectation of when a project will actually be finished, while municipalities and contractors rarely face public accountability for these delays.

---

## 3. How Do You Solve It? (in plain language)

*Explain it to a normal person (grandpa style) — no tech words allowed.*
**(helps your score on: Presentation)**
We created a digital map of Bulgaria called "Dokoga?" (Until When?), where anyone can find the renovation project on their street, park, or road. Instead of blindly trusting TV promises, our smart computer model checks the history of the contractor and the municipality to tell you when the renovation will actually finish and by how many days it will be delayed. You can also chat with our Bulgarian-speaking AI assistant, who will instantly explain why a specific project is lagging behind and point out the most problematic renovations nearby. Furthermore, if a project is heavily overdue, our app allows you to easily draft and submit an official, legally-compliant complaint (signal) directly to the mayor's office over email with just a single click.

---

## 4. What Technologies Do You Use?

*List the building blocks: languages, frameworks, services, libraries, APIs.*
**(helps your score on: Tech Execution)**

Language(s): Python, TypeScript, SQL
Frontend: React, Vite, react-router, Leaflet (react-leaflet), Motion (анимации), Phosphor (иконки)
Backend: FastAPI, SQLite, google-genai SDK, Uvicorn
Data tools / libraries: pandas, LightGBM (LGBMClassifier & LGBMRegressor), scikit-learn, CairoSVG
APIs / services: Google GenAI API (gemini-2.0-flash), Fallbacks (gemma-4-31b-it, gemma-4-26b-a4b-it)
Hosting / deployment: Local/Self-hosted (FastAPI на порт 8001/8000)

---

## 5. How Do You Wire Them Together?

*The architecture — how do the pieces talk to each other?*
**(helps your score on: Tech Execution)**
[Raw OCDS JSON packages from egov.bg] -> [pandas processing and category selection] -> [Training LightGBM models] -> [Export to GeoJSON & SQLite] -> [FastAPI Backend with LLM Grounding layer] -> [Interactive React Frontend with Leaflet map].

---

## 6. Do You Train an ML Model?

*ML is a bonus, not a must — be honest either way.*
**(helps your score on: AI Fluency)**

What does the model predict or do? The first model (LGBMClassifier) predicts the risk of delay (in %), while the second (LGBMRegressor) forecasts the expected delay in number of days.
What base model / starting point do you use? The models are built from scratch using the lightgbm library.
How do you train it? It was trained on 4,471 contracts from the CAIS EOP platform. The features used include: value, duration, spending intensity (value per day), start month (seasonality), region, category, sector, and engineered features: smoothed historical buyer delay rate and smoothed historical supplier delay rate (using Laplace smoothing).
How do you check the prediction is actually accurate? We used 5-fold Cross-Validation. The classifier achieved an outstanding **ROC-AUC of 0.982** and a **PR-AUC of 0.833** (nearly 12x above the baseline of 0.065!). The regressor is trained using a robust **L1 loss (regression_l1)** on log-transformed targets, which handles extreme outliers perfectly, yielding a **Median Absolute Error (MedAE) of 24.9 days** (accurate to within less than a single month!).

---

## 7. What Datasets Do You Use, and How?

*Real, public data is the heart of this hackathon — show yours off.*
**(helps your score on: Idea & Data Integrity)**
Source + link: data.egov.bg (Public Procurement Agency)
Licence: CC0 (Public Domain)
Why this data: It contains full, structured information regarding planned timelines (startDate/endDate) and amendments, which allows us to define the actual overrun/delay.
What we did to it: We assembled 11 bi-weekly packages (25,980 releases, 18,206 unique contracts based on ocid). We used the amendments to calculate our target label, overrun_days. Through a custom filter (sectors.py) and a strict category filter (category == "works"), we isolated exactly 251 public-facing, citizen-centric physical renovations (roads, water/sewerage, parks, public lighting), cleanly excluding pure supplies/goods delivery contracts to keep the map highly accurate and relevant.

---

## 8. How Will the Platform Scale?

*Imagine 10,000 people show up tomorrow — what happens?*
**(helps your score on: Adaptive Sustainability)**
If 10,000 people visit the platform tomorrow, the interactive map will hold up without any issues since it runs using a lightweight, static GeoJSON file on the client side. The primary bottleneck would be the load on the AI chat and the predictor. Because we use SQLite and external LLM APIs, we would first hit the rate limits of Google GenAI. To handle this, we added a local rate limit and fallback logic across multiple models.
Furthermore, we generalized our crawler (`scrape_eop.py`) to accept any buyer ID. We can now scrape and display active public tenders for **all major municipalities in Bulgaria** (Sofia, Plovdiv, Varna, Burgas, Stara Zagora) simultaneously, which are dynamically geocoded and integrated onto the map on the fly.

---

## 9. What Challenges Did You Face?

*Every project hits walls — tell us about yours and how you climbed over.*
**(helps your score on: Tech Execution)**
Our biggest challenge was calculating the risk scoring accurately, as the early versions were yielding imprecise results. We solved this by implementing smoothed historical delay rates as features for the classifier and tuning L1 MAE loss for the duration regressor. 
Additionally, parsing and mapping the geolocation data from the raw contracts was inaccurate, placing projects in incorrect coordinates or bunching them up heavily in city centers. We resolved this by building a custom coordinates cache (`geocoding_cache.json`) for all 328 unique localities in Bulgaria and implementing a **Golden-Angle Spiral Dispersion** algorithm (based on Fibonacci spirals) to spread municipal projects organically across different neighborhoods instead of clustering them on top of the town hall.

---

## 10. Did You Check What Already Exists?

*Most teams skip this — so doing it is an easy way to stand out. ⭐*
**(helps your score on: Idea & Data Integrity)**
Yes, official platforms like CAIS EOP and open data portals do exist, but they are built for experts and lawyers—searching through them is complex, and the data is raw and unanalyzed. Projects like "Spasi Sofia" or reporting platforms display ongoing current issues but lack predictive capabilities. Our solution, "Dokoga?", is unique because it combines the power of machine learning (to predict the future) with an exceptionally easy, citizen-friendly interface, an automated mailto legal signal generator under АПК, and a chat assistant that speaks accessible language.

---

## 11. Where Did You Use AI, and What's Not Yours?

*Be open about your helpers — the rules require disclosing AI and third-party work.*
**(helps your score on: AI Fluency)**

- **AI tools used (and for what):** We used Claude 3.5 Sonnet to generate the baseline React code for the Leaflet map, ChatGPT for quickly rewriting complex SQL regular expressions, and Copilot for code autocomplete in our editor.
- **Third-party code / templates / tutorials you reused:** We utilized the official documentations for react-leaflet and FastAPI. For the map visualization, we loaded base tiles from OpenStreetMap.
- **Their licences:** MIT (for the React/FastAPI libraries), Open Data Commons Open Database License (ODbL) for OpenStreetMap.

---

## 12. Honesty Box

*The most underrated section. Tell us what's NOT done.*
**(helps your score on: Tech Execution)**

Not finished yet & Looks done but isn't:
* **Smaller Municipalities Scraping:** While we successfully parameterized our Playwright scraper to dynamically crawl any of the 265 municipalities in Bulgaria and have fully deployed active map layers for Sofia, Varna, Burgas, and Stara Zagora, we haven't automated the scheduled cron-scraping for smaller rural municipalities yet (which must currently be executed manually via CLI).
* **E-Delivery (ССЕВ) Direct Upload:** Our "Submit Signal" button drafts and populates a perfect formal PDF and email, but we haven't integrated a direct API upload to the official government e-Delivery system (ССЕВ) yet, meaning citizens still need to click "Send" from their email clients or upload the PDF manually to ССЕВ.
