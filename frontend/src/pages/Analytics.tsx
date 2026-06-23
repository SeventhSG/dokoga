import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { GeoJsonObject, Feature } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { ArrowLeft, Sparkle, Buildings, Users, ShareNetwork } from "@phosphor-icons/react";
import { useTheme } from "../theme";
import ThemeToggle from "../components/ThemeToggle";
import {
  getSummary, getRegions, getCases, getNetwork, getCompanies, getBuyers, getCompaniesRanked, explain,
  fmtEur, fmtNum,
  type Summary, type Region, type Case, type NetworkLink, type Company, type Buyer, type RankedCompany,
} from "../lib/integrityApi";

const lvlPct = (p: number) => (p >= 66 ? "high" : p >= 33 ? "med" : "low");

const TILES: Record<string, string> = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};
const LVL: Record<string, string> = { low: "нисък", med: "среден", high: "висок" };
const compactEur = (n: number) =>
  n >= 1e9 ? "€" + (n / 1e9).toFixed(1) + " млрд" : n >= 1e6 ? "€" + (n / 1e6).toFixed(1) + " млн" : fmtEur(n);

export default function Analytics() {
  const { theme, toggle } = useTheme();
  const [sum, setSum] = useState<Summary | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [coverage, setCoverage] = useState(0);
  const [cases, setCases] = useState<Case[]>([]);
  const [network, setNetwork] = useState<NetworkLink[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [geo, setGeo] = useState<GeoJsonObject | null>(null);
  const [sel, setSel] = useState<Region | null>(null);
  const [exp, setExp] = useState<Record<string, { loading: boolean; text: string }>>({});
  const [err, setErr] = useState(false);
  const [ranked, setRanked] = useState<RankedCompany[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    Promise.all([getSummary(), getRegions(), getCases(), getNetwork(), getCompanies(), getBuyers()])
      .then(([s, r, c, n, co, b]) => {
        setSum(s); setRegions(r.regions); setCoverage(r.coverage_pct);
        setCases(c.cases); setNetwork(n.network); setCompanies(co.companies); setBuyers(b.buyers);
      }).catch(() => setErr(true));
    getCompaniesRanked().then((r) => setRanked(r.companies)).catch(() => {});
    fetch("/bg_oblasti.geojson").then((r) => r.json()).then(setGeo).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? ranked.filter((c) => (c.name ?? "").toLowerCase().includes(s) || c.eik.includes(s)) : ranked;
  }, [ranked, q]);

  const byName = useMemo(() => Object.fromEntries(regions.map((r) => [r.region_name, r])), [regions]);
  const k = sum?.kpis;
  const worstBuyers = useMemo(
    () => [...buyers].filter((b) => b.contracts >= 5).sort((a, b) => b.single_bid_pct - a.single_bid_pct).slice(0, 12),
    [buyers]
  );
  const worstCos = useMemo(
    () => [...companies].sort((a, b) => b.flags - a.flags || b.won_eur - a.won_eur).slice(0, 9),
    [companies]
  );
  // quantile thresholds so the map differentiates (relative risk), never all-green
  const riskThr = useMemo<[number, number]>(() => {
    const xs = regions.filter((r) => r.contracts > 0).map((r) => r.risk_index).sort((a, b) => a - b);
    if (!xs.length) return [101, 101];
    const q = (p: number) => xs[Math.floor(p * (xs.length - 1))];
    return [q(0.34), q(0.67)];
  }, [regions]);
  const regColor = (r?: Region) =>
    !r || !r.contracts ? "rgba(150,160,175,0.25)" : r.risk_index >= riskThr[1] ? "#ff4d4d" : r.risk_index >= riskThr[0] ? "#ffb020" : "#2bd46a";

  const style = (f?: Feature): PathOptions => ({
    fillColor: regColor(byName[(f?.properties as { region_name?: string })?.region_name ?? ""]),
    weight: 1, color: theme === "dark" ? "#0b0f15" : "#fff", fillOpacity: 0.78,
  });
  const onEach = (f: Feature, layer: Layer) => {
    const n = (f.properties as { region_name: string }).region_name, r = byName[n];
    layer.bindTooltip(`${n} - ${r && r.contracts ? r.risk_index + "% от парите през единствен участник" : "няма данни"}`, { sticky: true });
    layer.on({ click: () => setSel(r ?? { region_name: n, contracts: 0, value_eur: 0, high: 0, single_bid_pct: 0, risk_index: 0, high_pct: 0, avg_risk: 0 }) });
  };

  async function doExplain(target: string) {
    setExp((p) => ({ ...p, [target]: { loading: true, text: "" } }));
    try { const r = await explain(target); setExp((p) => ({ ...p, [target]: { loading: false, text: r.narrative ?? r.error ?? "-" } })); }
    catch { setExp((p) => ({ ...p, [target]: { loading: false, text: "AI разборът не успя. Опитай пак." } })); }
  }

  const Pill = ({ level }: { level: string }) => <span className={`ia-pill ${level}`}>{LVL[level]} риск</span>;

  return (
    <div className="ia">
      <style>{CSS}</style>
      <header className="ia-top glass">
        <Link to="/app" className="btn"><ArrowLeft size={15} weight="bold" /> Карта</Link>
        <div className="ia-brand display">Докога? <span>· Интегритет</span></div>
        <div className="ia-navr">
          <Link to="/" className="btn">Начало</Link>
          <Link to="/report" className="btn">⚠ Сигнали</Link>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="ia-main">
        <section className="ia-hero">
          <h1 className="display">Виж корупцията, не я приемай</h1>
          <p className="ia-sub">Обективни сигнали за риск в обществените поръчки на България - червени флагове, ценови аномалии и скрита обща собственост, върху отворени данни (ЦАИС ЕОП + Търговски регистър). Не присъда, а повод за проверка.</p>
          {err && <div className="ia-disc err">Бекендът не отговаря. Стартирай <span className="mono">uvicorn serve:app --port 8000</span> в backend/.</div>}
          {k && (
            <div className="ia-kpis">
              {[["Договори", fmtNum(k.contracts)], ["Обща стойност", compactEur(k.value_eur)],
                ["Високорискови", fmtNum(k.high), "red"], ["Единичен участник", k.single_bid_pct + "%", "amber"],
                ["Изпълнители", fmtNum(k.suppliers)], ["Възложители", fmtNum(k.buyers)]]
                .map(([l, v, tone], i) => (
                  <div className="ia-kpi glass" key={i}>
                    <div className="lbl">{l as string}</div>
                    <div className={`val mono ${tone ? "t-" + tone : ""}`}>{v as string}</div>
                  </div>
                ))}
            </div>
          )}
          {sum?.ml && <p className="ia-mlnote">ML добавка (leak-free, честна): предсказва неблагоприятен изход (изменян договор) с ROC-AUC {sum.ml.roc_auc.toFixed(2)}; влиза с 30% тежест, не определя флаг. Корупцията няма етикет за трениране - затова водим с одитируеми флагове, не с измислен процент.</p>}
        </section>

        <section className="ia-grid2">
          <div className="glass ia-mapcard">
            <div className="ia-cap"><h2 className="display">Горещи точки на риска</h2><span>дял от парите през единствен участник (относително) · покритие {coverage}%</span></div>
            <MapContainer className="ia-map" center={[42.73, 25.4]} zoom={7} zoomControl={false}
              scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} boxZoom={false} keyboard={false} dragging={false} attributionControl>
              <TileLayer key={theme} url={TILES[theme]} attribution="&copy; OpenStreetMap &copy; CARTO" subdomains="abcd" />
              {geo && regions.length > 0 && <GeoJSON key={theme + regions.length} data={geo} style={style} onEachFeature={onEach} />}
            </MapContainer>
            <div className="ia-legend">
              <span><i style={{ background: "#2bd46a" }} />нисък</span><span><i style={{ background: "#ffb020" }} />среден</span>
              <span><i style={{ background: "#ff4d4d" }} />висок</span><span><i style={{ background: "rgba(150,160,175,0.4)" }} />няма данни</span>
            </div>
          </div>
          <aside className="glass ia-panel">
            <div className="ia-cap"><h2 className="display">{sel ? sel.region_name : "Изберете област"}</h2></div>
            {!sel && <p className="ia-muted">Кликни върху област за разбивка.</p>}
            {sel && sel.contracts === 0 && <p className="ia-muted">Няма картирани договори за тази област.</p>}
            {sel && sel.contracts > 0 && (
              <div className="ia-stats">
                <div><span>Пари през единствен участник</span><b className="mono t-red">{sel.risk_index}%</b></div>
                <div><span>Единичен участник (брой)</span><b className="mono">{sel.single_bid_pct}%</b></div>
                <div><span>Договори</span><b className="mono">{fmtNum(sel.contracts)}</b></div>
                <div><span>Стойност</span><b className="mono">{fmtEur(sel.value_eur)}</b></div>
              </div>
            )}
          </aside>
        </section>

        <section>
          <div className="ia-cap"><h2 className="display"><Buildings size={20} weight="fill" /> Най-флагнати фирми</h2><span>най-много червени флагове, с AI разбор</span></div>
          <div className="ia-feed">
            {worstCos.map((c) => {
              const t = "company:" + c.eik, e = exp[t];
              return (
                <article className="glass ia-case" key={c.eik}>
                  <Link className="ia-coname" to={`/company/${encodeURIComponent(c.eik)}`}><b>{c.name}</b></Link>
                  <small className="ia-eik mono">ЕИК {c.eik}</small>
                  <p className="ia-desc">Спечелил <b>{compactEur(c.won_eur)}</b> по {fmtNum(c.contracts)} договора от {fmtNum(c.buyers)} възложителя · {c.single_bid_pct}% единствен участник · <span className="t-red">{fmtNum(c.flags)} флага</span></p>
                  <div className="ia-cobtns">
                    <button className="btn btn-primary ia-ai" onClick={() => doExplain(t)} disabled={e?.loading}>
                      <Sparkle size={14} weight="fill" /> {e?.loading ? "Анализ…" : "AI разбор"}
                    </button>
                    <Link className="btn ia-ai" to={`/company/${encodeURIComponent(c.eik)}`}>Профил →</Link>
                  </div>
                  {e && !e.loading && <p className="ia-narr">{e.text}</p>}
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <div className="ia-cap"><h2 className="display"><Buildings size={20} weight="fill" /> Всички фирми по риск</h2><span>{fmtNum(ranked.length)} фирми, 100% до 0% (повечето са чисти)</span></div>
          <input className="field ia-search" placeholder="Търси по име или ЕИК…" value={q} onChange={(ev) => setQ(ev.target.value)} />
          <div className="ia-ranklist">
            {filtered.slice(0, 300).map((c) => (
              <Link className="ia-rankrow" key={c.eik} to={`/company/${encodeURIComponent(c.eik)}`}>
                <span className={`ia-pill ${lvlPct(c.risk_pct)}`}>{c.risk_pct}%</span>
                <span className="ia-rank-main"><b>{c.name ?? c.eik}</b><small className="mono">ЕИК {c.eik}</small></span>
                <span className="ia-rank-n mono">{compactEur(c.won_eur)} · {fmtNum(c.contracts)} дог · {fmtNum(c.flags)} флага</span>
              </Link>
            ))}
          </div>
          <p className="ia-muted" style={{ marginTop: ".6rem", fontSize: ".8rem" }}>показани {Math.min(300, filtered.length)} от {fmtNum(filtered.length)}</p>
        </section>

        <section>
          <div className="ia-cap"><h2 className="display"><Sparkle size={20} weight="fill" /> Разследвания</h2><span>{cases.length} материални случая (по пари и риск), с доказателства</span></div>
          <div className="ia-feed">
            {cases.map((c) => {
              const e = exp[c.id];
              return (
                <article className="glass ia-case" key={c.id}>
                  <div className="ia-case-h">
                    <Pill level={c.level} />
                    <span className="ia-score mono">{c.blended}</span>
                  </div>
                  <div className="ia-amt mono">{fmtEur(c.amount_eur)}</div>
                  <div className="ia-party"><b>{c.supplier ?? "?"}</b> <span className="ia-arrow">←</span> {c.buyer ?? "?"}</div>
                  {c.obshtina && <div className="ia-obsht">{c.obshtina}</div>}
                  <ul className="ia-reasons">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  <button className="btn btn-primary ia-ai" onClick={() => doExplain(c.id)} disabled={e?.loading}>
                    <Sparkle size={14} weight="fill" /> {e?.loading ? "Анализ…" : "AI разбор"}
                  </button>
                  {e && !e.loading && <p className="ia-narr">{e.text}</p>}
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <div className="ia-cap"><h2 className="display"><ShareNetwork size={20} weight="fill" /> Скрита обща собственост</h2><span>лице зад няколко печелили (и флагнати) фирми</span></div>
          {network.length === 0 ? (
            <p className="ia-muted">Графът на собствеността е с частично покритие (нужен е пълен Търговски регистър). В текущия слой няма рискови връзки между флагнати фирми с общ собственик.</p>
          ) : (
            <div className="ia-feed">
              {network.map((n, i) => {
                const e = exp["shared-owner"];
                return (
                  <article className="glass ia-case" key={i}>
                    <div className="ia-party"><b>{n.person}</b> <span className="ia-chip">{n.id_type}</span></div>
                    <p className="ia-desc">{n.count} печелили фирми · общо <b>{compactEur(n.won_eur)}</b> · <span className="t-red">{fmtNum(n.flags)} флага</span></p>
                    <ul className="ia-reasons">{n.companies.map((co, j) => <li key={j}>{co.name ?? co.eik}</li>)}</ul>
                    <button className="btn btn-primary ia-ai" onClick={() => doExplain("shared-owner")} disabled={e?.loading}>
                      <Sparkle size={14} weight="fill" /> {e?.loading ? "Анализ…" : "AI разбор"}
                    </button>
                    {e && !e.loading && <p className="ia-narr">{e.text}</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="glass ia-list">
            <div className="ia-cap"><h2 className="display"><Users size={18} weight="fill" /> Възложители с най-висок единичен участник</h2><span>мин. 5 договора</span></div>
            {worstBuyers.map((b, i) => (
              <div className="ia-row" key={b.eik}>
                <span className="ia-rank mono">{i + 1}</span>
                <span className="ia-row-main"><b>{b.name}</b><small className="mono">{fmtNum(b.contracts)} договора · {fmtEur(b.spend_eur)}</small></span>
                <span className="ia-row-n mono t-amber">{b.single_bid_pct}%</span>
              </div>
            ))}
          </div>
        </section>

        <p className="ia-foot">Данни: ЦАИС ЕОП · Търговски регистър (CC0). Лицата са свързани чрез хеширан ЕГН, без сурови лични данни. Всеки сигнал е повод за проверка, не доказателство за нарушение.</p>
      </main>
    </div>
  );
}

const CSS = `
.ia{min-height:100vh;background:var(--bg);color:var(--ink)}
.ia-top{position:sticky;top:0;z-index:var(--z-nav);display:flex;align-items:center;gap:1rem;margin:0;padding:.6rem 1.1rem;border-radius:0;border-left:0;border-right:0;border-top:0}
.ia-brand{font-size:1rem;font-weight:700}.ia-brand span{color:var(--orange)}
.ia-navr{margin-left:auto;display:flex;align-items:center;gap:.5rem}
.ia-main{max-width:1180px;margin:0 auto;padding:1.4rem 1.1rem 3rem}
.ia-hero{margin-bottom:1.6rem}
.ia-hero h1{font-size:clamp(1.7rem,4vw,2.6rem);line-height:1.05;margin:0 0 .5rem}
.ia-sub{color:var(--ink-2);max-width:74ch;font-size:1.02rem;margin:0 0 1rem}
.ia-mlnote{color:var(--ink-3);font-size:.82rem;max-width:80ch;margin:.9rem 0 0;border-left:2px solid var(--line);padding-left:.7rem}
.ia-disc{border-radius:var(--r-sm);padding:.6rem .85rem;font-size:.85rem;margin:.6rem 0}
.ia-disc.err{background:rgba(255,77,77,.12);border:1px solid rgba(255,77,77,.4);color:var(--red)}
.ia-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem;margin-top:1rem}
.ia-kpi{padding:.8rem .95rem;min-width:0;overflow:hidden}
.ia-kpi .lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ia-kpi .val{font-size:1.4rem;font-weight:700;margin-top:.25rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.01em}
.t-red{color:var(--red)}.t-amber{color:var(--amber)}
.ia-grid2{display:grid;grid-template-columns:1fr 330px;gap:1rem;margin:1.4rem 0}
@media(max-width:880px){.ia-grid2{grid-template-columns:1fr}}
.ia-cap{display:flex;align-items:baseline;gap:.6rem;margin-bottom:.7rem}
.ia-cap h2{font-size:1.15rem;margin:0;display:flex;align-items:center;gap:.4rem}
.ia-cap h2 svg{color:var(--orange)}
.ia-cap span{margin-left:auto;color:var(--ink-3);font-size:.78rem}
.ia-mapcard{padding:.9rem}.ia-mapcard .ia-cap{padding:0 .2rem}
.ia-map{height:54vh;min-height:380px;width:100%;border-radius:var(--r-sm);overflow:hidden}
.ia-legend{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:.6rem;font-size:.76rem;color:var(--ink-3);padding:0 .2rem}
.ia-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:.3rem;vertical-align:-1px}
.ia-panel{padding:1rem}
.ia-muted{color:var(--ink-3);font-size:.9rem}
.ia-stats div{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--line);font-size:.9rem}
.ia-stats b{font-weight:700}
.ia-feed{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:.9rem}
.ia-case{padding:1rem;display:flex;flex-direction:column;gap:.1rem}
.ia-case-h{display:flex;align-items:center;justify-content:space-between}
.ia-score{color:var(--ink-3);font-size:.85rem}
.ia-pill{font-size:.72rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;text-transform:uppercase;letter-spacing:.03em}
.ia-pill.high{background:rgba(255,77,77,.16);color:var(--red)}
.ia-pill.med{background:rgba(255,176,32,.16);color:var(--amber)}
.ia-pill.low{background:rgba(43,212,106,.16);color:var(--green)}
.ia-amt{font-size:1.45rem;font-weight:700;margin:.35rem 0 .1rem}
.ia-party{font-size:.92rem;color:var(--ink-2);line-height:1.4}.ia-party b{color:var(--ink)}
.ia-arrow{color:var(--orange);font-weight:700}
.ia-obsht{display:inline-block;margin-top:.4rem;font-size:.74rem;font-weight:600;color:var(--cool);background:rgba(91,200,214,.12);border-radius:6px;padding:.1rem .45rem}
.ia-eik{color:var(--ink-3);font-size:.72rem}
.ia-desc{font-size:.85rem;color:var(--ink-2);line-height:1.5;margin:.5rem 0 .2rem}.ia-desc b{color:var(--ink)}
.ia-coname{color:var(--ink);text-decoration:none;font-size:1.02rem}.ia-coname:hover b{color:var(--orange)}
.ia-cobtns{display:flex;gap:.5rem;margin-top:.7rem;flex-wrap:wrap}
.ia-cobtns .ia-ai{margin-top:0;text-decoration:none}
.ia-search{margin:.4rem 0 .9rem;max-width:420px}
.ia-ranklist{display:flex;flex-direction:column;gap:.3rem}
.ia-rankrow{display:flex;align-items:center;gap:.7rem;padding:.5rem .7rem;border-radius:var(--r-sm);background:var(--surface);border:1px solid var(--line);text-decoration:none;color:var(--ink);transition:background .15s var(--ease)}
.ia-rankrow:hover{background:var(--control)}
.ia-rankrow .ia-pill{min-width:48px;text-align:center}
.ia-rank-main{flex:1;min-width:0;display:flex;flex-direction:column}
.ia-rank-main b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.9rem}
.ia-rank-main small{color:var(--ink-3);font-size:.7rem}
.ia-rank-n{color:var(--ink-2);font-size:.78rem;white-space:nowrap}
.ia-chip{display:inline-block;background:var(--control);color:var(--ink-3);border-radius:6px;padding:.05rem .35rem;font-size:.68rem;font-family:"JetBrains Mono",monospace}
.ia-reasons{list-style:none;margin:.6rem 0 .2rem;padding:0;display:flex;flex-direction:column;gap:.3rem}
.ia-reasons li{font-size:.84rem;color:var(--ink-2);padding-left:1rem;position:relative}
.ia-reasons li::before{content:"";position:absolute;left:0;top:.5em;width:6px;height:6px;border-radius:50%;background:var(--orange)}
.ia-ai{align-self:flex-start;margin-top:.7rem;padding:.5rem .9rem;font-size:.82rem;display:inline-flex;align-items:center;gap:.35rem}
.ia-narr{margin:.7rem 0 0;font-size:.86rem;line-height:1.55;color:var(--ink-2);background:var(--control);border-radius:var(--r-sm);padding:.7rem .8rem}
.ia-list{padding:1rem}
.ia-row{display:flex;align-items:center;gap:.7rem;padding:.5rem 0;border-bottom:1px solid var(--line)}
.ia-rank{color:var(--ink-3);font-size:.8rem;width:1.4rem;text-align:right}
.ia-row-main{flex:1;min-width:0;display:flex;flex-direction:column}
.ia-row-main b{font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ia-row-main small{color:var(--ink-3);font-size:.72rem}
.ia-row-n{font-size:.8rem;color:var(--ink-2);white-space:nowrap}
.ia-foot{margin-top:1.6rem;color:var(--ink-3);font-size:.78rem;text-align:center}
`;
