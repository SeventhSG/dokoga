# S4 — Supervised ML (adverse outcome), leak-free + blended

**Date:** 2026-06-23
**Module:** `integritybg/ml.py` (+ `ml_scores` table, `data/ml_metrics.json`); blend shown in `analyze.py`.

## Label & features
- **Label (observable half available now):** contract **materially modified** = has a linked annex. Base rate **7.4%** (3,004 / 40,347). The other composite half — **КЗК challenged/annulled** — is deferred until cpc.bg is ingested (documented; not faked).
- **Features (all pre-modification):** `log(contract_value)`, `log(estimated_value)`, `offers_count`, `disqualified_count`, `cpv` division, and **leak-free** buyer/supplier historical modification-rate target encodings.
- **Model:** LightGBM classifier, 5-fold stratified, out-of-fold probabilities.

## Result — honest, and proven honest

| Metric | Leak-free | Baseline |
|---|---|---|
| **ROC-AUC** | **0.860** | 0.500 |
| **PR-AUC** | **0.466** | 0.074 |

**Integrity check (dokoga's `13_benchmark` discipline):** the *leaky* variant — encoding buyer/supplier rates from the **full** target (incl. test rows) — scores **ROC-AUC 0.963**. Gap **+0.103**. That is precisely the bug that once inflated dokoga 0.65→0.98; here it's caught and quantified. **We report 0.860, the leak-free number**, with target encodings computed train-fold-only on every CV iteration.

> Why 0.86 (vs dokoga's 0.65) is legitimate, not a leak: predicting *modification* from buyer/supplier
> history is genuinely learnable — some buyers/suppliers systematically annex — and that signal is
> encoded without touching test-row targets. The small leaky gap confirms it.

## Blend (70 / 30) — ML nudges, never defines

Final contract risk = **0.7 × deterministic Integrity Index + 0.3 × ML P(adverse)**. The ML never
creates a flag and never the headline; the deterministic, auditable index dominates. Out-of-fold
probabilities (not leaked) are the per-contract ML signal.

**Top blended-risk contracts** (real): Равнако ООД €1.65M (annex inflation + price anomaly + single-bid,
det 0.98 / ml 0.96 → **0.97**); БЕНТ ОЙЛ АД €2.56M; ИНЖСТРОЙ ЕООД €0.45M; МЕТРОРЕКЛАМА €0.40M — all
large, single-bid, with price/annex signals. Exactly the set worth investigating.

## Reproduce
```bash
python ml.py        # leak-free CV + leaky contrast + write ml_scores, ml_metrics.json
python analyze.py   # blended-risk report
```

## State vs roadmap
S1✅ S2✅ S3✅ **S4✅**. Next: **S5** (LLM-judge — *retrieve→narrate*, explains the evidence, never
computes a number; needs an LLM API key) then **S6** (public UI). Plus the standing infra items: fix
delta pagination, pursue the full TR snapshot, and ingest КЗК to complete the composite label.
