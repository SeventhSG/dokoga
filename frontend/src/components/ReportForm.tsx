import { useState } from "react";
import { createReport, confirmReport, verify, getSession } from "../lib/reportsApi";
import { CATEGORY_LABELS, type Category } from "../lib/reportTypes";

function fingerprint(): string {
  let fp = localStorage.getItem("dokoga_fp");
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem("dokoga_fp", fp);
  }
  return fp;
}

export function ReportForm({ lat, lng, onDone }: { lat: number; lng: number; onDone: () => void }) {
  const [cat, setCat] = useState<Category>("pothole");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [needLogin, setNeedLogin] = useState(!getSession());

  async function submit() {
    try {
      const r = await createReport(lat, lng, cat, note);
      if (r.duplicate_of) {
        await confirmReport(r.duplicate_of);
        setMsg("Този проблем вече е докладван — потвърдихме твоя сигнал. ✓");
      } else {
        setMsg(r.region_name ? `Подаден сигнал за ${r.region_name}. ✓` : "Подаден сигнал. ✓");
      }
      setTimeout(onDone, 1200);
    } catch (e) {
      if ((e as Error).message.includes("Влез")) setNeedLogin(true);
      else setMsg((e as Error).message);
    }
  }

  async function doLogin() {
    try {
      await verify(phone, code, fingerprint());
      setNeedLogin(false);
      setMsg("Влезе ✓");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="report-form">
      {needLogin ? (
        <div className="mini-login">
          <p>Влез с телефон, за да докладваш (анонимно):</p>
          <input placeholder="+359..." value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input placeholder="6-цифрен код" value={code} onChange={(e) => setCode(e.target.value)} />
          <button onClick={doLogin}>Влез</button>
        </div>
      ) : (
        <>
          <select value={cat} onChange={(e) => setCat(e.target.value as Category)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <textarea
            placeholder="Кратко описание (по желание)"
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={submit}>Подай сигнал</button>
        </>
      )}
      {msg && <p className="form-msg">{msg}</p>}
    </div>
  );
}
