import { useEffect, useRef, useState } from "react";
import { PaperPlaneTilt, ChatCircleDots, Minus, X } from "@phosphor-icons/react";
import { askDokoga, predictRepair } from "../lib/api";
import type { ChatFocus } from "../lib/types";

interface Msg {
  role: "me" | "bot" | "err" | "warn";
  text: string;
}

const SUGGESTIONS = [
  "Кой е проектът с най-голям бюджет?",
  "Какво е положението в Пловдив?",
  "Пред блока ми ремонтират улицата, кога ще е готова?",
];

const GREETING: Msg = {
  role: "bot",
  text: "Питай ме за ремонтите - коя област/изпълнител се проточва, кой е най-скъп, или „кога ще свърши моят ремонт“ за груба прогноза.",
};

// - детекция: иска ли потребителят лична прогноза „кога ще свърши" -
const PREDICT_RE =
  /(кога|до\s?кога)[^?]{0,40}(готов|свърш|приключ|стане|край|завърш)|пред\s?блок|мо(я|ята|ите)\s+(ремонт|улиц)/i;

// - слот-стъпки на разговорната прогноза -
const SECTORS = [
  { value: "roads", label: "Път / тротоар" }, { value: "parks", label: "Парк / площадка" },
  { value: "water", label: "ВиК" }, { value: "lighting", label: "Осветление" },
  { value: "public", label: "Сграда / площад" },
];
const REGIONS = [
  "Благоевград", "Бургас", "Варна", "Велико Търново", "Видин", "Враца", "Габрово", "Добрич",
  "Кърджали", "Кюстендил", "Ловеч", "Монтана", "Пазарджик", "Перник", "Плевен", "Пловдив",
  "Разград", "Русе", "Силистра", "Сливен", "Смолян", "София (столица)", "София област",
  "Стара Загора", "Търговище", "Хасково", "Шумен", "Ямбол",
];
const SIZES = [
  { label: "Малък (~50 хил.)", value: 60000 }, { label: "Среден (~250 хил.)", value: 250000 },
  { label: "Голям (1 млн.+)", value: 1200000 },
];
const TERMS = [
  { label: "1-2 месеца", value: 45 }, { label: "3-4 месеца", value: 105 },
  { label: "Половин година+", value: 210 }, { label: "Не знам", value: 120 },
];
const LEVELS = { low: "нисък", med: "среден", high: "висок" } as const;

type Step = "sector" | "region" | "size" | "term";
interface Flow { step: Step; sector?: string; region?: string; value?: number; planned?: number; }

export default function ChatDock({
  open, onOpen, onClose, onFocus,
}: { open: boolean; onOpen: () => void; onClose: () => void; onFocus?: (f: ChatFocus) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, flow]);

  const push = (m: Msg) => setMsgs((x) => [...x, m]);

  function startPredict() {
    push({ role: "bot", text: "Мога да дам груба прогноза 🔮 Само 4 бързи въпроса.\nКакъв е ремонтът?" });
    setFlow({ step: "sector" });
  }

  async function runPredict(f: Flow) {
    setBusy(true);
    try {
      const r = await predictRepair({
        category: "works", sector: f.sector!, value: f.value!, region: f.region!,
        month: new Date().getMonth() + 1, planned_days: f.planned!, n_tenderers: 1, is_repair: 1,
      });
      if (r.error) throw new Error();
      const days = r.expected_days;
      push({
        role: "bot",
        text: `🔮 Груба прогноза: рискът от просрочване е ${Math.round(r.risk * 100)}% (${LEVELS[r.level]}). Вероятно ще се проточи с около +${days} дни над обещания срок.`,
      });
      if (r.drivers?.length) push({ role: "bot", text: "Защо: " + r.drivers.join("; ") + "." });
      push({
        role: "warn",
        text: "⚠️ Това е спекулация по исторически данни за подобни договори - НЕ точни данни за конкретния обект. Реалното зависи от изпълнителя и терена.",
      });
    } catch {
      push({ role: "err", text: "Прогнозата не успя. Backend стартиран ли е?" });
    } finally {
      setBusy(false);
      setFlow(null);
    }
  }

  function advance(label: string, patch: Partial<Flow>, next: Step | "done") {
    push({ role: "me", text: label });
    const f = { ...flow!, ...patch } as Flow;
    if (next === "done") { runPredict(f); return; }
    setFlow({ ...f, step: next });
    const prompts: Record<Step, string> = {
      sector: "Какъв е ремонтът?", region: "В коя област е?",
      size: "Колко голям е проектът горе-долу?", term: "Какъв срок обещаха?",
    };
    push({ role: "bot", text: prompts[next] });
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || flow) return;
    setInput("");
    push({ role: "me", text: q });
    if (PREDICT_RE.test(q)) { startPredict(); return; }
    setBusy(true);
    try {
      const res = await askDokoga(q);
      push({ role: "bot", text: res.answer || "Няма отговор." });
      if (res.focus && (res.focus.ocid || res.focus.region)) onFocus?.(res.focus);
    } catch {
      push({ role: "err", text: "Backend-ът не отговаря. Стартиран ли е (uvicorn serve:app)?" });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="fab" onClick={onOpen}>
        <ChatCircleDots size={20} weight="fill" /> Питай ДОКОГА
      </button>
    );
  }

  return (
    <div className="glass chat">
      <div className="chat-h">
        <span className="av"><ChatCircleDots size={18} weight="fill" /></span>
        <span className="who">
          ДОКОГА AI
          <small>проверени данни + прогноза</small>
        </span>
        <button className="toggle" onClick={onClose} aria-label="Свий чата">
          <Minus size={18} weight="bold" />
        </button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
        ))}
        {busy && (
          <div className="bubble bot">
            <span className="typing"><i /><i /><i /></span>
          </div>
        )}
      </div>

      {/* разговорна прогноза - контроли по стъпки */}
      {flow && !busy && (
        <div className="chat-flow">
          {flow.step === "sector" && (
            <div className="chat-suggest">
              {SECTORS.map((s) => (
                <button key={s.value} className="chip" onClick={() => advance(s.label, { sector: s.value }, "region")}>{s.label}</button>
              ))}
            </div>
          )}
          {flow.step === "region" && (
            <div className="chat-suggest chat-regions">
              {REGIONS.map((r) => (
                <button key={r} className="chip" onClick={() => advance(r, { region: r }, "size")}>{r}</button>
              ))}
            </div>
          )}
          {flow.step === "size" && (
            <div className="chat-suggest">
              {SIZES.map((s) => (
                <button key={s.value} className="chip" onClick={() => advance(s.label, { value: s.value }, "term")}>{s.label}</button>
              ))}
            </div>
          )}
          {flow.step === "term" && (
            <div className="chat-suggest">
              {TERMS.map((t) => (
                <button key={t.value} className="chip" onClick={() => advance(t.label, { planned: t.value }, "done")}>{t.label}</button>
              ))}
            </div>
          )}
          <button className="chat-flow-cancel" onClick={() => setFlow(null)}><X size={12} weight="bold" /> Откажи прогнозата</button>
        </div>
      )}

      {!flow && msgs.length <= 1 && (
        <div className="chat-suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input
          className="field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={flow ? "Избери опция по-горе ↑" : "Питай на български..."}
          aria-label="Въпрос"
          disabled={!!flow}
        />
        <button type="submit" disabled={busy || !!flow || !input.trim()} aria-label="Изпрати">
          <PaperPlaneTilt size={18} weight="fill" />
        </button>
      </form>
    </div>
  );
}
