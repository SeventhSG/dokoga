import { useState } from "react";
import { requestCode, verifyEmail } from "../lib/reportsApi";

export function EmailAuth({ onAuthed }: { onAuthed: (name: string) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [dev, setDev] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true); setMsg("");
    try {
      const r = await requestCode(name.trim(), email.trim());
      setDev(r.dev_code);
      setStep("code");
      setMsg(r.sent ? "Изпратихме код на имейла ти. Провери и спам папката." : "");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true); setMsg("");
    try {
      const s = await verifyEmail(email.trim(), code.trim());
      onAuthed(s.name);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="email-auth">
      <p className="form-label">Влез, за да докладваш</p>
      <p className="auth-sub">Анонимно си публично — имейлът ти не се показва, само пречи на спам.</p>
      {step === "email" ? (
        <>
          <input className="auth-input" placeholder="Име" value={name}
            onChange={(e) => setName(e.target.value)} />
          <input className="auth-input" type="email" placeholder="Имейл (gmail, abv.bg…)"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="submit-btn" disabled={busy || !name.trim() || !email.trim()} onClick={send}>
            {busy ? "Изпращаме…" : "Изпрати код"}
          </button>
        </>
      ) : (
        <>
          <input className="auth-input" inputMode="numeric" maxLength={6} placeholder="6-цифрен код"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
          <button className="submit-btn" disabled={busy || code.length !== 6} onClick={verify}>
            {busy ? "Проверяваме…" : "Потвърди"}
          </button>
          <button className="link-btn" onClick={() => { setStep("email"); setDev(null); setMsg(""); }}>
            ← Друг имейл
          </button>
          {dev && <p className="dev-hint">DEV код (Resend още не е вкл.): <b>{dev}</b></p>}
        </>
      )}
      {msg && <p className="form-msg">{msg}</p>}
    </div>
  );
}
