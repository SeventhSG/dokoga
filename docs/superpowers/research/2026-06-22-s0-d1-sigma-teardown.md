# S0 · D1 — SIGMA Teardown

**Date:** 2026-06-22
**Source:** `github.com/midt-bg/sigma` @ shallow clone (read of schema, ingest, ETL docs, queries)
**Purpose:** Document SIGMA's data model + ETL + risk plans → what we reuse vs. do differently, and how it constrains our methodology.

---

## TL;DR — two findings that reshape the project

1. **There is no per-bidder bid data anywhere in the source.** SIGMA deliberately has **no `bids` table**: *"No available source (admin export or OCDS) publishes per-bidder offer lines — only an aggregate COUNT (`contracts.bids_received`) and OCDS bid statistics (SME/electronic/foreign counts)."* We get **the winner + how many bid**, never **who** the losing bidders were.
   → Our **flag #3 ("competing bidders in the same tender share an owner/address")** is **infeasible from open data as designed** — you can't compare owners of bidders you can't enumerate. This was billed as the make-or-break network flag and the juror's central thesis. It must be **re-scoped** (see §6).

2. **Company ownership (Търговски регистър) is NOT integrated even in SIGMA.** Their ETL doc states the Търговски регистър loader is *"друг dataset за собственост на компании и е извън този pipeline."* So the ownership graph the whole corruption thesis depends on is **greenfield** — nobody has wired it to procurement yet. Confirms S0 risk #1: it's the hardest, most novel part, and we'd be first.

Everything else is good news: SIGMA has already solved a lot of the boring-but-hard data engineering, and the structured fields support **several** strong flags without bid-level data.

---

## 1. What SIGMA is

- **Scale:** **193,019 contracts**, ≈**€51.6 bn**, 2020–2026. Daily refresh.
- **Stack:** TypeScript monorepo (pnpm/turbo) on **Cloudflare** (React Router v7 SSR on Workers, **D1/SQLite**, Durable Objects, Workflows). MIT.
- **Scope today:** read-only explorer — institutions → contracts → companies, monetary flows, search, CSV/JSON export. **Risk scoring = roadmap only, unimplemented** (README mentions green/yellow/red; `fix/risk-score-rounding` appears as an example branch name but no risk code exists in the tree).
- **Honesty posture (matches ours):** a **methodology page** publishes live field **coverage ratios** (bids/eu/duration/lot) and a "known-gaps table." They surface data quality rather than hide it — e.g. `value_flag`/`date_flag` verdicts, and a documented "3 suspect rows on 193k" cleanup.

## 2. Source of truth (differs from dokoga!)

- **Only `storage.eop.bg`** daily open-data emission. Each day = a bucket with **4 JSON files**: flat *contracts*, flat *tenders*, flat *annexes*, **+ a full OCDS 1.1 package** (enrichment: parties addresses/contacts, award suppliers, lot values).
- **`data.egov.bg` OCDS feeds are DEPRECATED** by SIGMA. ⚠️ **dokoga's `scrape_eop.py` + OCDS pull uses exactly the deprecated path** — we should migrate to the `storage.eop.bg` 4-file emission for the national system.
- Pre-ЦАИС-ЕОП (ROP) legacy contracts are deliberately **not backfilled** (thin rows, poor procedure fields). Our corpus realistically starts **2020**.

## 3. Data model (D1/SQLite) — the grain we'd inherit

| Table | Grain / key | Fields most relevant to risk |
|---|---|---|
| `authorities` | buyer, `auth:<ЕИК>` | name, ЕИК, region/NUTS, settlement, ЕКАТТЕ, municipality, address, type, **contact email/phone** |
| `tenders` | procedure, `t:<УНП>` | CPV+desc, **estimated_value**, procedure_type, contract_kind (Доставки/Услуги/Строителство), num_lots, status, **published_at**, **deadline_at**, legal_basis, **award_criteria**, notice_type, place_of_performance, start/end/duration, eu_programme, green/social/innovation/eauction/**cancelled** |
| `lots` | обособена позиция | estimated_value, value_amount |
| `bidders` | **winner only**, `eik:<ЕИК>` or `name:<norm>` | ЕИК (normalized+valid flag), **is_consortium**, kind, ownership_kind (state/municipal/mixed allowlist), legal_form, NUTS, settlement, address, contacts |
| `contracts` | award, `c:<…>` | winner `bidder_id`, **amount_eur (canonical, safe-to-sum)**, signing_value, **current_value**, **annex_count**, **bids_received**, bids_sme, **bids_rejected**, bids_non_eea, winner_size (micro/small/medium/large), contractor_country, **subcontractor_eik/name/value**, contract_kind, duration_days, framework/accelerated/strategic flags, **value_flag/date_flag** |
| `amendments` | anex history | value_before/after/**delta**, currency, published_at, description |
| `parties` | OCDS party projection, ЕИК-keyed | address, NUTS, contacts — enrichment by ЕИК |
| rollups | `company_totals`, `authority_totals`, `flow_pairs` (buyer→winner), `sector_totals` | precomputed aggregates |
| reference | `fx_rates` (ECB), `nuts_regions`, `data_freshness` | BGN→EUR @1.95583 + FX for foreign currencies |

**Identity model (reusable, well-designed):** EIK-first keying; invalid/missing-EIK winners fall back to normalized name (avoids collapsing distinct shell/no-EIK firms into one node); consortium detection (ДЗЗД/ОБЕДИНЕНИЕ/КОНСОРЦИУМ, member lists in `raw_ocds_award_suppliers`); parties keyed `eik:<eik>:ocid:…` so reused OCDS party slots never collide.

## 4. Hard problems SIGMA already solved (reuse conceptually)

- **Canonical EUR + FX** across the BGN→EUR transition (2020–25 BGN, 2026 EUR, plus USD/CHF/GBP/…). Per-row FX provenance.
- **Value-quality cleaning** (`value_flag`: ok/review/value_suspect/annex_suspect) — repair-over-discard, audited. Directly relevant to our **price-anomaly flag** (their thresholds are a starting baseline).
- **Date-quality** (`date_flag = signed_after_publication`) — *already a soft red-flag-shaped signal.*
- **Synthetic tenders** for contracts whose УНП lacks a parent procedure (FK integrity).
- **Idempotent re-import**, work-DB/served-DB split, composite surrogate keys.

## 5. What SIGMA does NOT have (our build burden)

- ❌ Per-bidder bids (only winner + count) — see TL;DR #1.
- ❌ Company **ownership / managers** (Търговски регистър) — out of their pipeline.
- ❌ **Beneficial owners** (РДСИЦ).
- ❌ **КЗК** appeal/annulment decisions (our ML composite-label half + an annulment flag).
- ❌ **Line items / КСС** (bills of quantities) — no per-item unit prices ("the bench").
- ❌ Any risk/red-flag scoring.

## 6. Impact on our methodology (the 4 hypothesized flags)

| Flag (from spec) | Verdict after D1 | Notes |
|---|---|---|
| **#1 Single / low bidding** | ✅ **Feasible** | `contracts.bids_received` exists (coverage measured on their methodology page — D2 must read the real %). Strongest, cleanest flag. |
| **#2 Short tender window** | ✅ **Feasible** | `tenders.published_at` + `deadline_at`. D2 to check coverage. |
| **#3 Shared owner among competing bidders** | ❌ **Infeasible as designed** | No losing-bidder data. **Re-scope** to ownership links we *can* compute: winner↔buyer, winner↔subcontractor, repeat winner–buyer concentration, and **cross-tender winner clusters** sharing owners/addresses. Requires the Търговски регистър integration (greenfield). |
| **#4 Price anomaly** | ⚠️ **Partial** | Normalized/same-CPV outlier benchmarking feasible from `amount_eur`+CPV+kind (reuse SIGMA's value-quality thresholds). Literal line-item "bench" still needs КСС PDFs — SIGMA has none → the КСС spike (D4) is the only way to know. |

**New flags D1 surfaced (add as hypotheses in D3):** high **annex/modification** rate or value_delta (data present); **subcontracting** anomalies (subcontractor_eik/value present); **signed-before/at-publication** date anomaly (their `date_flag`); **cancelled-then-reissued** procedures; **bids_rejected** patterns (legit bidders disqualified).

## 7. Reuse vs. differ

**Reuse conceptually:** EUR/FX canonicalization, value-quality flag thresholds, EIK-first identity + consortium handling, synthetic-tender rule, the daily 4-file `storage.eop.bg` emission, the "publish coverage + known-gaps" honesty pattern.

**Do differently / add:**
- **Stack:** spec defaults to Python + Postgres (recursive ownership queries, LightGBM). SIGMA is TS + Cloudflare D1. We are independent → keep Postgres, but **mirror their schema semantics** so we could ingest their exports or cross-check. (Open question for S1: is it cheaper to *consume SIGMA's CSV/JSON exports* as our procurement layer than to re-run the EOP ETL? Their data is public + MIT.)
- **Build the two greenfield layers** they lack: **Търговски регистър ownership graph** and **КЗК decisions**.
- **Add the scoring layer** entirely (red-flags + ML + LLM-judge).

## 8. Feeds into the rest of S0

- **D2 (profiling)** must now: (a) read SIGMA's **actual coverage %** for `bids_received` / `deadline_at` / `subcontractor_eik` (their methodology endpoint or a sample import), and (b) **prove Търговски регистър ownership is fetchable + joinable by ЕИК** — this is the gating unknown for the entire network thesis.
- **D3 (catalogue)** starts from the revised flag set in §6, not the original four.
- **D4 (verdict + КСС spike)** decides whether to consume SIGMA exports vs. own ETL, and whether line-item extraction is viable.
