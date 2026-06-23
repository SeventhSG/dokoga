import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Sparkle } from "@phosphor-icons/react";
import { useTheme } from "../theme";
import ThemeToggle from "../components/ThemeToggle";
import { getCompany, explain, fmtEur, fmtNum, type CompanyDetail } from "../lib/integrityApi";

const LVL: Record<string, string> = { low: "нисък", med: "среден", high: "висок" };
const lvlOf = (pct: number) => (pct >= 66 ? "high" : pct >= 33 ? "med" : "low");

export default function Company() {
  const { eik = "" } = useParams();
  const { theme, toggle } = useTheme();
  const [d, setD] = useState<CompanyDetail | null>(null);
  const [err, setErr] = useState(false);
  const [ai, setAi] = useState<{ loading: boolean; text: string } | null>(null);

  useEffect(() => {
    setD(null); setErr(false);
    getCompany(eik).then((r) => (r && r.eik ? setD(r) : setErr(true))).catch(() => setErr(true));
  }, [eik]);

  async function doAi() {
    setAi({ loading: true, text: "" });
    try { const r = await explain("company:" + eik); setAi({ loading: false, text: r.narrative ?? r.error ?? "-" }); }
    catch { setAi({ loading: false, text: "AI разборът не успя." }); }
  }

  const maxYear = d ? Math.max(1, ...d.by_year.map((y) => y.value_eur)) : 1;

  return (
    <div className="cp">
      <style>{CSS}</style>
      <header className="cp-top glass">
        <Link to="/analytics" className="btn"><ArrowLeft size={15} weight="bold" /> Анализи</Link>
        <div className="cp-brand display">Докога? <span>· Фирма</span></div>
        <div style={{ marginLeft: "auto" }}><ThemeToggle theme={theme} onToggle={toggle} /></div>
      </header>

      <main className="cp-main">
        {err && <p className="cp-muted">Фирмата не е намерена или бекендът не отговаря.</p>}
        {!d && !err && <p className="cp-muted">Зареждане…</p>}
        {d && (
          <>
            <section className="cp-head">
              <h1 className="display">{d.name ?? d.eik}</h1>
              <div className="cp-sub">
                <span className="mono">ЕИК {d.eik}</span>
                {d.legal_form && <span className="cp-chip">{d.legal_form}</span>}
                <span className={`cp-pill ${lvlOf(d.risk_pct)}`}>{LVL[lvlOf(d.risk_pct)]} риск · {d.risk_pct}%</span>
              </div>
            </section>

            <section className="cp-kpis">
              {[["Спечелено", fmtEur(d.won_eur)], ["Договори", fmtNum(d.contracts)],
                ["Възложители", fmtNum(d.buyers)], ["Единичен участник", d.single_bid_pct + "%"]]
                .map(([l, v], i) => (
                  <div className="cp-kpi glass" key={i}><div className="lbl">{l}</div><div className="val mono">{v}</div></div>
                ))}
            </section>

            {d.by_year.length > 0 && (
              <section className="card glass">
                <h2 className="display">Спечелено по години</h2>
                <div className="cp-bars">
                  {d.by_year.map((y) => (
                    <div className="cp-barrow" key={y.year}>
                      <span className="cp-year mono">{y.year}</span>
                      <span className="cp-track"><span className="cp-fill" style={{ width: `${(100 * y.value_eur) / maxYear}%` }} /></span>
                      <span className="cp-bn mono">{fmtEur(y.value_eur)} · {y.contracts} дог.</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {Object.keys(d.flags).length > 0 && (
              <section className="card glass">
                <h2 className="display">Флагове</h2>
                <div className="cp-chips">{Object.entries(d.flags).map(([c, n]) => <span className="cp-chip" key={c}>{c} · {n}</span>)}</div>
              </section>
            )}

            <section className="card glass">
              <h2 className="display">Защо е маркирана</h2>
              <button className="btn btn-primary cp-ai" onClick={doAi} disabled={ai?.loading}>
                <Sparkle size={14} weight="fill" /> {ai?.loading ? "Анализ…" : "AI разбор"}
              </button>
              {ai && !ai.loading && <p className="cp-narr">{ai.text}</p>}
              <p className="cp-mlnote">{d.ml_why}</p>
            </section>

            {d.suspicious.length > 0 && (
              <section className="card glass">
                <h2 className="display">Подозрителни договори</h2>
                {d.suspicious.map((s) => (
                  <div className="cp-susp" key={s.id}>
                    <div className="cp-susp-h">
                      <b className="mono">{fmtEur(s.amount_eur)}</b>
                      <span className={`cp-pill ${lvlOf(Math.round(s.risk * 100))}`}>{Math.round(s.risk * 100)}%</span>
                    </div>
                    <div className="cp-muted">{s.buyer ?? "?"}{s.obshtina ? ` · ${s.obshtina}` : ""}</div>
                    <ul className="cp-reasons">{s.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                ))}
              </section>
            )}

            <section className="card glass">
              <h2 className="display">Собственици и управители</h2>
              {d.owners.length === 0 ? (
                <p className="cp-muted">Няма данни за собственост (Търговски регистър с частично покритие).</p>
              ) : (
                <div className="cp-owners">
                  {d.owners.map((o, i) => (
                    <Link className="cp-owner" key={i} to={`/person/${encodeURIComponent(o.person_key)}`}>
                      <span className="cp-owner-nm">{o.name ?? o.person_key}</span>
                      <span className="cp-owner-meta">{o.role} · доход: няма данни</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <p className="cp-foot">Сигнал за проверка по обективни индикатори, не доказателство за нарушение. Доходът на собственици не е в отворените данни.</p>
          </>
        )}
      </main>
    </div>
  );
}

const CSS = `
.cp{min-height:100vh;background:var(--bg);color:var(--ink)}
.cp-top{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:1rem;padding:.6rem 1.1rem;border-radius:0;border-left:0;border-right:0;border-top:0}
.cp-brand{font-weight:700}.cp-brand span{color:var(--orange)}
.cp-main{max-width:920px;margin:0 auto;padding:1.3rem 1.1rem 3rem}
.cp-muted{color:var(--ink-3)}
.cp-head h1{font-size:clamp(1.5rem,3.5vw,2.2rem);margin:0 0 .5rem}
.cp-sub{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;color:var(--ink-3);font-size:.85rem}
.cp-chip{background:var(--control);color:var(--ink-2);border-radius:6px;padding:.1rem .45rem;font-size:.75rem;font-family:"JetBrains Mono",monospace}
.cp-pill{font-size:.75rem;font-weight:700;padding:.15rem .55rem;border-radius:999px}
.cp-pill.high{background:rgba(255,77,77,.16);color:var(--red)}
.cp-pill.med{background:rgba(255,176,32,.16);color:var(--amber)}
.cp-pill.low{background:rgba(43,212,106,.16);color:var(--green)}
.cp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.7rem;margin:1.1rem 0}
.cp-kpi{padding:.8rem .95rem;overflow:hidden}
.cp-kpi .lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);font-weight:700}
.cp-kpi .val{font-size:1.35rem;font-weight:700;margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card{padding:1rem 1.1rem;margin-bottom:1.1rem}
.card h2{font-size:1.05rem;margin:0 0 .7rem}
.cp-bars{display:grid;gap:.5rem}
.cp-barrow{display:grid;grid-template-columns:54px 1fr auto;align-items:center;gap:.6rem;font-size:.82rem}
.cp-year{color:var(--ink-3)}
.cp-track{background:var(--control);border-radius:6px;height:14px;overflow:hidden}
.cp-fill{height:100%;background:linear-gradient(90deg,var(--orange-2),var(--orange));border-radius:6px}
.cp-bn{color:var(--ink-2);white-space:nowrap}
.cp-chips{display:flex;flex-wrap:wrap;gap:.4rem}
.cp-ai{display:inline-flex;align-items:center;gap:.35rem;font-size:.82rem;padding:.5rem .9rem}
.cp-narr{margin:.7rem 0 0;font-size:.88rem;line-height:1.55;color:var(--ink-2);background:var(--control);border-radius:var(--r-sm);padding:.7rem .8rem}
.cp-mlnote{margin:.7rem 0 0;font-size:.78rem;color:var(--ink-3);border-left:2px solid var(--line);padding-left:.7rem;line-height:1.5}
.cp-susp{padding:.6rem 0;border-bottom:1px solid var(--line)}
.cp-susp-h{display:flex;align-items:center;justify-content:space-between}
.cp-reasons{list-style:none;margin:.4rem 0 0;padding:0;display:flex;flex-direction:column;gap:.25rem}
.cp-reasons li{font-size:.82rem;color:var(--ink-2);padding-left:.9rem;position:relative}
.cp-reasons li::before{content:"";position:absolute;left:0;top:.5em;width:5px;height:5px;border-radius:50%;background:var(--orange)}
.cp-owners{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.6rem}
.cp-owner{display:flex;flex-direction:column;gap:.15rem;padding:.6rem .8rem;background:var(--control);border-radius:var(--r-sm);text-decoration:none;color:var(--ink);transition:background .15s var(--ease)}
.cp-owner:hover{background:var(--control-h)}
.cp-owner-nm{font-weight:600}
.cp-owner-meta{font-size:.74rem;color:var(--ink-3)}
.cp-foot{margin-top:1.3rem;color:var(--ink-3);font-size:.78rem;text-align:center}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
