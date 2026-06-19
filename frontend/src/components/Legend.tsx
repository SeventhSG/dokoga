import { RISK } from "../lib/risk";

export default function Legend() {
  return (
    <div className="glass panel">
      <h2 className="panel-h">Риск от просрочване</h2>
      <div className="legend">
        <div className="legend-row">
          <span className="dot" style={{ background: RISK.high.color, color: RISK.high.color }} />
          <b>Висок</b> · вероятно ще се проточи
        </div>
        <div className="legend-row">
          <span className="dot" style={{ background: RISK.med.color, color: RISK.med.color }} />
          <b>Среден</b> · възможно забавяне
        </div>
        <div className="legend-row">
          <span className="dot" style={{ background: RISK.low.color, color: RISK.low.color }} />
          <b>Нисък</b> · вероятно в срок
        </div>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.45 }}>
        Размерът на точката е по стойността на договора. Рискът е оценка по исторически данни, не присъда.
      </p>
    </div>
  );
}
