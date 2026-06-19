import { useEffect, useRef, useState } from "react";
import { PaperPlaneTilt, ChatCircleDots, Minus } from "@phosphor-icons/react";
import { askDokoga } from "../lib/api";

interface Msg {
  role: "me" | "bot" | "err";
  text: string;
}

const SUGGESTIONS = [
  "Кои изпълнители просрочват най-много?",
  "Какво е положението в Пловдив?",
  "Най-проблемните области?",
];

const GREETING: Msg = {
  role: "bot",
  text: "Питай ме за просрочването на ремонтите. Например коя област или изпълнител се проточва най-много.",
};

export default function ChatDock({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "me", text: q }]);
    setBusy(true);
    try {
      const res = await askDokoga(q);
      setMsgs((m) => [...m, { role: "bot", text: res.answer || "Няма отговор." }]);
    } catch {
      setMsgs((m) => [...m, { role: "err", text: "Backend-ът не отговаря. Стартиран ли е (uvicorn serve:app)?" }]);
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
        <span className="av">
          <ChatCircleDots size={18} weight="fill" />
        </span>
        <span className="who">
          ДОКОГА AI
          <small>отговаря само с проверени данни</small>
        </span>
        <button className="toggle" onClick={onClose} aria-label="Свий чата">
          <Minus size={18} weight="bold" />
        </button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="bubble bot">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>

      {msgs.length <= 1 && (
        <div className="chat-suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Питай на български..."
          aria-label="Въпрос"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Изпрати">
          <PaperPlaneTilt size={18} weight="fill" />
        </button>
      </form>
    </div>
  );
}
