# Migration — integrity engine folded into dokoga (single project)

**Date:** 2026-06-23
**Why:** the integrity system was wrongly built as a standalone app; it belongs inside dokoga, surfaced
through dokoga's own backend, map and frontend. The standalone `integritybg/` has been **removed** — all
of it now lives in dokoga.

## Where everything landed
| Concern | Location in dokoga |
|---|---|
| Pipeline (ingest EOP + TR, flags, index, ML, dossier, schema, tests) | `scripts/integrity/` (paths point to `data/app/`) |
| Data | `data/app/integrity.sqlite` (46k contracts + ownership), `data/app/ml_metrics.json`, `data/app/bg_oblasti.geojson` |
| Backend read API + LLM-judge | `backend/integrity.py` (reuses `agent.generate` for narration) |
| HTTP endpoints | `backend/serve.py` → `GET /integrity/{summary,regions,companies,buyers,sectors,top-risk,network}`, `POST /integrity/explain` (rate-limited) |
| Frontend API client | `frontend/src/lib/integrityApi.ts` |
| Analytics UI | `frontend/src/pages/Analytics.tsx` (route `/analytics`) — KPIs, **области choropleth map**, flag bars, sortable tables (companies, общини, sectors, top-risk with **AI «Обясни»**, ownership network) |
| Nav | `App.tsx` route + link from the Dashboard topbar (`Анализи`) |
| Geo asset for frontend | `frontend/public/bg_oblasti.geojson` |

## Verified live (uvicorn serve:app)
- `/integrity/summary` → 46,004 contracts, 3,240 high-risk, ML ROC-AUC 0.860.
- `/integrity/regions` → 28 областi, geo-coverage 22%.
- `/integrity/explain` → grounded Gemini narrative on the top contract (single-bid, 187× CPV median…),
  with the standing disclaimer; computes no numbers.
- `npm run build` (tsc -b + vite) passes; `/analytics` bundled.

## Design
Analytics page is themed to dokoga (dark/light via `useTheme`, Fira Sans/Code, blue + amber, green/amber/red
risk badges with dot+label, WCAG-minded, reduced-motion). Reuses `ThemeToggle`.

## Regenerate data
```bash
cd dokoga
python scripts/integrity/ingest_eop.py / ingest_tr.py  (via the run/analyze helpers)  # or re-import
python scripts/integrity/ml.py        # leak-free model -> ml_scores + data/app/ml_metrics.json
```

## Not done / optional next
- **Risk overlay on the main `/app` map** (the points map): deferred to avoid destabilising the dense
  Dashboard HUD; the областi choropleth currently lives on `/analytics`. Can be added as a toggle layer.
- Standing infra (unchanged): fix TR delta pagination, full TR snapshot for winner-scale ownership, КЗК ingest.
