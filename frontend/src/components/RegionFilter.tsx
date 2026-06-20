import { Funnel } from "@phosphor-icons/react";
import CustomSelect from "./CustomSelect";

interface Props {
  regions: string[];
  value: string;
  onChange: (v: string) => void;
  count: number;
  atRiskPct: number;
}

export default function RegionFilter({ regions, value, onChange, count, atRiskPct }: Props) {
  const options = [{ value: "", label: "Цяла България" }, ...regions.map((r) => ({ value: r, label: r }))];
  return (
    <div className="glass panel">
      <h2 className="panel-h">
        <Funnel size={15} weight="bold" /> Област
      </h2>
      <CustomSelect value={value} options={options} onChange={onChange} ariaLabel="Избор на област" />
      <div className="region-figure">
        <span className="big mono">{count.toLocaleString("bg-BG")}</span>
        <span className="unit">
          ремонта · <b style={{ color: "var(--red)" }}>{atRiskPct}%</b> в риск
        </span>
      </div>
    </div>
  );
}
