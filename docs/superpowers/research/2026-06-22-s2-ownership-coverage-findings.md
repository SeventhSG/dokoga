# S2 — Ownership Coverage for Winners: findings & recommendation

**Date:** 2026-06-22
**Goal:** fire `shared_owner_cross_tenders` on real contract winners (not just the owner-graph).
**Outcome:** strategy resolved; blocked locally by disk. Production path identified.

## What we tested

1. **Full snapshot on data.egov.bg?** No. The Търговски регистър dataset is **~1,710 daily incremental deltas** (`Reason: Notification`), ~10 MB each ≈ **~17 GB of history**. No single full-DB resource.
2. **Delta accumulation for winner coverage?** Doesn't scale. Going **8 → 40 deltas moved winner coverage only 15 → 21 of 1,717** winners. Recent deltas cover *recently-changed* companies; procurement winners were mostly incorporated/changed in the past and don't appear. Linear, hopeless (a full year ≈ 2.6 GB would still miss the majority).
3. **Per-EIK portal API?** `portal.registryagency.bg/CR/api/…` exists but serves the **SPA shell** (session/anti-forgery/captcha-gated). Not open data; ToS-risky for autonomous bulk fetch of the winner EIKs.
4. **Cheap inversion — widen procurement to ~1 year of winners to intersect existing ownership.** Correct technical move (EOP is ~250 KB/day), but **crashed: `disk full`** — the machine's C: drive is at **100% (476 GB, ~0 free)**, a pre-existing condition. Could not complete.

## What is nonetheless proven

- The **ownership-link mechanism works on real open data**: the accumulated owner-graph has **863 natural-person hashes linking ≥2 companies**, with real co-ownership clusters (one person across 27 firms; multi-person business groups). These are exactly the edges `shared_owner_cross_tenders` consumes.
- The flag is **unit-tested** and fires correctly on crafted winners. The only gap is *winner∩ownership overlap*, i.e. coverage — not logic.

## Recommendation (production path)

Firing the flag on winners at scale needs a **full Търговски регистър snapshot**. The realistic route is the **official bulk-DB access agreement** with the Registry Agency — per `registryagency.bg`, the full database is provided **free to bodies exercising public functions / public-interest** via an interface agreement. For an anti-corruption platform this is the right, legitimate, sustainable source — not scraping the portal or pulling 17 GB of deltas.

Interim/cheaper options if bulk access is delayed:
- One-time historical **delta backfill** (accept the ~17 GB) into the Postgres store, then keep current via the daily delta (the live-refresh we already ingest).
- Bound it: backfill only deltas, then **on-demand enrich** the specific winner EIKs that procurement surfaces (targeted, not whole-register).

## Environment blocker

Local C: is **100% full**. The data-heavy S2 backfill cannot run here until space is freed. S0/S1 artifacts and the proven owner-graph remain intact. POC download cache was deleted to return ~350 MB.
