import { Path, Tree, Drop, Lightbulb, Buildings, Stack } from "@phosphor-icons/react";

export const SECTORS = [
  { id: "", label: "Всички", Icon: Stack },
  { id: "roads", label: "Пътища", Icon: Path },
  { id: "parks", label: "Паркове", Icon: Tree },
  { id: "water", label: "ВиК", Icon: Drop },
  { id: "lighting", label: "Осветление", Icon: Lightbulb },
  { id: "public", label: "Сгради/площади", Icon: Buildings },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}

export default function SectorFilter({ value, onChange, counts }: Props) {
  return (
    <div className="glass panel">
      <h2 className="panel-h"><Stack size={15} weight="bold" /> Вид ремонт</h2>
      <div className="sector-chips">
        {SECTORS.map(({ id, label, Icon }) => {
          const n = id === "" ? counts.__all ?? 0 : counts[id] ?? 0;
          if (id !== "" && n === 0) return null;
          return (
            <button
              key={id || "all"}
              className={`sector-pill${value === id ? " on" : ""}`}
              onClick={() => onChange(id)}
              aria-pressed={value === id}
            >
              <Icon size={14} weight="duotone" /> {label}
              <span className="sector-pill-n mono">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
