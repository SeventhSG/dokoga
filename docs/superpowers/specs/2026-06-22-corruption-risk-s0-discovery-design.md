# S0 — Data & Evidence Discovery (Design)

**Date:** 2026-06-22
**Status:** Approved (brainstorm) → pending spec review
**Project:** National procurement integrity / corruption-risk system (working title)
**Sub-project:** S0 of a larger decomposition (see *Roadmap context*)

---

## 1. Why this exists

A juror at ZaraHack proposed continuing the dokoga work into a national system that
scores **corruption risk** across all Bulgarian public procurement. Corruption risk has
**no ground-truth label** and naming real companies carries legal exposure, so the
methodology must be honest, reproducible, and evidence-linked from day one — the same
lesson dokoga learned when a data-leak inflated its model to a fake 0.98.

We deliberately **do not** pre-decide the red-flag set top-down. S0 first **analyzes the
available data and prior art (SIGMA), then derives our own evidence criteria bottom-up**.
Its deliverable — a documented criteria catalogue — drives the later build slice with
evidence instead of assumptions.

## 2. Roadmap context (the full decomposition)

The overall system is **not** one project. S0 is the discovery phase that precedes build.

| # | Sub-project | Depends on |
|---|---|---|
| **S0** | **Data & Evidence Discovery** (this spec) | — |
| S1 | Data foundation + entity resolution (build slice) | S0 |
| S2 | Ownership / network graph (computable links only) | S1 |
| S3 | Red-flag indicator engine → Contract Integrity Risk Index | S1, S2 |
| S4 | Supervised ML — composite adverse-outcome model (leak-free) | S1, S3 |
| S5 | Risk synthesis + LLM-judge explanation (retrieve→narrate, never computes) | S2–S4 |
| S6 | Public UI — search, entity/contract pages, risk + evidence + network viz | S5 |

**Decided design invariants (apply to all sub-projects):**
- **Independent system**, not built on SIGMA's code; reuses the same raw sources.
- **Score = (red-flag integrity index) ⊕ (ML: P[composite adverse outcome]) blended ≈70/30**,
  versioned and leak-free benchmarked. **LLM explains, never computes the number.**
- **Composite adverse outcome** (the ML label) = procedure *challenged/annulled at КЗК*
  **OR** contract *materially modified* (price/deadline anex).
- **Network = computable links only** (shared owners/managers/addresses across bidders,
  repeat winner–buyer pairs, subcontractor chains). **No relatives inference.**
- **Per-entity dossier** is a first-class output: factual, source-linked ledger — never editorial.
- Stack default: Python ETL + LightGBM, FastAPI, React, **Postgres** (national scale + recursive
  ownership queries). Confirm at S1.

## 3. Goal & success criteria

**Goal:** Determine empirically *what evidence we can compute* from Bulgarian open data, and
design our own criteria catalogue — before any scoring is built.

**Success = all four deliverables produced and reviewed:**
1. SIGMA teardown documented.
2. Source profiling documented with real samples and coverage numbers.
3. **Evidence/criteria catalogue** completed (every candidate flag annotated, see §6).
4. Feasibility verdict written, recommending the S1 build-slice scope.

S0 is **analysis + a written methodology doc**. Code is limited to throwaway sampling/profiling
scripts and one time-boxed PDF spike — **no production pipeline, no DB schema commitment, no UI.**

## 4. Deliverables

### D1 — SIGMA teardown
Study `github.com/midt-bg/sigma` (open, MIT): data model, DB migrations/schema, exposed fields,
ETL approach, and their roadmap **risk-index** plans (green/yellow/red + owner/affiliate linking,
currently unimplemented). Output: a short doc — *what to reuse conceptually, what to do
differently, and where their data model already answers our join/coverage questions.*

### D2 — Source profiling
Pull **real samples** (not exhaustive) from each source and document every field, its coverage %,
quality issues, and join keys:
- **Procurement** — ЦАИС ЕОП via `storage.eop.bg` emission + `data.egov.bg` OCDS
  (reuse/extend dokoga's `scrape_eop.py`). Capture: procedures, bids/bidders, awards, contracts,
  anexes, CPV, dates, values, tenderer counts, subcontractors.
- **Companies/owners** — Търговски регистър (Registry Agency): companies, owners, managers,
  addresses, EIK as join key. **Explicitly verify ownership data is accessible at useful
  granularity — this is risk #1.**
- **КЗК decisions** — `cpc.bg` decisions register: appeals/annulments (for the ML label later).
  Profile availability only; ingestion deferred.
- **КСС / bill of quantities** — locate sample attachment PDFs; assess format variability.

### D3 — Evidence/criteria catalogue ⭐ (the key output)
A documented table of candidate red flags derived from D1 + D2 + literature
(Fazekas / Government Transparency Institute CRI). **Each entry annotated with the schema in §6.**
The following carry forward from brainstorming as **hypotheses to validate** (not commitments):
1. Single / low bidding
2. Short tender window (publication → submission deadline)
3. **Shared owner / manager / address between competing bidders** (network; make-or-break)
4. **Price anomaly** — normalized benchmarking (€/km, €/m², same-CPV value outliers) from
   structured data; literal line-item (bench-vs-bench) pending the КСС spike
…plus any additional flags the data reveals during profiling.

### D4 — Feasibility verdict
Per candidate flag: **buildable now / needs extraction work / infeasible.** Concludes with a
recommended **S1 build-slice scope** (which flags + which entities) grounded in D2/D3 evidence.

## 5. The КСС spike (time-boxed)
Separate, bounded experiment: attempt to parse a handful of КСС / bill-of-quantities PDFs to learn
whether true **line-item unit prices** (the €500 vs €5000 bench) are extractable. **Output is a
yes/partial/no verdict + difficulty estimate**, feeding D4 — *not* a parsing pipeline. Time-box it;
if it overruns, record "unknown — needs dedicated sub-project" and stop.

## 6. Criteria-catalogue entry schema (D3)
Each candidate flag is one row:

| Field | Meaning |
|---|---|
| `code` | short id, e.g. `single_bidding` |
| `description` | what the flag asserts, in plain language |
| `rationale` | why it indicates integrity risk (cite literature/SIGMA where relevant) |
| `data_needed` | exact fields/sources required |
| `availability` | available / partial / PDF-only / unavailable (from D2 evidence) |
| `computability` | now / needs-extraction / infeasible |
| `evidence_emitted` | what traceable evidence the flag would store (never just a boolean) |
| `false_positive_risk` | known ways it misfires + mitigation (e.g. conservative person-matching) |
| `defensibility` | legal/ethical framing — factual statement vs. accusation |
| `proposed_weight` | rough contribution to the integrity index (refined in S3) |

## 7. Risks
1. **Търговски регистър ownership access** (gates flag #3 and the whole network thesis) — verify in D2 first.
2. **КСС PDFs unparseable** (gates literal price benchmarking) — the spike answers this.
3. **Source instability / rate limits** on ЦАИС ЕОП / cpc.bg — note, don't solve in S0.
4. **Scope creep** — S0 must resist building the pipeline; deliverables are documents + verdicts.

## 8. Out of scope for S0
Production ETL, committed DB schema, the network graph build, the ML model, the LLM-judge,
the UI, national-completeness ingest, beneficial-owner integration, КЗК ingestion. All follow in
S1+ once S0's evidence is in.

## 9. Definition of done
D1–D4 written and committed; the criteria catalogue has every candidate flag annotated per §6;
the КСС spike has a recorded verdict; D4 recommends a concrete S1 build-slice scope. Reviewed and
approved by the user before S1 brainstorming begins.
