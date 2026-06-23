import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import { useTheme } from "../theme";
import ThemeToggle from "../components/ThemeToggle";
import { getPerson, fmtEur, fmtNum, type PersonDetail } from "../lib/integrityApi";

export default function Person() {
  const { hash = "" } = useParams();
  const { theme, toggle } = useTheme();
  const [d, setD] = useState<PersonDetail | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setD(null); setErr(false);
    getPerson(hash).then((r) => (r && !("error" in r) ? setD(r) : setErr(true))).catch(() => setErr(true));
  }, [hash]);

  return (
    <div className="pp">
      <style>{CSS}</style>
      <header className="pp-top glass">
        <Link to="/analytics" className="btn"><ArrowLeft size={15} weight="bold" /> Анализи</Link>
        <div className="pp-brand display">Докога? <span>· Лице</span></div>
        <div style={{ marginLeft: "auto" }}><ThemeToggle theme={theme} onToggle={toggle} /></div>
      </header>

      <main className="pp-main">
        {err && <p className="pp-muted">Лицето не е намерено или бекендът не отговаря.</p>}
        {!d && !err && <p className="pp-muted">Зареждане…</p>}
        {d && (
          <>
            <section className="pp-head">
              <h1 className="display">{d.name ?? "Свързано лице"}</h1>
              <div className="pp-sub">
                <span className="pp-chip">{d.id_type ?? "лице"}</span>
                <span>общо спечелено от свързаните фирми: <b className="mono">{fmtEur(d.total_won_eur)}</b></span>
                <span>доход: няма данни</span>
              </div>
            </section>

            <section className="card glass">
              <h2 className="display">Свързани фирми</h2>
              {d.companies.length === 0 ? (
                <p className="pp-muted">Няма свързани фирми в текущия слой данни.</p>
              ) : (
                <div className="pp-list">
                  {d.companies.map((c) => (
                    <Link className="pp-row" key={c.eik} to={`/company/${encodeURIComponent(c.eik)}`}>
                      <span className="pp-row-main"><b>{c.name ?? c.eik}</b><small className="mono">ЕИК {c.eik} · {c.role}</small></span>
                      <span className="pp-row-n mono">{fmtEur(c.won_eur)} · {fmtNum(c.contracts)} дог.</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <p className="pp-foot">Лицата са свързани чрез хеширан ЕГН - без сурови лични данни. Доходът не е в отворените данни. Сигнал за проверка, не доказателство.</p>
          </>
        )}
      </main>
    </div>
  );
}

const CSS = `
.pp{min-height:100vh;background:var(--bg);color:var(--ink)}
.pp-top{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:1rem;padding:.6rem 1.1rem;border-radius:0;border-left:0;border-right:0;border-top:0}
.pp-brand{font-weight:700}.pp-brand span{color:var(--orange)}
.pp-main{max-width:820px;margin:0 auto;padding:1.3rem 1.1rem 3rem}
.pp-muted{color:var(--ink-3)}
.pp-head h1{font-size:clamp(1.5rem,3.5vw,2.1rem);margin:0 0 .5rem}
.pp-sub{display:flex;flex-wrap:wrap;gap:.7rem;align-items:center;color:var(--ink-3);font-size:.85rem}
.pp-sub b{color:var(--ink)}
.pp-chip{background:var(--control);color:var(--ink-2);border-radius:6px;padding:.1rem .45rem;font-size:.75rem;font-family:"JetBrains Mono",monospace}
.card{padding:1rem 1.1rem;margin-top:1.1rem}
.card h2{font-size:1.05rem;margin:0 0 .7rem}
.pp-list{display:grid;gap:.5rem}
.pp-row{display:flex;align-items:center;justify-content:space-between;gap:.7rem;padding:.6rem .8rem;background:var(--control);border-radius:var(--r-sm);text-decoration:none;color:var(--ink);transition:background .15s var(--ease)}
.pp-row:hover{background:var(--control-h)}
.pp-row-main{display:flex;flex-direction:column}
.pp-row-main small{color:var(--ink-3);font-size:.72rem}
.pp-row-n{color:var(--ink-2);font-size:.82rem;white-space:nowrap}
.pp-foot{margin-top:1.3rem;color:var(--ink-3);font-size:.78rem;text-align:center}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
