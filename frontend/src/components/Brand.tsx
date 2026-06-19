import DelayBar from "./DelayBar";

interface Props {
  total: number;
  atRisk: number;
}

export default function Brand({ total, atRisk }: Props) {
  return (
    <div className="glass brand">
      <h1 className="display">
        ДОКОГА<span className="q">?</span>
      </h1>
      <p className="tag">
        AI прогноза кога обществените ремонти РЕАЛНО свършват. Спрямо обещания срок.
      </p>
      <DelayBar planned={62} overrun={46} height={11} capSize={15} />
      <div className="delaybar-legend">
        <span>
          <i style={{ background: "var(--cool)" }} />
          обещан срок
        </span>
        <span>
          <i style={{ background: "var(--red)" }} />
          просрочване
        </span>
      </div>
      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="n mono">{total.toLocaleString("bg-BG")}</div>
          <div className="l">ремонта на картата</div>
        </div>
        <div className="stat">
          <div className="n mono" style={{ color: "var(--red)" }}>
            {atRisk.toLocaleString("bg-BG")}
          </div>
          <div className="l">с висок риск</div>
        </div>
      </div>
    </div>
  );
}
