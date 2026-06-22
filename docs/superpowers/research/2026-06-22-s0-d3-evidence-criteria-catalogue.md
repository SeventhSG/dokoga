# S0 · D3 — Evidence / Criteria Catalogue

**Date:** 2026-06-22
**Basis:** D1 (SIGMA teardown) + D2 (live source profiling) + procurement-integrity literature (Fazekas / Government Transparency Institute CRI; OCP red-flag frameworks).
**Schema:** per S0 spec §6. `availability`/`computability` are grounded in D2 evidence, not assumption.

> **Principle:** every flag emits **traceable evidence**, never a bare boolean, and is phrased as a **factual observation**, never an accusation. A flag is *risk signal*, not a verdict. The composite index is transparent and reproducible; the ML and LLM layers (S4/S5) sit on top, they do not define the flags.

Legend — **Comp.** (computability): ✅ now · ⚠️ partial/needs work · ❌ infeasible from open data.
**Wt** = proposed starting weight for the integrity index (refined in S3; 0 = surfaced but unweighted).

## A. Competition / bidding

| code | observation | data needed | Avail. | Comp. | evidence emitted | false-positive risk & mitigation | Wt |
|---|---|---|---|---|---|---|---|
| `single_bidding` | exactly one offer received | `offersCount` | 100% | ✅ | offersCount, procedure, CPV, value | legit for niche/monopoly goods → weight by CPV competitiveness norm | **High** |
| `low_competition` | ≤2 offers | `offersCount` | 100% | ✅ | offersCount | small-market sectors → CPV-relative | Med |
| `high_disqualification` | large share of offers disqualified, winner survives | `offersCount`,`disqualifiedOffersCount` | 100% | ✅ | counts + ratio | legit non-compliance → threshold + show raw | Med |

## B. Timing

| code | observation | data needed | Avail. | Comp. | evidence | FP risk & mitigation | Wt |
|---|---|---|---|---|---|---|---|
| `short_tender_window` | days(publish→deadline) below legal/percentile floor | `publicationDate`,`submissionDeadline` | 100% | ✅ | both dates + gap + CPV-percentile | accelerated procedures are legal → cross-check `isAcceleratedProcedure`, show legal minimum | **High** |
| `signed_before_publication` | contract signed ≤ publication date | `contractDate`,`publicationDate` | 80/100% | ✅ | both dates | data-entry error (SIGMA's own `date_flag`) → label "data-quality OR irregular", low weight | Low |

## C. Procedure type

| code | observation | data needed | Avail. | Comp. | evidence | FP risk & mitigation | Wt |
|---|---|---|---|---|---|---|---|
| `negotiation_without_notice` | high-discretion procedure type / direct award | `procedureType`,`awardMethod`,`legalBasis` | 97/100% | ✅ | procedure type + legal basis | many legitimate uses → weight by value + repetition | Med |
| `cancelled_then_reissued` | tender cancelled then near-identical reissued (same buyer/CPV/value) | `isCancelled`,`uniqueProcurementNumber`,CPV,value | 100% | ⚠️ | both УНП, dates, similarity | legit re-tendering → require tight similarity + short gap | Med |

## D. Value / price

| code | observation | data needed | Avail. | Comp. | evidence | FP risk & mitigation | Wt |
|---|---|---|---|---|---|---|---|
| `price_anomaly_cpv` | contract value far above peer distribution for same CPV (normalized, value-quality-filtered) | `contractValue`/`estimatedValue`,`tenderMainCpv` | 96–100% | ✅ | value, CPV median/p90, z-score, peer n | heterogeneous CPV buckets → require min peer n; reuse SIGMA `value_flag` cleaning | **High** |
| `estimate_to_contract_gap` | contract value ≫ procedure estimate | `estimatedValue`,`contractValue` | 96% | ✅ | both values + ratio | framework/unit-price call-offs distort → adopt SIGMA's procEst rule | Med |
| `annex_value_inflation` | post-signing annexes inflate value materially | annexes feed `value_before/after/delta`,`annex_count` | feed exists | ✅ | each annex delta + cumulative | legit scope change → show deltas, weight by cumulative % | **High** |
| `line_item_overpricing` ("bench") | same unit item priced far above peers (€5000 vs €500 bench) | per-item КСС unit prices | ❌ (D2/D4) | ❌ | — | n/a | 0 (deferred) |

## E. Network / ownership  ← the differentiator (D2-validated)

| code | observation | data needed | Avail. | Comp. | evidence | FP risk & mitigation | Wt |
|---|---|---|---|---|---|---|---|
| `winner_buyer_link` | winner's owner/manager is/links to a person tied to the buyer | TR persons (hash) + buyer/winner ЕИК | CC0 | ⚠️ | shared person hash, both roles, both ЕИК | buyer-side person identification is hard (authorities ≠ TR companies) → conservative, evidence-gated | Med |
| `shared_owner_cross_tenders` | distinct winning firms share an owner/manager (hash) across tenders | TR person hash ↔ winner ЕИК | CC0 | ✅ | shared hash, the firms, the tenders | common for legit groups → factual "same owner", not "collusion"; weight by buyer overlap | **High** |
| `subcontractor_link` | subcontractor shares owner with the winner (self-subcontracting) | OCDS subcontractor ЕИК + TR | partial | ⚠️ | shared hash, winner+sub ЕИК | legit group structures → factual statement | Med |
| `beneficial_owner_chain` | ownership chain to offshore/concentrated beneficial owner | TR offshore-control / БО structures | CC0 | ⚠️ | the chain (company→…→BO) | chains sparse/complex → show chain, no inference | Med |
| `new_company_wins_big` | recently incorporated firm wins large contract | TR incorporation date + contract value | CC0 | ✅ | incorporation date, value, days-since | legit new firms → weight by value percentile | Med |
| `in_tender_bidder_collusion` | competing **bidders** in one tender share owners | per-bidder bid identities | ❌ | ❌ | — | no losing-bidder data (D1); КЗК probe = only partial route | 0 (deferred) |

## F. Concentration / dependency

| code | observation | data needed | Avail. | Comp. | evidence | FP risk & mitigation | Wt |
|---|---|---|---|---|---|---|---|
| `buyer_supplier_concentration` | one supplier wins a dominant share of a buyer's spend | contracts (buyer ЕИК, winner ЕИК, value) | 80–100% | ✅ | share %, € total, n contracts, period | small/specialized markets → require min volume; factual | **High** |
| `repeat_winner_streak` | same winner wins a buyer's tenders repeatedly | same | 80–100% | ✅ | win sequence, win-rate | legit framework agreements → exclude/flag frameworks | Med |

## Entity dossier (first-class output, not a flag)

Per company/person (hash), an **evidence-linked ledger**, every line traceable to source: contracts won (count, € via SIGMA EUR-canon), buyers, single-bid rate, annex/modification rate, average estimate-to-contract gap, ownership/management positions and co-owned companies (via hash), beneficial-owner chain, incorporation date, КЗК history (deferred), and which flags they participate in. **Factual; never a label.**

## Summary — what S0 establishes as buildable

- **Strong, fully-feasible flags now:** `single_bidding`, `short_tender_window`, `price_anomaly_cpv`, `annex_value_inflation`, `shared_owner_cross_tenders`, `buyer_supplier_concentration`.
- **Feasible with modest work:** the rest of A–F marked ✅/⚠️.
- **Deferred (open-data wall):** `line_item_overpricing` (КСС spike negative — see D4), `in_tender_bidder_collusion` (no losing-bidder data; КЗК probe later).
- The **ownership network** — the differentiator vs. SIGMA — is anchored by the **stable person hash** (D2), making `shared_owner_cross_tenders` a high-confidence, defensible flag.
