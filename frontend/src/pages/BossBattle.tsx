import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Lightning, Timer, CheckCircle, XCircle,
  Skull, Trophy, Warning, Sword, Shield,
} from "@phosphor-icons/react";
import { useTheme } from "../theme";
import ThemeToggle from "../components/ThemeToggle";

const API = import.meta.env.VITE_API_URL ?? "";
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Question {
  id: number;
  type: "multiple_choice" | "true_false" | "short_answer";
  difficulty: "easy" | "medium" | "hard";
  points: number;
  text: string;
  options: string[];
  correct: string;
  teacher_trap: boolean;
  explanation: string;
}
interface Exam {
  exam_title: string;
  teacher_name: string;
  subject: string;
  grade: string;
  time_limit_minutes: number;
  total_points: number;
  rony_taunt: string;
  questions: Question[];
  passing_score: number;
  win_message: string;
  lose_message: string;
}
interface BattleData { rony_buildup: string; exam: Exam; }
interface ScoreResult {
  score: number; max_score: number; percentage: number; passed: boolean;
  results: Array<{
    id: number; correct: boolean; user_answer: string;
    correct_answer: string; points_earned: number; points_possible: number;
    explanation: string; teacher_trap: boolean;
  }>;
}

type Phase = "setup" | "buildup" | "exam" | "results";

// ── Helpers ───────────────────────────────────────────────────────────────────
const SUBJECTS = ["Математика","Физика","Химия","Биология","История","Литература","Английски","Информатика","География","Философия"];
const GRADES   = ["8 клас","9 клас","10 клас","11 клас","12 клас"];
const diffColor = (d: string) => d === "hard" ? "var(--red)" : d === "medium" ? "var(--amber)" : "var(--green)";

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── HP Bar ────────────────────────────────────────────────────────────────────
function HpBar({ pct, label, color }: { pct: number; label: string; color: string }) {
  return (
    <div className="bb-hp-wrap">
      <span className="bb-hp-label">{label}</span>
      <div className="bb-hp-track">
        <motion.div
          className="bb-hp-fill"
          initial={{ width: "100%" }}
          animate={{ width: `${Math.max(0, pct)}%` }}
          style={{ background: color }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>
      <span className="bb-hp-pct">{Math.round(pct)}%</span>
    </div>
  );
}

// ── Setup Phase ───────────────────────────────────────────────────────────────
function SetupPhase({ onStart }: { onStart: (cfg: {
  teacher_name: string; subject: string; grade: string;
  style: string; num_questions: number; time_limit_minutes: number;
}) => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState(GRADES[3]);
  const [style, setStyle] = useState("");
  const [questions, setQuestions] = useState(8);
  const [time, setTime] = useState(30);

  const ready = name.trim().length >= 2;

  return (
    <motion.div className="bb-setup glass"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}>
      <div className="bb-setup-icon"><Skull size={48} weight="duotone" /></div>
      <h2 className="bb-setup-title display">Кой е босът?</h2>
      <p className="bb-setup-sub">Настрой профила на учителя — AI ще го миmира точно.</p>

      <div className="bb-form">
        <label className="bb-label">
          Г-жа / Г-н (пълно наименование)
          <input
            className="field"
            placeholder="напр. Г-жа Иванова"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={80}
          />
        </label>

        <div className="bb-row-2">
          <label className="bb-label">
            Предмет
            <select className="field" value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="bb-label">
            Клас
            <select className="field" value={grade} onChange={e => setGrade(e.target.value)}>
              {GRADES.map(g => <option key={g}>{g}</option>)}
            </select>
          </label>
        </div>

        <label className="bb-label">
          Стил / репутация на учителя <span className="bb-opt">(по избор)</span>
          <textarea
            className="field bb-textarea"
            placeholder="напр. Строга, много капани с отрицания, обича дефиниции наизуст, топ въпрос — запиши формулата за..."
            value={style}
            onChange={e => setStyle(e.target.value)}
            maxLength={400}
            rows={3}
          />
        </label>

        <div className="bb-row-2">
          <label className="bb-label">
            Брой въпроси: <strong>{questions}</strong>
            <input type="range" min={4} max={12} value={questions}
              onChange={e => setQuestions(+e.target.value)} className="bb-range" />
          </label>
          <label className="bb-label">
            Времe: <strong>{time} мин</strong>
            <input type="range" min={10} max={60} step={5} value={time}
              onChange={e => setTime(+e.target.value)} className="bb-range" />
          </label>
        </div>

        <motion.button
          className="bb-start-btn btn-primary"
          disabled={!ready}
          whileHover={ready ? { scale: 1.03 } : {}}
          whileTap={ready ? { scale: 0.97 } : {}}
          onClick={() => onStart({ teacher_name: name.trim(), subject, grade, style, num_questions: questions, time_limit_minutes: time })}
        >
          <Sword size={20} weight="bold" />
          Влез в битката
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Buildup Phase ─────────────────────────────────────────────────────────────
function BuildupPhase({ data, onReady }: { data: BattleData; onReady: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 400); return () => clearTimeout(t); }, []);

  return (
    <motion.div className="bb-buildup"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      <motion.div className="bb-boss-card glass"
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.7, ease: EASE }}>

        <div className="bb-boss-avatar">
          <motion.div className="bb-boss-aura"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} />
          <Skull size={72} weight="duotone" style={{ color: "var(--red)", position: "relative", zIndex: 1 }} />
        </div>

        <motion.h2 className="bb-boss-name display"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}>
          {data.exam.teacher_name}
        </motion.h2>
        <div className="bb-boss-meta">
          {data.exam.subject} · {data.exam.grade} · {data.exam.time_limit_minutes} мин
        </div>

        <AnimatePresence>
          {shown && (
            <motion.div className="bb-rony-bubble"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}>
              <Lightning size={16} weight="fill" style={{ color: "var(--amber)", flexShrink: 0 }} />
              <p>"{data.rony_buildup}"</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="bb-boss-stats"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <div className="bb-boss-stat"><span>{data.exam.questions.length}</span>въпроса</div>
          <div className="bb-boss-stat"><span>{data.exam.total_points}</span>точки</div>
          <div className="bb-boss-stat" style={{ color: "var(--red)" }}>
            <span>{data.exam.questions.filter(q => q.teacher_trap).length}</span>капана
          </div>
        </motion.div>

        <motion.button className="bb-fight-btn btn-primary"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
          onClick={onReady}>
          <Lightning size={18} weight="fill" /> Започни изпита!
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── Exam Phase ─────────────────────────────────────────────────────────────────
function ExamPhase({ exam, onSubmit }: { exam: Exam; onSubmit: (answers: Record<string, string>) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(exam.time_limit_minutes * 60);
  const [urgent, setUrgent] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); onSubmit(answers); return 0; }
        if (t <= 60) setUrgent(true);
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, []);  // eslint-disable-line

  const q = exam.questions[current];
  const answered = answers[String(q.id)];
  const progress = Object.keys(answers).length / exam.questions.length;
  const studentHp = Math.max(0, 100 - (Object.values(answers).filter((_, i) => {
    const qi = exam.questions[i]; return qi && answers[String(qi.id)] !== undefined;
  }).length / exam.questions.length) * 20);

  function setAnswer(val: string) {
    setAnswers(prev => ({ ...prev, [String(q.id)]: val }));
  }

  function next() {
    if (current < exam.questions.length - 1) setCurrent(c => c + 1);
  }
  function prev() { if (current > 0) setCurrent(c => c - 1); }

  const allAnswered = Object.keys(answers).length === exam.questions.length;

  return (
    <div className="bb-exam">
      {/* Header HUD */}
      <div className="bb-exam-hud glass">
        <HpBar pct={100} label={exam.teacher_name} color="var(--red)" />
        <div className={`bb-timer mono ${urgent ? "bb-timer-urgent" : ""}`}>
          <Timer size={18} weight="bold" />
          {fmt(timeLeft)}
        </div>
        <HpBar pct={Math.min(100, (1 - progress) * 100 + 20)} label="Ти" color="var(--green)" />
      </div>

      {/* Rony taunt */}
      <div className="bb-taunt-bar">
        <Lightning size={14} weight="fill" style={{ color: "var(--amber)" }} />
        <span>"{exam.rony_taunt}"</span>
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div key={q.id} className="bb-q-card glass"
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: EASE }}>

          <div className="bb-q-header">
            <span className="bb-q-num mono">В{current + 1}/{exam.questions.length}</span>
            <span className="bb-q-pts mono">{q.points}т</span>
            <span className="bb-q-diff" style={{ color: diffColor(q.difficulty) }}>
              {q.difficulty === "hard" ? "🔴 Трудно" : q.difficulty === "medium" ? "🟡 Средно" : "🟢 Лесно"}
            </span>
            {q.teacher_trap && (
              <span className="bb-trap-badge"><Warning size={12} weight="fill" /> Капан</span>
            )}
          </div>

          <p className="bb-q-text">{q.text}</p>

          {q.type !== "short_answer" ? (
            <div className="bb-options">
              {q.options.map(opt => (
                <motion.button key={opt}
                  className={`bb-option ${answered === opt ? "bb-option-sel" : ""}`}
                  whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setAnswer(opt)}>
                  {opt}
                </motion.button>
              ))}
            </div>
          ) : (
            <textarea
              className="field bb-short-ans"
              placeholder="Напиши отговора си..."
              value={answered ?? ""}
              onChange={e => setAnswer(e.target.value)}
              rows={3}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Question dots */}
      <div className="bb-q-dots">
        {exam.questions.map((qi, i) => (
          <button key={qi.id} className={`bb-dot ${i === current ? "bb-dot-active" : ""} ${answers[String(qi.id)] ? "bb-dot-done" : ""}`}
            onClick={() => setCurrent(i)} />
        ))}
      </div>

      {/* Nav */}
      <div className="bb-q-nav">
        <button className="btn" onClick={prev} disabled={current === 0}><ArrowLeft size={16} /> Назад</button>
        {current < exam.questions.length - 1
          ? <button className="btn btn-primary" onClick={next}>Напред →</button>
          : <button className="btn btn-primary" style={{ background: allAnswered ? "var(--green)" : undefined }}
              onClick={() => onSubmit(answers)}>
              <Shield size={16} weight="fill" />
              {allAnswered ? "Предай изпита!" : "Предай (непълен)"}
            </button>
        }
      </div>
    </div>
  );
}

// ── Results Phase ──────────────────────────────────────────────────────────────
function ResultsPhase({ score, exam, onRetry }: { score: ScoreResult; exam: Exam; onRetry: () => void }) {
  const passed = score.passed;

  return (
    <motion.div className="bb-results"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>

      {/* Win/Lose banner */}
      <motion.div className={`bb-result-banner glass ${passed ? "bb-win" : "bb-lose"}`}
        initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6, ease: EASE }}>
        <div className="bb-result-icon">
          {passed
            ? <Trophy size={64} weight="duotone" style={{ color: "var(--amber)" }} />
            : <Skull size={64} weight="duotone" style={{ color: "var(--red)" }} />
          }
        </div>
        <h2 className="display">{passed ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}</h2>
        <div className="bb-result-score mono">
          {score.score}/{score.max_score} <span>точки</span>
        </div>
        <div className="bb-result-pct mono" style={{ color: passed ? "var(--green)" : "var(--red)" }}>
          {score.percentage}%
        </div>
        <p className="bb-result-rony">
          <Lightning size={14} weight="fill" style={{ color: "var(--amber)" }} />
          "{passed ? exam.win_message : exam.lose_message}"
        </p>
      </motion.div>

      {/* Per-question breakdown */}
      <div className="bb-breakdown">
        <h3 className="bb-breakdown-h">Разбор на въпросите</h3>
        {score.results.map((r, i) => {
          const q = exam.questions.find(q => q.id === r.id);
          return (
            <motion.div key={r.id} className={`bb-result-row glass ${r.correct ? "bb-row-ok" : "bb-row-err"}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, ease: EASE }}>
              <div className="bb-result-row-head">
                {r.correct
                  ? <CheckCircle size={20} weight="fill" style={{ color: "var(--green)" }} />
                  : <XCircle size={20} weight="fill" style={{ color: "var(--red)" }} />}
                <span className="bb-result-row-q">{q?.text ?? `Въпрос ${r.id}`}</span>
                <span className="bb-result-pts mono">{r.points_earned}/{r.points_possible}т</span>
              </div>
              {!r.correct && (
                <div className="bb-result-ans">
                  <span className="bb-ans-wrong">Твоят: {r.user_answer || "—"}</span>
                  <span className="bb-ans-right">Верен: {r.correct_answer}</span>
                </div>
              )}
              {r.explanation && <p className="bb-result-explain">{r.explanation}</p>}
              {r.teacher_trap && <span className="bb-trap-badge"><Warning size={11} weight="fill" /> Беше капан!</span>}
            </motion.div>
          );
        })}
      </div>

      <div className="bb-result-actions">
        <button className="btn btn-primary" onClick={onRetry}>
          <Sword size={16} weight="bold" /> Нова битка
        </button>
        <Link to="/" className="btn"><ArrowLeft size={16} /> Начало</Link>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BossBattle() {
  const { theme, toggle } = useTheme();
  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Анализирам учителя...");

  const loadingMsgs = ["Анализирам учителя...", "Генерирам капаните...", "Rony се подготвя...", "Финализирам изпита..."];
  const loadingIdx = useRef(0);

  const startBattle = useCallback(async (cfg: {
    teacher_name: string; subject: string; grade: string;
    style: string; num_questions: number; time_limit_minutes: number;
  }) => {
    setLoading(true);
    setError("");
    loadingIdx.current = 0;
    setLoadingMsg(loadingMsgs[0]);

    const interval = setInterval(() => {
      loadingIdx.current = (loadingIdx.current + 1) % loadingMsgs.length;
      setLoadingMsg(loadingMsgs[loadingIdx.current]);
    }, 2200);

    try {
      const res = await fetch(`${API}/boss-battle/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBattleData(data);
      setPhase("buildup");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Неизвестна грешка");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, []); // eslint-disable-line

  const submitExam = useCallback(async (answers: Record<string, string>) => {
    if (!battleData) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/boss-battle/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: battleData.exam.questions, answers }),
      });
      const data = await res.json();
      setScoreResult(data);
      setPhase("results");
    } catch {
      setError("Оценяването не успя.");
    } finally {
      setLoading(false);
    }
  }, [battleData]);

  function retry() {
    setPhase("setup");
    setBattleData(null);
    setScoreResult(null);
    setError("");
  }

  return (
    <div className="bb-page">
      {/* Background particles */}
      <div className="bb-bg" aria-hidden="true">
        {[...Array(20)].map((_, i) => (
          <motion.div key={i} className="bb-particle"
            animate={{ y: [0, -40, 0], opacity: [0.1, 0.5, 0.1], scale: [1, 1.3, 1] }}
            transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
            style={{ left: `${(i * 17 + 5) % 100}%`, top: `${(i * 23 + 10) % 100}%` }}
          />
        ))}
      </div>

      {/* Nav */}
      <nav className="bb-nav glass">
        <Link to="/" className="btn"><ArrowLeft size={16} /> Назад</Link>
        <div className="bb-nav-title display">
          <Sword size={20} weight="duotone" style={{ color: "var(--orange)" }} />
          Boss Battle
        </div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </nav>

      <main className="bb-main">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" className="bb-loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="bb-loading-orb"
                animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
              <p className="bb-loading-msg">{loadingMsg}</p>
            </motion.div>
          )}

          {!loading && error && (
            <motion.div key="error" className="bb-error glass"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <XCircle size={32} style={{ color: "var(--red)" }} />
              <p>{error}</p>
              <button className="btn btn-primary" onClick={retry}>Опитай отново</button>
            </motion.div>
          )}

          {!loading && !error && phase === "setup" && (
            <SetupPhase key="setup" onStart={startBattle} />
          )}
          {!loading && !error && phase === "buildup" && battleData && (
            <BuildupPhase key="buildup" data={battleData} onReady={() => setPhase("exam")} />
          )}
          {!loading && !error && phase === "exam" && battleData && (
            <ExamPhase key="exam" exam={battleData.exam} onSubmit={submitExam} />
          )}
          {!loading && !error && phase === "results" && scoreResult && battleData && (
            <ResultsPhase key="results" score={scoreResult} exam={battleData.exam} onRetry={retry} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
