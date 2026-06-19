import { Funnel, CaretDown } from "@phosphor-icons/react";

interface Props {
  regions: string[];
  value: string;
  onChange: (v: string) => void;
  count: number;
  atRiskPct: number;
}

export default function RegionFilter({ regions, value, onChange, count, atRiskPct }: Props) {
  return (
    <div className="glass panel">
      <h2 className="panel-h">
        <Funnel size={15} weight="bold" /> Област
      </h2>
      <div className="select-wrap">
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Избор на област">
          <option value="">Цяла България</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <CaretDown className="chev" size={14} weight="bold" />
      </div>
      <div className="region-figure">
        <span className="big mono">{count.toLocaleString("bg-BG")}</span>
        <span className="unit">
          ремонта · <b style={{ color: "var(--red)" }}>{atRiskPct}%</b> в риск
        </span>
      </div>
    </div>
  );
}
