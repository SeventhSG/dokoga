# S0 · D4 — Feasibility Verdict, КСС Spike & Recommended S1 Scope

**Date:** 2026-06-22
**Inputs:** D1 (SIGMA teardown), D2 (source profiling), D3 (criteria catalogue).
**Purpose:** Close S0 with a go/no-go per flag, the КСС spike result, the build-vs-consume call, and a concrete S1 build-slice recommendation.

---

## 1. Headline verdict: GO

The project is feasible on **CC0 open data**, and its differentiator vs. SIGMA — the **ownership network** — is validated, not assumed (D2: ЕИК join + stable person hash, cross-company linkage proven). Several strong red flags are computable nationwide today. The one capability that hits an open-data wall (line-item "bench" pricing) is cleanly isolable and deferrable.

## 2. КСС / line-item ("bench") spike — verdict: DEFER (hard, dedicated sub-project)

Time-boxed probe of every plausible open route:
- **OCDS daily file:** 610 items across 271 releases — **0 carry quantity/unit**. No line-item prices.
- **Open-data emission documents:** **0 document/attachment URLs** in the EOP buckets or OCDS package.
- **Where КСС actually lives:** behind the `app.eop.bg` **SPA** (HTML shell only; no open JSON API at guessed paths; `api.eop.bg` doesn't resolve). Reaching a bill-of-quantities means reverse-engineering the SPA's XHR API, navigating per-procedure documentation, downloading heterogeneous PDF/XLS КСС files, and parsing buyer-specific templates.

**Conclusion:** literal bench-vs-bench is **not feasible from open data** and would be a substantial, uncertain sub-project (scraping + document AI). **Defer.** Ship **`price_anomaly_cpv`** (normalized, same-CPV outlier) as the price signal now — it catches "this cost 4× the CPV-peer median" without line items.

## 3. Per-flag go/no-go (from D3)

**Build now (high confidence, strong signal):**
`single_bidding` · `short_tender_window` · `price_anomaly_cpv` · `annex_value_inflation` · `shared_owner_cross_tenders` · `buyer_supplier_concentration`.

**Build with modest work:**
`low_competition` · `high_disqualification` · `negotiation_without_notice` · `cancelled_then_reissued` · `estimate_to_contract_gap` · `signed_before_publication` · `subcontractor_link` · `beneficial_owner_chain` · `new_company_wins_big` · `repeat_winner_streak` · `winner_buyer_link`.

**Deferred (open-data wall):**
`line_item_overpricing` (КСС spike negative) · `in_tender_bidder_collusion` (no losing-bidder data; КЗК probe is the only partial route, scheduled later).

## 4. Build vs. consume (SIGMA) — recommendation: HYBRID

SIGMA's served data is winner-only, no bids table, no ownership, no КЗК — i.e. it provides **none** of our two greenfield layers. But it has solved EUR/FX, value-quality cleaning, EIK identity, consortium handling on 193k contracts (MIT).

**Recommendation:** **mirror SIGMA's procurement schema semantics** and either consume their exports or re-run the (now-understood) `storage.eop.bg` ETL — defer that micro-decision to S1 kickoff — and **build the ownership + КЗК layers ourselves** (no one has them). Do **not** take a hard dependency on SIGMA's runtime; treat their repo as reference + optional data accelerant.

## 5. Recommended S1 build-slice scope

A thin **vertical slice that proves the differentiator end-to-end** on a real subset:

**Data (Postgres):**
- Procurement: ingest the flat EOP feed (contracts+tenders+annexes) for a **bounded subset** — recommend **one CPV-rich, civic-relevant sector** (e.g. road/construction works) across a recent window, mirroring SIGMA's cleaning (EUR canon, value_flag).
- Ownership: accumulate enough Търговски регистър daily deltas to cover the **winners + buyers in that subset**; build `organization(eik)`, `person(hash)`, `role(eik, person_hash, type)`.

**Compute (6 flags) + 1 network output:**
1. `single_bidding`, 2. `short_tender_window`, 3. `price_anomaly_cpv`, 4. `annex_value_inflation`, 5. `buyer_supplier_concentration`, 6. **`shared_owner_cross_tenders`** (the make-or-break network flag — exercises the TR join + person-hash graph).
- Each emits stored, traceable evidence; combine into a **transparent Contract Integrity Index** (deterministic, no ML yet).
- Produce one **entity dossier** for a winner that participates in a network link, fully source-linked.

**Success criterion:** on the subset, generate ranked contracts/entities with evidence, and **manually verify a handful** (single-bid, a price outlier, and a shared-owner link) against the source registers. If `shared_owner_cross_tenders` produces a verifiable real link, the project's core thesis is proven in code.

**Explicitly out of S1:** ML (S4), LLM-judge (S5), UI (S6), national completeness, КЗК, line-item pricing, beneficial-owner chains (start with direct owners/managers).

## 6. Sequenced roadmap after S1
S2 deepen ownership graph (beneficial-owner chains, addresses, corporate-shareholder walking) → S3 full red-flag engine + index weighting → **КЗК spike** (losing-bidder recovery + ML adverse-outcome label) → S4 supervised ML blend (leak-free) → S5 LLM-judge synthesis (retrieve→narrate) → S6 public UI.

## 7. S0 done
D1–D4 complete. Criteria catalogue annotated (D3 §A–F). КСС spike verdict recorded (§2). S1 scope recommended (§5). Ready for S1 brainstorming on user approval.
