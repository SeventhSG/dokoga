# S1 — Build Slice (Design)

**Date:** 2026-06-22
**Status:** Derived from S0/D4 §5 (approved discovery). Autonomous build.
**Sub-project:** S1 of the decomposition (see S0 spec).

## Goal

Prove the differentiator **end-to-end on real data**: ingest a bounded slice of procurement + ownership, compute a transparent Contract Integrity Index from deterministic flags, and surface at least one **verifiable real `shared_owner_cross_tenders` link** with traceable evidence. If that link checks out against the source registers, the core corruption-network thesis is proven in code.

## Scope (thin vertical slice)

**In:**
- Ingest flat EOP **contracts + tenders + annexes** for a bounded window (recent N days, all sectors in-window — simpler than sector filtering, still bounded).
- Accumulate Търговски регистър daily deltas → `organization(eik)`, `person(hash)`, `role`.
- Compute 6 deterministic flags (D3): `single_bidding`, `short_tender_window`, `price_anomaly_cpv`, `annex_value_inflation`, `buyer_supplier_concentration`, **`shared_owner_cross_tenders`**.
- Combine into a transparent, weighted **Integrity Index** per contract; evidence stored per flag.
- One **entity dossier** for a network-linked winner.

**Out (later sub-projects):** ML (S4), LLM-judge (S5), UI (S6), national completeness, КЗК, line-item/КСС pricing, beneficial-owner chains (start with direct owners/managers only).

## Storage decision

**SQLite for the POC slice** (zero-install, runs on the user's machine; dokoga already uses Python 3.11). Postgres is the S2+ target for national scale + recursive ownership queries — schema kept Postgres-compatible. This deviates from D4's "Postgres" only for the runnable slice; documented deliberately.

## Architecture

```
ingest_eop.py   storage.eop.bg daily buckets → raw → normalize → contracts, tenders, annexes
ingest_tr.py    data.egov.bg TR deltas → organizations(eik), persons(hash), roles(eik,person,type)
flags.py        pure functions: contract/tender rows → flag hits + evidence JSON
index.py        weighted combine → integrity_score + level (low/med/high)
dossier.py      entity → evidence-linked ledger
run.py          orchestrates: ingest window → compute → write flags + report
schema.sql      SQLite schema (Postgres-compatible types)
```

**Data flow:** download (idempotent, cached) → parse (pure mappers, unit-tested) → upsert → compute flags (pure, unit-tested) → store evidence → emit ranked report.

**Join keys:** procurement `buyerRegistryNumber`/`supplierRegisterNumber` (ЕИК) ↔ TR `UIC`; person linkage via stable ЕГН **hash** (never raw personal data).

## Key design choices (from S0)

- **Evidence-first:** every flag stores a JSON evidence blob (the values + source ids), never a bare boolean. Index is reproducible.
- **Factual framing:** flags are observations ("same owner hash in N firms"), never accusations.
- **Conservative person matching:** join on hash only; name-only matches are not asserted.
- **Reuse SIGMA semantics:** EUR canonicalization (BGN/1.95583), value-quality filtering before price stats.

## Testing

- Pure mappers (EOP row → record, TR deed → org/person/role) unit-tested with fixtures.
- Pure flag functions unit-tested with crafted rows (single bid, short window, price outlier, shared owner).
- Integration: run on a real downloaded window; data-quality asserts (FK integrity, coverage).
- **Verification:** manually trace one `shared_owner_cross_tenders` hit back to data.egov.bg + the contracts.

## Success criterion

Running `run.py` on a real window produces a ranked contract/entity list with evidence, and at least one `shared_owner_cross_tenders` link is **manually verifiable** against the source registers.
