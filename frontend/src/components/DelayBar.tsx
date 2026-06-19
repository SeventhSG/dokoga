interface Props {
  planned: number;
  overrun: number;
  height?: number;
  cap?: boolean;
  capSize?: number;
}

/** Signature element: planned span (cool) + overrun span (hazard stripes), ending in "?". */
export default function DelayBar({ planned, overrun, height = 10, cap = true, capSize = 13 }: Props) {
  const total = Math.max(planned + overrun, 1);
  const p = (Math.max(planned, 0) / total) * 100;
  const o = (Math.max(overrun, 0) / total) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div className="delaybar" style={{ height }}>
        <div className="delaybar-planned" style={{ width: `${p}%` }} />
        {overrun > 0 && <div className="delaybar-over" style={{ width: `${o}%` }} />}
      </div>
      {cap && <span className="delaybar-cap" style={{ fontSize: capSize }}>?</span>}
    </div>
  );
}
