import { X, MapPin } from "@phosphor-icons/react";
import DelayBar from "./DelayBar";
import { riskColor, riskLabel, bgn } from "../lib/risk";
import type { RepairFeature } from "../lib/types";

export default function DetailCard({ feature, onClose }: { feature: RepairFeature; onClose: () => void }) {
  const p = feature.properties;
  const c = riskColor(p.risk);
  const place = [p.locality, p.region].filter(Boolean).join(", ");

  return (
    <div className="glass">
      <div className="detail-inner">
        <button className="close" onClick={onClose} aria-label="Затвори">
          <X size={16} weight="bold" />
        </button>

        <span className="risk-chip" style={{ background: `${c}22`, color: c }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
          {riskLabel(p.risk)} риск · {Math.round(p.risk * 100)}%
        </span>

        <h3>{p.title || "Договор за ремонт"}</h3>
        {place && (
          <div className="meta" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={13} weight="fill" /> {place}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-2)", marginBottom: 7 }}>
            <span>обещан срок</span>
            <span className="mono" style={{ color: "var(--red)" }}>~{p.expected_days} дни забавяне</span>
          </div>
          <DelayBar planned={100} overrun={p.expected_days} height={12} capSize={16} />
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
              <span className="k">Реално просрочен</span>
              <span className="v mono" style={{ color: "var(--red)" }}>+{p.overrun_days} дни</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
