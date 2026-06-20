import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { MapTrifold, ArrowRight, Database, Brain, MapPin } from "@phosphor-icons/react";
import { useTheme } from "../theme";
import ThemeToggle from "../components/ThemeToggle";
import DelayBar from "../components/DelayBar";
import Predictor from "../components/Predictor";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const STEPS = [
  { icon: Database, t: "Събираме данните", d: "25 980 договора за обществени поръчки от ЦАИС ЕОП (data.egov.bg), по стандарт OCDS." },
  { icon: Brain, t: "AI оценява риска", d: "LightGBM модел учи кои договори се удължават, по стойност, регион, сезон и изпълнител." },
  { icon: MapPin, t: "Виждаш го на картата", d: "Всеки ремонт е точка, оцветена по риск. Питай AI-я на български за всяка област." },
];

export default function Landing() {
  const { theme, toggle } = useTheme();
  const reduce = useReducedMotion();
  // animate on mount (not whileInView) so content is never gated behind an
  // observer that may not fire in headless/hidden contexts
  const fade = (d = 0) =>
    reduce ? {} : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: d, ease: EASE } };

  return (
    <div className="lp">
      <nav className="lp-nav">
        <span className="lp-mark display">
          ДОКОГА<span style={{ color: "var(--orange)" }}>?</span>
        </span>
        <div className="lp-nav-r">
          <ThemeToggle theme={theme} onToggle={toggle} />
          <Link to="/app" className="btn btn-primary">
            Виж картата <ArrowRight size={15} weight="bold" />
          </Link>
        </div>
      </nav>

      <header className="lp-hero">
        <motion.div className="lp-hero-l" {...(reduce ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: EASE } })}>
          <h1 className="display">
            Кога РЕАЛНО
            <br />
            свършва ремонтът?
          </h1>
          <p className="lp-sub">
            Обществените ремонти в България системно се проточват. ДОКОГА предсказва реалното
            забавяне по данни от обществените поръчки.
          </p>
          <div className="lp-cta">
            <Link to="/app" className="btn btn-primary lg">
              <MapTrifold size={18} weight="fill" /> Виж картата
            </Link>
            <a href="#predict" className="btn lg">
              Провери ремонт
            </a>
          </div>
        </motion.div>

        <motion.div className="lp-hero-viz glass" {...(reduce ? {} : { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.7, delay: 0.15, ease: EASE } })}>
          <div className="viz-row">
            <span className="viz-place">ул. „Раковски“</span>
            <span className="viz-days mono">+218 дни</span>
          </div>
          <DelayBar planned={90} overrun={128} height={16} capSize={20} />
          <div className="viz-legend">
            <span><i style={{ background: "var(--cool)" }} />обещан срок</span>
            <span><i style={{ background: "var(--red)" }} />реално</span>
          </div>
          <div className="viz-split">
            <div>
              <div className="viz-n mono">90</div>
              <div className="viz-l">обещани дни</div>
            </div>
            <div>
              <div className="viz-n mono" style={{ color: "var(--red)" }}>308</div>
              <div className="viz-l">реални дни</div>
            </div>
          </div>
        </motion.div>
      </header>

      <section className="lp-stats">
        {[
          ["25 980", "договора анализирани"],
          ["6.5%", "се проточват над срока"],
          ["до +827", "дни забавяне"],
        ].map(([n, l], i) => (
          <motion.div className="lp-stat" key={l} {...fade(i * 0.08)}>
            <div className="lp-stat-n display mono">{n}</div>
            <div className="lp-stat-l">{l}</div>
          </motion.div>
        ))}
      </section>

      <section className="lp-steps">
        <motion.h2 className="lp-h2 display" {...fade()}>
          Как работи
        </motion.h2>
        <div className="lp-steps-grid">
          {STEPS.map((s, i) => (
            <motion.div className="lp-step" key={s.t} {...fade(i * 0.1)}>
              <span className="lp-step-no mono">0{i + 1}</span>
              <s.icon size={26} weight="duotone" className="lp-step-ic" />
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="lp-predict" id="predict">
        <motion.div className="lp-predict-head" {...fade()}>
          <h2 className="lp-h2 display">Провери своя ремонт</h2>
          <p>Въведи данните на договора и виж очаквания риск от просрочване.</p>
        </motion.div>
        <motion.div className="glass lp-predict-card" {...fade(0.1)}>
          <Predictor />
        </motion.div>
      </section>

      <footer className="lp-footer">
        <span className="display lp-mark">
          ДОКОГА<span style={{ color: "var(--orange)" }}>?</span>
        </span>
        <p>
          Данни: Агенция по обществени поръчки чрез data.egov.bg (CC0). Изходът е оценка по
          исторически данни, не обвинение в измама. ZaraHack 2026.
        </p>
        <Link to="/app" className="btn">
          Виж картата <ArrowRight size={15} weight="bold" />
        </Link>
      </footer>
    </div>
  );
}
