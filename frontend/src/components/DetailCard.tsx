import { useState } from "react";
import { X, MapPin, Sparkle, Path, Tree, Drop, Lightbulb, Buildings } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import DelayBar from "./DelayBar";
import { riskColor, riskLabel, bgn } from "../lib/risk";
import { analyzeProject } from "../lib/api";
import type { RepairFeature, AnalyzeResponse } from "../lib/types";

const SECTOR_ICON: Record<string, typeof Path> = {
  roads: Path, parks: Tree, water: Drop, lighting: Lightbulb, public: Buildings,
};

export default function DetailCard({ feature, onClose }: { feature: RepairFeature; onClose: () => void }) {
  const p = feature.properties;
  const c = riskColor(p.risk);
  const place = [p.locality, p.region].filter(Boolean).join(", ");
  const SecIcon = SECTOR_ICON[p.sector] ?? Path;
  const realistic = (p.planned_days || 0) + p.expected_days;

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function runAnalysis() {
    setBusy(true); setErr(false);
    try { setAnalysis(await analyzeProject(p)); }
    catch { setErr(true); }
    finally { setBusy(false); }
  }

  return (
    <div className="glass">
      <div className="detail-inner">
        <button className="close" onClick={onClose} aria-label="Затвори">
          <X size={16} weight="bold" />
        </button>

        <div className="detail-tags">
          <span className="risk-chip" style={{ background: `${c}22`, color: c }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            {riskLabel(p.risk)} риск · {Math.round(p.risk * 100)}%
          </span>
          {p.sector_name && (
            <span className="sector-chip"><SecIcon size={13} weight="duotone" /> {p.sector_name}</span>
          )}
        </div>

        <h3>{p.title || "Договор за ремонт"}</h3>
        {place && (
          <div className="meta" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={13} weight="fill" /> {place}
          </div>
        )}

        {/* прогноза: обещано -> реалистично */}
        <div className="detail-pred">
          <div className="detail-pred-row">
            <div>
              <div className="detail-pred-n mono">{p.planned_days || "-"}</div>
              <div className="detail-pred-l">обещани дни</div>
            </div>
            <div className="detail-pred-arrow">→</div>
            <div>
              <div className="detail-pred-n mono" style={{ color: c }}>{realistic || "-"}</div>
              <div className="detail-pred-l">реалистично</div>
            </div>
          </div>
          <DelayBar planned={Math.max(p.planned_days, 10)} overrun={p.expected_days} height={12} capSize={16} />
          <div className="detail-pred-cap mono" style={{ color: "var(--red)" }}>
            прогнозно +{p.expected_days} дни забавяне
          </div>
        </div>

        <div className="rows">
          <div className="row">
            <span className="k">Стойност</span>
            <span className="v mono">{bgn(p.value)}</span>
          </div>
          <div className="row">
            <span className="k">Изпълнител</span>
            <span className="v">{p.supplier || "няма данни"}</span>
          </div>
          {p.overrun_days > 0 && (
            <div className="row">
              <span className="k">Вече просрочен</span>
              <span className="v mono" style={{ color: "var(--red)" }}>+{p.overrun_days} дни</span>
            </div>
          )}
        </div>

        {!analysis && (
          <button className="btn detail-ai-btn" onClick={runAnalysis} disabled={busy}>
            <Sparkle size={16} weight="fill" /> {busy ? "AI анализира…" : "AI анализ: защо ще се бави?"}
          </button>
        )}
        {err && <p className="detail-ai-err">AI анализът не успя. Backend стартиран ли е?</p>}

        <AnimatePresence>
          {analysis && (
            <motion.div
              className="detail-ai"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="detail-ai-h"><Sparkle size={14} weight="fill" /> AI анализ</div>
              <p className="detail-ai-text">{analysis.analysis}</p>
              {analysis.drivers?.length > 0 && (
                <div className="detail-ai-drivers">
                  {analysis.drivers.map((d, i) => (
                    <motion.span
                      key={i} className="driver-chip"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.07 }}
                    >
                      {d}
                    </motion.span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
