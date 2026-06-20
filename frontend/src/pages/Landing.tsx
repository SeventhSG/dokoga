import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  MapTrifold, ArrowRight, Database, Brain, MapPin,
  FlowArrow, ChartLineUp, Scales, ShieldCheck, GitBranch,
  ArrowsClockwise, ClockCounterClockwise, Megaphone,
} from "@phosphor-icons/react";
import { useTheme } from "../theme";
import ThemeToggle from "../components/ThemeToggle";
import DelayBar from "../components/DelayBar";
import Predictor from "../components/Predictor";
import CountUp from "../components/CountUp";
import Logo from "../components/Logo";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const LIFT = { whileHover: { y: -4 }, transition: { duration: 0.25, ease: EASE } };

const STATS = [
  { node: <CountUp to={25980} />, l: "договора анализирани" },
  { node: <CountUp to={6.5} decimals={1} suffix="%" />, l: "се проточват над срока" },
  { node: <CountUp to={827} prefix="до +" />, l: "дни забавяне" },
];

const STEPS = [
  { icon: Database, t: "Събираме данните", d: "25 980 договора за обществени поръчки от ЦАИС ЕОП (data.egov.bg), по стандарт OCDS." },
  { icon: Brain, t: "AI оценява риска", d: "LightGBM модел учи кои договори се удължават, по стойност, регион, сезон и изпълнител." },
  { icon: MapPin, t: "Виждаш го на картата", d: "Всеки ремонт е точка, оцветена по риск. Питай AI-я на български за всяка област." },
];

// — AI fluency: how the model is justified and why it doesn't hallucinate —
const AI = [
  {
    icon: FlowArrow,
    t: "Изтегли → разкажи",
    d: "Чатът никога не смята сам. Рутер избира заявка, SQLite връща верните числа, LLM-ът само ги разказва на български. Нула халюцинирани цифри.",
  },
  {
    icon: ChartLineUp,
    t: "Истински ML, не за украса",
    d: "LightGBM рисков модел: ROC-AUC 0.637, PR-AUC 0.138 — 2.1× над случайното. Най-силни сигнали: стойност, обещан срок и месец на старт.",
  },
  {
    icon: Scales,
    t: "Честно за границите",
    d: "Регресорът за дни не бие baseline (само 289 просрочени примера) — затова показваме медиана по сегмент, не измислено число. Не крием слабостите.",
  },
];

// — data integrity / method: visible on the page, not just in the README —
const METHOD = [
  { k: "Източник", v: "ЦАИС ЕОП по стандарт OCDS, през data.egov.bg (АОП). Лиценз CC0 — публични, отворени данни." },
  { k: "Етикет", v: "Групиране по ocid → планиран край спрямо финалния (след анекси) = просрочване в дни. 4 470 договора със срок, 289 просрочени." },
  { k: "Долна граница", v: "Публикуван е само 2026 — отворените ремонти още не са просрочени. Реалните забавяния са по-големи от показаните." },
  { k: "Етика", v: "Изходът е „риск / червени флагове“ по история, не обвинение в измама на конкретна фирма." },
];

// — sustainability: how this lives beyond the weekend —
const NEXT = [
  { icon: ArrowsClockwise, t: "Сам се обновява", d: "OCDS пакетите излизат на всеки две седмици. Pipeline-ът (scripts 04→07) се пуска наново и моделът се претренира — без ръчна работа." },
  { icon: ClockCounterClockwise, t: "Назад във времето", d: "Добавяне на архива 2024–2025 → стотици завършени договори повече → по-точен етикет и по-силен модел." },
  { icon: GitBranch, t: "Отворено за всеки", d: "Кодът е публичен, данните са CC0. Готов API за журналисти, общини и граждани, които искат да проверят свой ремонт." },
  { icon: Megaphone, t: "Граждански натиск", d: "Споделяема карта на всеки ремонт → личен, вирусен сигнал → реална обществена прозрачност, а не още един dashboard." },
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
        <Link to="/" className="lp-brand">
          <Logo size={34} className="logo-rounded" />
          <span className="lp-mark display">
            ДОКОГА<span style={{ color: "var(--orange)" }}>?</span>
          </span>
        </Link>
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
        {STATS.map((s, i) => (
          <motion.div className="lp-stat" key={s.l} {...fade(i * 0.08)}>
            <div className="lp-stat-n display mono">{s.node}</div>
            <div className="lp-stat-l">{s.l}</div>
          </motion.div>
        ))}
      </section>

      <section className="lp-steps">
        <motion.h2 className="lp-h2 display" {...fade()}>
          Как работи
        </motion.h2>
        <div className="lp-steps-grid">
          {STEPS.map((s, i) => (
            <motion.div className="lp-step" key={s.t} {...fade(i * 0.1)} {...(reduce ? {} : LIFT)}>
              <span className="lp-step-no mono">0{i + 1}</span>
              <s.icon size={26} weight="duotone" className="lp-step-ic" />
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="lp-trust">
        <motion.div className="lp-trust-head" {...fade()}>
          <span className="lp-eyebrow mono"><Brain size={14} weight="bold" /> AI, на който можеш да вярваш</span>
          <h2 className="lp-h2 display">Числата са верни. AI-ят само ги разказва.</h2>
        </motion.div>
        <div className="lp-trust-grid">
          {AI.map((c, i) => (
            <motion.div className="lp-trust-card glass" key={c.t} {...fade(i * 0.08)} {...(reduce ? {} : LIFT)}>
              <c.icon size={26} weight="duotone" className="lp-trust-ic" />
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="lp-method">
        <motion.div className="lp-method-head" {...fade()}>
          <span className="lp-eyebrow mono"><ShieldCheck size={14} weight="bold" /> Метод и почтеност</span>
          <h2 className="lp-h2 display">Откъде идват данните и как смятаме</h2>
          <p>Прозрачно за източника, етикета и границите — за да можеш да провериш всяко число.</p>
        </motion.div>
        <div className="lp-method-grid">
          {METHOD.map((m, i) => (
            <motion.div className="lp-method-row" key={m.k} {...fade(i * 0.06)}>
              <span className="lp-method-k mono">{m.k}</span>
              <span className="lp-method-v">{m.v}</span>
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

      <section className="lp-next">
        <motion.div className="lp-next-head" {...fade()}>
          <span className="lp-eyebrow mono"><ArrowsClockwise size={14} weight="bold" /> Отвъд уикенда</span>
          <h2 className="lp-h2 display">Замислен да живее, не да остане демо</h2>
        </motion.div>
        <div className="lp-next-grid">
          {NEXT.map((n, i) => (
            <motion.div className="lp-next-card" key={n.t} {...fade(i * 0.08)} {...(reduce ? {} : LIFT)}>
              <n.icon size={24} weight="duotone" className="lp-next-ic" />
              <div>
                <h3>{n.t}</h3>
                <p>{n.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="lp-footer">
        <Logo size={64} className="logo-rounded lp-footer-logo" />
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
