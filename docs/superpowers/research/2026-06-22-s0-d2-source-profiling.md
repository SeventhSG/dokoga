# S0 · D2 — Source Profiling

**Date:** 2026-06-22
**Method:** Live probing of real endpoints (curl + Python schema profiling on actual samples).
**Status:** Procurement + ownership = profiled & confirmed. КЗК + SIGMA-export = reachability confirmed, deep profiling deferred (per decisions: КЗК probe later, build-vs-consume in D4).

---

## TL;DR — the gating unknown resolved POSITIVE

**The ownership graph is buildable from CC0 open data, and it links people across companies without exposing any personal data.** The Търговски регистър daily open dataset contains owners, managers, sole owners, partners, corporate shareholders and beneficial-owner/offshore-control chains, keyed by company **ЕИК (`UIC`)** — which joins directly to the procurement feed. Bulgarian persons' ЕГН is **pseudonymized to a stable SHA-256 hash**, so the *same* person is linkable across companies (proven empirically) while we never see a real ЕГН.

This is exactly the layer SIGMA does not have. The juror's network thesis — minus in-tender bidder collusion (no losing-bidder data, see D1) — is **feasible**.

---

## 1. Endpoint reachability (all live, 2026-06-22)

| Source | Result |
|---|---|
| `storage.eop.bg/open-data-YYYY-MM-DD/` | **200** — daily buckets live (tested 2026-06-15 and 2021-05-04) |
| `data.egov.bg` (Commercial Register dataset) | **200** — CC0, daily JSON/XML |
| `sigma.midt.bg` | **200** (browser UA; WebFetch gets 403 — bot block, not down) |
| `cpc.bg` (КЗК) | **200** |
| `portal.registryagency.bg` | **200** |

## 2. Procurement — ЦАИС ЕОП daily emission (`storage.eop.bg`)

Each day = one bucket with **4 JSON files** (confirmed on 2026-06-15): flat *contracts* (513 KB), flat *tenders* (981 KB), flat *annexes* (270 KB), full *OCDS 1.1* package (3.9 MB). One day ≈ **172 contracts / 394 tenders / 47 annexes**.

**Flat `contracts` field coverage (172 records):**

| Field | Cov | Use |
|---|---|---|
| `offersCount` | **100%** | ⭐ **single/low-bidding flag — fully feasible nationally** |
| `disqualifiedOffersCount` | 100% | rejected-bids flag |
| `buyerRegistryNumber` (buyer ЕИК) | 100% | join key → authorities + TR ownership |
| `tenderMainCpv` | 100% | sector / price-benchmark grouping |
| `contractValue` | 100% | value (native) |
| `estimatedValue` | 96% | price-anomaly numerator/denominator |
| `awardMethod` / `procedureType` | 100 / 97% | procedure-type flags |
| `hasSubcontractors` | 100% (bool) | subcontracting flag (EIK in OCDS file) |
| `supplierRegisterNumber` (winner ЕИК) | 80% | ⭐ join → TR ownership |
| `supplierName` | 80% | winner identity |
| `contractDate` / `publicationDate` | 80 / 100% | date-anomaly |
| `smeOffersCount` / `noEeaOffersCount` | 97 / 84% | bid-composition |

**Flat `tenders` field coverage (394 records):** `submissionDeadline` **100%** + `publicationDate` **100%** → ⭐ **short-tender-window flag fully feasible**; `estimatedValue` 100%, `mainCpvCode` 100%, `executionPlaceNuts` 100%, `isCancelled` 100% (cancelled-then-reissued flag), `changeNoticeCount` 26%, `tenderStartDate`/`EndDate` ~13% (sparse).

**Verdict:** the flat EOP feed is **richer than dokoga's deprecated `data.egov.bg` OCDS path** — notably `offersCount` and `submissionDeadline` at full coverage, which directly enable two of our strongest flags. The OCDS file (not yet deep-profiled) adds party addresses, award-supplier consortium members, and subcontractor ЕИК.

## 3. Ownership — Търговски регистър (`data.egov.bg`, CC0) ⭐

- **Dataset:** "Търговски регистър database, with history and erased personal data; ID numbers replaced by hash+salt." Daily resources, JSON **and** XML, `.../resource/download/<uuid>/{json|xml}`. License **CC0**.
- **Sample inspected:** `trgovski-registr-18062026.json`, **10.6 MB, 2,329 company deeds** (one day's delta).
- **Format:** OpenZ ТРРЮЛНЦ — `Message/Body/Deeds/Deed[]`. Each `Deed`: `$.UIC` (ЕИК, **100%**), `$.CompanyName`, `$.LegalForm` (EOOD 1631 / OOD 526 / AD 72 / EAD 19 / ET 11 …), `$.GUID`, `$.DeedStatus`. Sub-structures hold representatives, sole owner, partners, capital/shares, addresses, and **offshore direct/indirect control chains** (beneficial ownership).

**Person records (1,847 in one delta):** each `Person` = `Name` + `Indent` + `IndentType`.

| IndentType | Count | Meaning |
|---|---|---|
| `EGN` | 1349 | Bulgarian natural person — **Indent = stable 64-char SHA-256 hash** of ЕГН |
| `BirthDate` | 323 | foreign person (e.g. `801212`) |
| `UIC` | 130 | **corporate** owner/shareholder (ЕИК) → enables company→company ownership chains |
| `LNCH` | 35 | foreigner personal number |
| `Undefined` | 10 | — |

**Cross-company linkage proven:** within a *single* daily delta, **90 distinct person-hashes appear in ≥2 companies** (one person → 4 companies). The hash is a consistent pseudonymous person key across the corpus → we can build person↔company and company↔company ownership edges, detect shared owners/managers across firms, and walk beneficial-owner chains — **all without ever handling a real ЕГН** (privacy-preserving + defensible).

**Caveats:** (a) it's a *daily delta* feed — full graph needs accumulating the daily files (171+ pages of historical resources exist) or a full snapshot; volume/backfill cost is a D4/S1 question. (b) Name-only matching is still unsafe; the **hash is the safe key** (homonyms don't collide; conservative person-matching from the spec is satisfied by the hash). (c) Address-based "shared address" links possible but noisy (registered-agent offices) — treat as weak signal.

## 4. КЗК decisions (cpc.bg) — reachability only

`cpc.bg` returns 200. Per project decision, deep profiling + the losing-bidder-recovery probe are **deferred to a later spike**. Open questions for that spike: is there a structured decisions register/export, or HTML-only? Do decisions reliably name complainant + losing bidders? Coverage = only appealed procedures (biased slice).

## 5. SIGMA as a data layer — deferred to D4

SIGMA exposes CSV/JSON export (193k contracts, cleaned + EUR-normalized, MIT). Build-vs-consume decision deferred to D4 with these inputs: their data is a *served* projection (winner-only, no bids table, no ownership) — i.e. it would save us the procurement ETL but provides **none** of the two greenfield layers (ownership, КЗК) we must build anyway. Likely outcome: consume/mirror SIGMA's procurement semantics, build ownership + КЗК ourselves.

## 6. Impact on the criteria catalogue (feeds D3)

| Flag | D2 verdict | Evidence |
|---|---|---|
| Single / low bidding | ✅ **Confirmed feasible** | `offersCount` 100% |
| Short tender window | ✅ **Confirmed feasible** | `submissionDeadline` + `publicationDate` 100% |
| Annex / modification rate | ✅ Feasible | annexes feed + `changeNoticeCount` |
| Rejected-bids pattern | ✅ Feasible | `disqualifiedOffersCount` 100% |
| Cancelled-then-reissued | ✅ Feasible | `isCancelled` 100% |
| Signed-before/at-publication | ✅ Feasible | `contractDate` + `publicationDate` |
| **Ownership network** (winner↔buyer↔subcontractor, shared owners/managers, cross-tender winner clusters, beneficial-owner chains) | ✅ **Confirmed feasible** | TR `UIC`=ЕИК join + stable person hash; corporate-shareholder chains |
| In-tender bidder collusion | ❌ Infeasible (open data) | no losing-bidder data; КЗК probe is the only partial route |
| Price anomaly — normalized (€/CPV outlier) | ✅ Feasible | `estimatedValue`/`contractValue` + CPV |
| Price anomaly — line-item (the "bench") | ❓ Unknown | needs КСС spike (D4) — no line items in EOP or TR |

## 7. Artifacts
Probe scripts + samples are throwaway (in `/tmp`): `tr.json` (TR delta), `profile_eop.py`, `tr_probe*.txt`. Not committed — D2 is this document.
