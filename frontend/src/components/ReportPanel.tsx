import { useCallback, useEffect, useState } from "react";
import { getReport, confirmReport } from "../lib/reportsApi";
import { CATEGORY_LABELS, type ReportDetail } from "../lib/reportTypes";

const STATUS_BG: Record<string, string> = {
  reported: "Докладван",
  verified: "Потвърден ✓",
  under_review: "Проверява се",
  resolved: "Решен",
  unassigned: "Без област",
};

export function ReportPanel({ id, onClose, onChanged }: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [r, setR] = useState<ReportDetail | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    getReport(id).then(setR).catch(() => setR(null));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(kind: "confirm" | "fixed") {
    try {
      const res = await confirmReport(id, kind);
      setMsg(`Статус: ${STATUS_BG[res.status] ?? res.status}`);
      load();
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (!r) return null;
  const c = r.suggested_contracts[0];
  return (
    <aside className="report-panel" role="dialog" aria-modal="true" aria-label="Детайли за сигнала">
      <button className="close" onClick={onClose} aria-label="Затвори">×</button>
      <h3>{CATEGORY_LABELS[r.category]}</h3>
      <span className="badge">{STATUS_BG[r.status] ?? r.status}</span>
      <p>{r.confirmations} граждани са засегнати · отговаря: <b>{r.region_name ?? "—"}</b></p>
      {c && (
        <div className="suggested">
          <p className="muted">Вероятно свързан договор:</p>
          <p><b>{c.title}</b></p>
          <p>{c.overrun_days ? `просрочен с ${c.overrun_days} дни` : "по график"} · {c.supplier}</p>
        </div>
      )}
      <div className="actions">
        <button onClick={() => act("confirm")}>И аз съм засегнат</button>
        <button onClick={() => act("fixed")}>Решен е</button>
      </div>
      {msg && <p className="form-msg" role="status" aria-live="polite">{msg}</p>}
    </aside>
  );
}
