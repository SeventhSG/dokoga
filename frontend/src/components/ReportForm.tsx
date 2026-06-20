import { useEffect, useState } from "react";
import { createReport, confirmReport, getSession, me } from "../lib/reportsApi";
import { CATEGORY_LABELS, type Category } from "../lib/reportTypes";
import { EmailAuth } from "./EmailAuth";

export function ReportForm({ lat, lng, onDone }: { lat: number; lng: number; onDone: () => void }) {
  const [cat, setCat] = useState<Category>("pothole");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [authed, setAuthed] = useState(!!getSession());

  useEffect(() => {
    if (!authed) me().then((u) => { if (u) setAuthed(true); });
  }, [authed]);

  async function submit() {
    try {
      const r = await createReport(lat, lng, cat, note);
      if (r.duplicate_of) {
        await confirmReport(r.duplicate_of);
        setMsg("Този проблем вече е докладван — потвърдихме сигнала ти. ✓");
      } else {
        setMsg(r.region_name ? `Подаден сигнал за ${r.region_name}. ✓` : "Подаден сигнал. ✓");
      }
      setTimeout(onDone, 1200);
    } catch (e) {
      if ((e as Error).message.includes("Влез")) setAuthed(false);
      else setMsg((e as Error).message);
    }
  }

  if (!authed) {
    return (
      <div className="report-form">
        <EmailAuth onAuthed={() => setAuthed(true)} />
      </div>
    );
  }

  return (
    <div className="report-form">
      <p className="form-label">Какъв е проблемът?</p>
      <div className="cat-chips">
        {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([k, v]) => (
          <button
            key={k}
            type="button"
            className={"cat-chip" + (cat === k ? " active" : "")}
            onClick={() => setCat(k)}
          >
            {v}
          </button>
        ))}
      </div>
      <textarea
        placeholder="Кратко описание (по желание)"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="submit-btn" onClick={submit}>Подай сигнал</button>
      {msg && <p className="form-msg">{msg}</p>}
    </div>
  );
}
