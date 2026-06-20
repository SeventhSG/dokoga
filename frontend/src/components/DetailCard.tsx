import { useState } from "react";
import { X, MapPin, Sparkle, Path, Tree, Drop, Lightbulb, Buildings, Clock, Files, ArrowSquareOut } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import DelayBar from "./DelayBar";
import { riskColor, riskLabel, money, daysLeft, dayRange, MODEL_NOTE } from "../lib/risk";
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
  const [loDays, hiDays] = dayRange(p.expected_days);
  const planned = p.planned_days || 0;
  const isActive = !!p.is_active;
  const left = daysLeft(p.deadline);

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
          {isActive && (
            <span className="risk-chip" style={{ background: "#22d3ee22", color: "#22d3ee" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee" }} />
              Активна поръчка
            </span>
          )}
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

        {isActive ? (
          /* активна поръчка: краен срок + процедура + документи */
          <div className="detail-pred">
            <div className="detail-pred-row" style={{ justifyContent: "flex-start", gap: 8 }}>
              <Clock size={20} weight="duotone" style={{ color: left != null && left <= 7 ? "var(--red)" : "#22d3ee" }} />
              <div>
                <div className="detail-pred-n mono" style={{ color: left != null && left <= 7 ? "var(--red)" : "#22d3ee" }}>
                  {left != null && left >= 0 ? `още ${left} дни` : "срокът изтече"}
                </div>
                <div className="detail-pred-l">краен срок за оферти: {p.deadline_raw || "—"}</div>
              </div>
            </div>
            <div className="detail-pred-cap" style={{ color: "var(--ink-3)" }}>
              {[p.procedure, p.object_type].filter(Boolean).join(" · ")}
            </div>
          </div>
        ) : (
          /* прогноза: обещано -> реалистичен диапазон (ориентир, не точно число) */
          <div className="detail-pred">
            <div className="detail-pred-row">
              <div>
                <div className="detail-pred-n mono">{planned || "-"}</div>
                <div className="detail-pred-l">обещани дни</div>
              </div>
              <div className="detail-pred-arrow">→</div>
              <div>
                <div className="detail-pred-n mono" style={{ color: c }}>
                  {planned ? `${planned + loDays}–${planned + hiDays}` : "-"}
                </div>
                <div className="detail-pred-l">реалистично (ориентир)</div>
              </div>
            </div>
            <DelayBar planned={Math.max(planned, 10)} overrun={p.expected_days} height={12} capSize={16} />
            <div className="detail-pred-cap mono" style={{ color: "var(--red)" }}>
              обикновено +{loDays}–{hiDays} дни за такива проекти
            </div>
            <p className="detail-pred-note">{MODEL_NOTE}</p>
          </div>
        )}

        <div className="rows">
          <div className="row">
            <span className="k">{isActive ? "Прогнозна стойност" : "Стойност"}</span>
            <span className="v mono">{money(p.value, p.value_currency)}</span>
          </div>
          {isActive ? (
            <>
              <div className="row">
                <span className="k">Документи</span>
                <span className="v mono">{p.n_documents ?? 0}</span>
              </div>
              <div className="row">
                <span className="k">Възложител</span>
                <span className="v">{p.buyer || "Община Стара Загора"}</span>
              </div>
              {p.eop_url && (
                <a className="row" href={p.eop_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <span className="k">ЦАИС ЕОП</span>
                  <span className="v" style={{ color: "#22d3ee", display: "flex", alignItems: "center", gap: 4 }}>
                    {p.regnum} <ArrowSquareOut size={13} weight="bold" />
                  </span>
                </a>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {isActive && p.risk_basis && (
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.45, display: "flex", gap: 5, alignItems: "flex-start" }}>
            <Files size={13} weight="duotone" style={{ flexShrink: 0, marginTop: 1 }} />
            Рискът е {p.risk_basis} — не е присъда за конкретния проект.
          </p>
        )}

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
