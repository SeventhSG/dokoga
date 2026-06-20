import { useState } from "react";
import { Gauge, ShareNetwork } from "@phosphor-icons/react";
import CustomSelect from "./CustomSelect";
import DelayBar from "./DelayBar";
import { predictRepair } from "../lib/api";
import type { PredictResult } from "../lib/api";
import { RISK, dayRange, MODEL_NOTE } from "../lib/risk";
import { shareCard } from "../lib/shareCard";

const REGIONS = [
  "Благоевград", "Бургас", "Варна", "Велико Търново", "Видин", "Враца", "Габрово", "Добрич",
  "Кърджали", "Кюстендил", "Ловеч", "Монтана", "Пазарджик", "Перник", "Плевен", "Пловдив",
  "Разград", "Русе", "Силистра", "Сливен", "Смолян", "София (столица)", "София област",
  "Стара Загора", "Търговище", "Хасково", "Шумен", "Ямбол",
];
const SECTORS = [
  { value: "roads", label: "Пътища и тротоари" },
  { value: "water", label: "ВиК" },
  { value: "parks", label: "Паркове и площадки" },
  { value: "lighting", label: "Улично осветление" },
  { value: "public", label: "Обществени сгради/площади" },
];
const MONTHS = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];
const LABELS = { low: "Нисък", med: "Среден", high: "Висок" } as const;

export default function Predictor() {
  const [form, setForm] = useState({ category: "works", sector: "roads", region: "София (столица)", value: 250000, planned_days: 120, n_tenderers: 1, month: 6 });
  const [res, setRes] = useState<PredictResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function run() {
    setBusy(true);
    setErr(false);
    try {
      const r = await predictRepair({ ...form, is_repair: 1 });
      if (r.error) setErr(true);
      else setRes(r);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const color = res ? RISK[res.level].color : "var(--orange)";

  async function share() {
    if (!res) return;
    await shareCard({
      region: form.region,
      category: SECTORS.find((c) => c.value === form.sector)?.label ?? "Ремонт",
      riskPct: Math.round(res.risk * 100),
      level: res.level,
      expectedDays: res.expected_days,
      plannedDays: form.planned_days,
    });
  }

  return (
    <div className="predictor">
      <div className="pred-form">
        <label className="lbl">
          Вид ремонт
          <CustomSelect value={form.sector} options={SECTORS} onChange={(v) => set("sector", v)} ariaLabel="Вид ремонт" />
        </label>
        <label className="lbl">
          Област
          <CustomSelect value={form.region} options={REGIONS.map((r) => ({ value: r, label: r }))} onChange={(v) => set("region", v)} ariaLabel="Област" />
        </label>
        <label className="lbl">
          Стойност (лв)
          <input className="field" type="number" min={0} step={10000} value={form.value} onChange={(e) => set("value", Number(e.target.value))} />
        </label>
        <label className="lbl">
          Обещан срок (дни)
          <input className="field" type="number" min={1} max={2000} value={form.planned_days} onChange={(e) => set("planned_days", Number(e.target.value))} />
        </label>
        <label className="lbl">
          Брой оферти
          <input className="field" type="number" min={0} max={50} value={form.n_tenderers} onChange={(e) => set("n_tenderers", Number(e.target.value))} />
        </label>
        <label className="lbl">
          Месец на старт
          <CustomSelect value={String(form.month)} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} onChange={(v) => set("month", Number(v))} ariaLabel="Месец" />
        </label>
        <button className="btn btn-primary pred-go" onClick={run} disabled={busy}>
          <Gauge size={17} weight="fill" /> {busy ? "Изчислявам..." : "Изчисли риска"}
        </button>
      </div>

      <div className="pred-result" aria-live="polite">
        {err && <p className="pred-err">Backend-ът не отговори. Стартиран ли е на :8000?</p>}
        {!res && !err && <p className="pred-hint">Попълни договора и натисни „Изчисли риска“.</p>}
        {res && (
          <>
            <div className="pred-gauge" style={{ color }}>
              <span className="pred-pct mono">{Math.round(res.risk * 100)}%</span>
              <span className="pred-level">{LABELS[res.level]} риск от просрочване</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <div className="pred-bar-cap">
                <span>обещан срок</span>
                <span className="mono" style={{ color: "var(--red)" }}>
                  +{dayRange(res.expected_days)[0]}–{dayRange(res.expected_days)[1]} дни (ориентир)
                </span>
              </div>
              <DelayBar planned={100} overrun={res.expected_days} height={14} capSize={18} />
            </div>
            {res.drivers && res.drivers.length > 0 && (
              <div className="pred-drivers">
                <div className="pred-drivers-h">Защо този риск:</div>
                <div className="pred-drivers-list">
                  {res.drivers.map((d, i) => (
                    <span className="driver-chip" key={i}>{d}</span>
                  ))}
                </div>
              </div>
            )}
            <button className="btn pred-share" onClick={share}>
              <ShareNetwork size={16} weight="bold" /> Сподели резултата
            </button>
            <p className="pred-note">
              {MODEL_NOTE} Оценка по исторически данни от обществените поръчки; не е присъда за конкретна фирма.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
