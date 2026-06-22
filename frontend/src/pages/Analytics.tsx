import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { GeoJsonObject, Feature } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { ArrowLeft } from "@phosphor-icons/react";
import { useTheme } from "../theme";
import ThemeToggle from "../components/ThemeToggle";
import {
  getSummary, getRegions, getCompanies, getBuyers, getSectors, getTopRisk, getNetwork, explain,
  fmtEur, fmtNum, levelOf,
  type Summary, type Region, type Company, type Buyer, type Sector, type TopRisk, type NetworkLink,
} from "../lib/integrityApi";

const RU: Record<string, string> = { low: "нисък", med: "среден", high: "висок" };
const TILES: Record<string, string> = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};
const riskColor = (r?: Region) =>
  !r || !r.contracts ? "#CBD5E1" : r.avg_risk >= 0.6 ? "#DC2626" : r.avg_risk >= 0.45 ? "#D97706" : "#16A34A";

function Badge({ level }: { level: string }) {
  return <span className={`ig-badge ${level}`}><span className="d" />{RU[level]}</span>;
}

type Col<T> = { key: keyof T; label: string; num?: boolean; render?: (r: T) => ReactNode };
function SortableTable<T>({ cols, rows, initial }: { cols: Col<T>[]; rows: T[]; initial: keyof T }) {
  const [key, setKey] = useState<keyof T>(initial);
  const [dir, setDir] = useState(-1);
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const x = a[key], y = b[key];
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x ?? "").localeCompare(String(y ?? ""), "bg") * dir;
    });
  }, [rows, key, dir]);
  const click = (c: Col<T>) => { if (c.key === key) setDir(-dir); else { setKey(c.key); setDir(c.num ? -1 : 1); } };
  return (
    <div className="ig-tw">
      <table className="ig-table">
        <thead><tr>{cols.map((c) => (
          <th key={String(c.key)} data-num={c.num ? "1" : undefined}
            aria-sort={c.key === key ? (dir === -1 ? "descending" : "ascending") : undefined}
            tabIndex={0} role="button"
            onClick={() => click(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); click(c); } }}>
            {c.label}{c.key === key ? (dir === -1 ? " ▾" : " ▴") : ""}
          </th>))}</tr></thead>
        <tbody>{sorted.map((r, i) => (
          <tr key={i}>{cols.map((c) => (
            <td key={String(c.key)} data-num={c.num ? "1" : undefined}>{c.render ? c.render(r) : String(r[c.key] ?? "—")}</td>
          ))}</tr>))}</tbody>
      </table>
    </div>
  );
}

export default function Analytics() {
  const { theme, toggle } = useTheme();
  const [sum, setSum] = useState<Summary | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [coverage, setCoverage] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [topRisk, setTopRisk] = useState<TopRisk[]>([]);
  const [network, setNetwork] = useState<NetworkLink[]>([]);
  const [geo, setGeo] = useState<GeoJsonObject | null>(null);
  const [sel, setSel] = useState<Region | null>(null);
  const [exp, setExp] = useState<{ title: string; text: string } | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    Promise.all([getSummary(), getRegions(), getCompanies(), getBuyers(), getSectors(), getTopRisk(), getNetwork()])
      .then(([s, r, c, b, se, tr, n]) => {
        setSum(s); setRegions(r.regions); setCoverage(r.coverage_pct);
        setCompanies(c.companies); setBuyers(b.buyers); setSectors(se.sectors);
        setTopRisk(tr.top_risk); setNetwork(n.network);
      }).catch(() => setErr(true));
    fetch("/bg_oblasti.geojson").then((r) => r.json()).then(setGeo).catch(() => {});
  }, []);

  const byName = useMemo(() => Object.fromEntries(regions.map((r) => [r.region_name, r])), [regions]);
  const k = sum?.kpis;

  const style = (f?: Feature): PathOptions => ({
    fillColor: riskColor(byName[(f?.properties as { region_name?: string })?.region_name ?? ""]),
    weight: 1, color: "#fff", fillOpacity: 0.8,
  });
  const onEach = (f: Feature, layer: Layer) => {
    const n = (f.properties as { region_name: string }).region_name, r = byName[n];
    layer.bindTooltip(`${n} — ${r && r.contracts ? "риск " + r.avg_risk : "няма данни"}`, { sticky: true });
    layer.on({ click: () => setSel(r ?? { region_name: n, contracts: 0, value_eur: 0, high: 0, single_bid_pct: 0, avg_risk: 0 }) });
  };

  async function doExplain(target: string, title: string) {
    setExp({ title, text: "Зареждане…" });
    try { const r = await explain(target); setExp({ title, text: r.narrative ?? r.error ?? "—" }); }
    catch { setExp({ title, text: "Грешка при заявката." }); }
  }

  return (
    <div className={`ig ${theme}`}>
      <style>{CSS}</style>
      <header className="ig-hdr">
        <Link to="/app" className="ig-back"><ArrowLeft size={15} weight="bold" /> Карта</Link>
        <div className="ig-brand"><span className="dot" /> IntegrityBG · Анализи</div>
        <nav className="ig-nav">
          <Link to="/">Начало</Link><Link to="/app">Карта</Link>
          <span className="cur">Анализи</span>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </nav>
      </header>

      <main className="ig-main">
        <p className="ig-lead">Интегритет на обществените поръчки по обективни индикатори върху отворените данни на ЦАИС ЕОП и Търговския регистър.</p>
        <div className="ig-disc">Това са автоматични <b>сигнали за риск</b> — не са обвинения или доказателства за нарушение. Числата идват от детерминирания анализ; ML моделът само допринася (70/30), а обясненията не изчисляват числа.</div>
        {err && <div className="ig-disc" style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#991B1B" }}>Бекендът не отговаря. Стартирай <code>uvicorn serve:app --port 8000</code> в backend/.</div>}

        {k && (
          <section className="ig-kpis">
            {[["Договори", fmtNum(k.contracts)], ["Обща стойност", fmtEur(k.value_eur)], ["Висок риск", fmtNum(k.high), true],
              ["Единичен участник", k.single_bid_pct + "%"], ["Изпълнители", fmtNum(k.suppliers)], ["Възложители", fmtNum(k.buyers)]]
              .map(([l, v, a], i) => (
                <div className={`ig-kpi${a ? " alert" : ""}`} key={i}><div className="lbl">{l as string}</div><div className="val">{v as string}</div></div>
              ))}
          </section>
        )}

        <section className="ig-maprow">
          <div className="ig-card ig-mapwrap">
            <div className="cap"><h2>Риск по области</h2><span className="sub">среден микс-риск · геопокритие {coverage}%</span></div>
            <MapContainer className="ig-map" center={[42.73, 25.4]} zoom={7} scrollWheelZoom={false} zoomControl={false}>
              <TileLayer key={theme} url={TILES[theme]} attribution="&copy; OpenStreetMap &copy; CARTO" subdomains="abcd" />
              {geo && regions.length > 0 && <GeoJSON key={theme + regions.length} data={geo} style={style} onEachFeature={onEach} />}
            </MapContainer>
          </div>
          <aside className="ig-card ig-panel">
            <div className="cap"><h2>{sel ? sel.region_name : "Изберете област"}</h2></div>
            <div className="body">
              {!sel && <p className="muted">Кликнете върху област на картата.</p>}
              {sel && sel.contracts === 0 && <p className="muted">Няма картирани договори.</p>}
              {sel && sel.contracts > 0 && (<>
                <div className="stat"><span>Среден риск</span><span><Badge level={levelOf(sel.avg_risk)} /> <b>{sel.avg_risk}</b></span></div>
                <div className="stat"><span>Договори</span><b>{fmtNum(sel.contracts)}</b></div>
                <div className="stat"><span>Стойност</span><b>{fmtEur(sel.value_eur)}</b></div>
                <div className="stat"><span>Единичен участник</span><b>{sel.single_bid_pct}%</b></div>
                <div className="stat"><span>Високорискови</span><b>{fmtNum(sel.high)}</b></div>
              </>)}
              <div className="legend">
                <span><i style={{ background: "#16A34A" }} />нисък</span><span><i style={{ background: "#D97706" }} />среден</span>
                <span><i style={{ background: "#DC2626" }} />висок</span><span><i style={{ background: "#CBD5E1" }} />няма данни</span>
              </div>
            </div>
          </aside>
        </section>

        {sum && (
          <section className="ig-card">
            <div className="cap"><h2>Флагове — обобщение</h2><span className="sub">{sum.ml ? `ML (leak-free) ROC-AUC ${sum.ml.roc_auc.toFixed(3)}` : ""}</span></div>
            <div className="ig-bars">
              {Object.entries(sum.flags_summary).map(([code, n]) => {
                const max = Math.max(...Object.values(sum.flags_summary), 1);
                return <div className="ig-bar" key={code}><span className="chip">{code}</span>
                  <span className="track"><span className="fill" style={{ width: `${(100 * n) / max}%` }} /></span>
                  <span className="n">{fmtNum(n)}</span></div>;
              })}
            </div>
          </section>
        )}

        <section className="ig-card">
          <div className="cap"><h2>Най-рискови договори</h2><span className="sub">микс 0.7 детерминиран + 0.3 ML</span></div>
          <SortableTable<TopRisk> initial="blended" rows={topRisk} cols={[
            { key: "blended", label: "Риск", num: true, render: (r) => <span><Badge level={levelOf(r.blended)} /> <b>{r.blended}</b></span> },
            { key: "supplier", label: "Изпълнител", render: (r) => r.supplier ?? "—" },
            { key: "buyer", label: "Възложител", render: (r) => r.buyer ?? "—" },
            { key: "amount_eur", label: "Стойност", num: true, render: (r) => fmtEur(r.amount_eur) },
            { key: "codes", label: "Индикатори", render: (r) => <>{r.codes.map((c) => <span className="chip" key={c}>{c}</span>)}</> },
            { key: "id", label: "", render: (r) => <button className="ig-btn" onClick={() => doExplain(r.id, `${r.supplier ?? "Договор"} · ${fmtEur(r.amount_eur)}`)}>Обясни</button> },
          ]} />
        </section>

        <section className="ig-card">
          <div className="cap"><h2>Изпълнители</h2><span className="sub">топ по спечелена стойност</span></div>
          <SortableTable<Company> initial="won_eur" rows={companies} cols={[
            { key: "name", label: "Изпълнител", render: (r) => <span><b>{r.name}</b><br /><span className="eik">ЕИК {r.eik}</span></span> },
            { key: "won_eur", label: "Спечелено", num: true, render: (r) => fmtEur(r.won_eur) },
            { key: "contracts", label: "Договори", num: true, render: (r) => fmtNum(r.contracts) },
            { key: "buyers", label: "Възложители", num: true, render: (r) => fmtNum(r.buyers) },
            { key: "single_bid_pct", label: "Единичен участник", num: true, render: (r) => r.single_bid_pct + "%" },
            { key: "flags", label: "Флагове", num: true, render: (r) => fmtNum(r.flags) },
          ]} />
        </section>

        <section className="ig-card">
          <div className="cap"><h2>Възложители (общини и др.)</h2><span className="sub">топ по разход</span></div>
          <SortableTable<Buyer> initial="spend_eur" rows={buyers} cols={[
            { key: "name", label: "Възложител", render: (r) => <span><b>{r.name}</b><br /><span className="eik">ЕИК {r.eik}</span></span> },
            { key: "spend_eur", label: "Разход", num: true, render: (r) => fmtEur(r.spend_eur) },
            { key: "contracts", label: "Договори", num: true, render: (r) => fmtNum(r.contracts) },
            { key: "suppliers", label: "Изпълнители", num: true, render: (r) => fmtNum(r.suppliers) },
            { key: "single_bid_pct", label: "Единичен участник", num: true, render: (r) => r.single_bid_pct + "%" },
            { key: "top_supplier_share", label: "Дял топ изпълнител", num: true, render: (r) => r.top_supplier_share + "%" },
            { key: "region", label: "Област", render: (r) => r.region ?? "—" },
          ]} />
        </section>

        <section className="ig-card">
          <div className="cap"><h2>Сектори (CPV раздел)</h2></div>
          <SortableTable<Sector> initial="value_eur" rows={sectors} cols={[
            { key: "cpv_division", label: "CPV раздел" },
            { key: "value_eur", label: "Стойност", num: true, render: (r) => fmtEur(r.value_eur) },
            { key: "contracts", label: "Договори", num: true, render: (r) => fmtNum(r.contracts) },
            { key: "single_bid_pct", label: "Единичен участник", num: true, render: (r) => r.single_bid_pct + "%" },
          ]} />
        </section>

        <section className="ig-card">
          <div className="cap"><h2>Обща собственост между печелили фирми</h2><span className="sub">мрежа</span></div>
          <SortableTable<NetworkLink> initial="count" rows={network} cols={[
            { key: "person", label: "Свързано лице", render: (r) => <span><b>{r.person}</b> <span className="chip">{r.id_type}</span></span> },
            { key: "count", label: "Фирми", num: true, render: (r) => fmtNum(r.count) },
            { key: "companies", label: "Печелили фирми", render: (r) => r.companies.map((c) => c.name ?? c.eik).join(" · ") },
          ]} />
        </section>
      </main>

      {exp && (
        <div className="ig-modal" onClick={() => setExp(null)}>
          <div className="ig-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cap"><h2>AI обяснение</h2><button className="ig-btn" onClick={() => setExp(null)}>Затвори</button></div>
            <p className="exp-title">{exp.title}</p>
            <p className="exp-text">{exp.text}</p>
            <p className="muted" style={{ fontSize: ".75rem" }}>Граундирано обяснение — моделът използва само извлечените факти и не изчислява числа.</p>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.ig{--p:#1E40AF;--ac:#D97706;--lo:#16A34A;--me:#D97706;--hi:#DC2626;min-height:100vh;font-family:'Fira Sans',system-ui,sans-serif}
.ig.light{--bg:#F8FAFC;--surf:#fff;--fg:#0F172A;--soft:#475569;--bd:#E2E8F0;--mut:#E9EEF6}
.ig.dark{--bg:#0B1220;--surf:#111A2B;--fg:#E8EEF6;--soft:#93A4BD;--bd:#1F2C44;--mut:#16223A}
.ig{background:var(--bg);color:var(--fg)}
.ig-hdr{position:sticky;top:0;z-index:1000;display:flex;align-items:center;gap:1rem;padding:.7rem 1.25rem;background:var(--surf);border-bottom:1px solid var(--bd)}
.ig-back{display:inline-flex;align-items:center;gap:.3rem;color:var(--soft);text-decoration:none;font-size:.85rem}
.ig-brand{font-weight:700;color:var(--p);display:flex;align-items:center;gap:.5rem}
.ig-brand .dot{width:11px;height:11px;border-radius:3px;background:var(--p);box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 25%,transparent)}
.ig-nav{margin-left:auto;display:flex;align-items:center;gap:1rem;font-size:.9rem}
.ig-nav a{color:var(--soft);text-decoration:none}.ig-nav a:hover{color:var(--p)}
.ig-nav .cur{color:var(--p);font-weight:600}
.ig-main{max-width:1200px;margin:0 auto;padding:1.25rem}
.ig-lead{color:var(--soft);max-width:72ch;margin:.25rem 0 1rem}
.ig-disc{background:#FEF3C7;border:1px solid #FCD34D;color:#92400E;border-radius:8px;padding:.6rem .85rem;font-size:.82rem;margin-bottom:1.1rem}
.ig-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;margin-bottom:1.1rem}
.ig-kpi{background:var(--surf);border:1px solid var(--bd);border-radius:10px;padding:.8rem 1rem}
.ig-kpi .lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--soft);font-weight:600}
.ig-kpi .val{font-family:'Fira Code',monospace;font-variant-numeric:tabular-nums;font-size:1.45rem;font-weight:700;margin-top:.2rem}
.ig-kpi.alert .val{color:var(--hi)}
.ig-card{background:var(--surf);border:1px solid var(--bd);border-radius:10px;margin-bottom:1.1rem;overflow:hidden}
.ig-card>.cap{display:flex;align-items:baseline;gap:.6rem;padding:.8rem 1.05rem;border-bottom:1px solid var(--bd)}
.ig-card>.cap h2{font-size:1.02rem;margin:0}
.ig-card>.cap .sub{margin-left:auto;font-size:.78rem;color:var(--soft)}
.ig-maprow{display:grid;grid-template-columns:1fr 320px;gap:1.1rem}
@media(max-width:860px){.ig-maprow{grid-template-columns:1fr}}
.ig-map{height:62vh;min-height:420px;width:100%}
.ig-panel .body{padding:1rem}
.ig-panel .stat{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px dashed var(--bd);font-size:.9rem}
.ig-panel .stat b{font-family:'Fira Code',monospace}
.ig-panel .muted,.muted{color:var(--soft)}
.ig-panel .legend{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:.8rem;font-size:.78rem;color:var(--soft)}
.ig-panel .legend i{display:inline-block;width:13px;height:13px;border-radius:3px;margin-right:.3rem;vertical-align:-2px}
.ig-bars{padding:1rem 1.05rem;display:grid;gap:.5rem}
.ig-bar{display:grid;grid-template-columns:210px 1fr 64px;align-items:center;gap:.6rem;font-size:.85rem}
.ig-bar .track{background:var(--mut);border-radius:6px;height:13px;overflow:hidden}
.ig-bar .fill{height:100%;background:linear-gradient(90deg,#3B82F6,var(--p));border-radius:6px}
.ig-bar .n{text-align:right;font-family:'Fira Code',monospace;color:var(--soft)}
.ig-tw{overflow-x:auto}
.ig-table{width:100%;border-collapse:collapse;font-size:.88rem}
.ig-table th,.ig-table td{padding:.55rem .8rem;text-align:left;white-space:nowrap}
.ig-table thead th{position:sticky;top:0;background:var(--mut);color:var(--soft);font-weight:600;font-size:.74rem;text-transform:uppercase;letter-spacing:.03em;cursor:pointer;user-select:none}
.ig-table th[data-num],.ig-table td[data-num]{text-align:right}
.ig-table td[data-num]{font-family:'Fira Code',monospace;font-variant-numeric:tabular-nums}
.ig-table tbody tr{border-top:1px solid var(--bd)}
.ig-table tbody tr:hover{background:var(--mut)}
.ig-table .eik{color:var(--soft);font-size:.74rem;font-family:'Fira Code',monospace}
.ig-badge{display:inline-flex;align-items:center;gap:.3rem;padding:.1rem .45rem;border-radius:999px;font-size:.72rem;font-weight:600}
.ig-badge .d{width:7px;height:7px;border-radius:50%}
.ig-badge.low{background:#DCFCE7;color:#14532D}.ig-badge.low .d{background:var(--lo)}
.ig-badge.med{background:#FEF3C7;color:#92400E}.ig-badge.med .d{background:var(--me)}
.ig-badge.high{background:#FEE2E2;color:#991B1B}.ig-badge.high .d{background:var(--hi)}
.chip{display:inline-block;background:var(--mut);color:var(--soft);border-radius:6px;padding:.08rem .4rem;font-size:.7rem;margin:1px;font-family:'Fira Code',monospace}
.ig-btn{background:var(--p);color:#fff;border:0;border-radius:7px;padding:.3rem .6rem;font-size:.78rem;cursor:pointer}
.ig-btn:hover{background:#1B3A9E}
.ig-modal{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:1rem}
.ig-modal-box{background:var(--surf);color:var(--fg);border:1px solid var(--bd);border-radius:12px;max-width:560px;width:100%;padding:0 0 1rem}
.ig-modal-box .cap{display:flex;align-items:center;padding:.8rem 1.05rem;border-bottom:1px solid var(--bd)}
.ig-modal-box .cap h2{font-size:1rem;margin:0;margin-right:auto}
.ig-modal-box .exp-title{padding:.8rem 1.05rem 0;font-weight:600}
.ig-modal-box .exp-text{padding:.4rem 1.05rem;line-height:1.55}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
