import { useState } from "react";
import { X, MapPin, Sparkle, Path, Tree, Drop, Lightbulb, Buildings, Clock, Files, ArrowSquareOut, Megaphone } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import DelayBar from "./DelayBar";
import { riskColor, riskLabel, money, daysLeft, dayRange, MODEL_NOTE } from "../lib/risk";
import { analyzeProject } from "../lib/api";
import type { RepairFeature, AnalyzeResponse } from "../lib/types";

const SECTOR_ICON: Record<string, typeof Path> = {
  roads: Path, parks: Tree, water: Drop, lighting: Lightbulb, public: Buildings,
};

const MUNICIPAL_EMAILS: Record<string, string> = {
  "Стара Загора": "obshtina@stara-zagora.bg",
  "София (столица)": "bgoffice@sofia.bg",
  "София област": "oblast@sofia.bg",
  "Пловдив": "info@plovdiv.bg",
  "Варна": "obshtina@varna.bg",
  "Бургас": "obshtina@burgas.bg",
  "Русе": "obshtina@ruse-bg.eu",
  "Благоевград": "obshtina@blagoevgrad.bg",
  "Велико Търново": "obshtina@veliko-turnovo.bg",
  "Видин": "obshtina@vidin.bg",
  "Враца": "obshtina@vratsa.bg",
  "Габрово": "protocol@gabrovo.bg",
  "Добрич": "obshtina@dobrich.bg",
  "Кърджали": "obshtina@kardjali.bg",
  "Кюстендил": "obshtina@kustendil.bg",
  "Ловеч": "obshtina@lovech.bg",
  "Монтана": "obshtina@montana.bg",
  "Пазарджик": "obshtina@pazardzhik.bg",
  "Перник": "obshtina@pernik.bg",
  "Плевен": "obshtina@pleven.bg",
  "Разград": "obshtina@razgrad.bg",
  "Силистра": "obshtina@silistra.bg",
  "Сливен": "obshtina@sliven.bg",
  "Смолян": "obshtina@smolyan.bg",
  "Търговище": "obshtina@targovishte.bg",
  "Хасково": "obshtina@haskovo.bg",
  "Шумен": "obshtina@shumen.bg",
  "Ямбол": "obshtina@yambol.bg",
};

export default function DetailCard({ feature, onClose }: { feature: RepairFeature; onClose: () => void }) {
  const p = feature.properties;
  const c = riskColor(p.risk);
  const place = [p.locality, p.region].filter(Boolean).join(", ");
  const SecIcon = SECTOR_ICON[p.sector] ?? Path;
  const [loDays, hiDays] = dayRange(p.expected_days);
  const planned = p.planned_days || 0;
  const isActive = !!p.is_active;
  const left = daysLeft(p.deadline);
  const deadlineDate = p.deadline ? new Date(p.deadline) : null;
  const deadlineLabel =
    p.deadline_raw ||
    (deadlineDate && !Number.isNaN(deadlineDate.getTime())
      ? new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "short", year: "numeric" }).format(deadlineDate)
      : "—");
  const remainingLabel = left == null ? "няма данни" : left >= 0 ? `${left} дни` : "изтекъл";
  const tenderType = [p.procedure, p.object_type].filter(Boolean).join(" · ") || "Обществена поръчка";
  const deadlineProgress = left == null ? 0 : left <= 0 ? 0 : Math.max(8, Math.min(100, (Math.min(left, 30) / 30) * 100));

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  // Signal State
  const [signalOpen, setSignalOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [emailPhone, setEmailPhone] = useState("");

  const municipalEmail = MUNICIPAL_EMAILS[p.region] || "obshtina@stara-zagora.bg";

  async function runAnalysis() {
    setBusy(true); setErr(false);
    try { setAnalysis(await analyzeProject(p)); }
    catch { setErr(true); }
    finally { setBusy(false); }
  }

  function submitSignal(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !address) return;

    const subject = `Сигнал по АПК за просрочен ремонт: ${p.title}`;
    const body = `ДО:\nКмета на Община ${p.region || "Стара Загора"}\n\nСИГНАЛ\n(по реда на Глава осма от АПК)\n\nОТ:\n${name}\nАдрес за кореспонденция: ${address}\nКонтакт (тел/имейл): ${emailPhone || "Не е посочен"}\n\nОТНОСНО:\nНеобосновано просрочване на обществено-значим ремонт\n\nУважаеми господин Кмет,\n\nС настоящото подавам официален сигнал за просрочване на следния обект на Ваша територия:\n\n- Обект: "${p.title}"\n- Изпълнител: ${p.supplier || "няма данни"}\n- Стойност на договора: ${money(p.value, p.value_currency)}\n- Обещан срок по договор: ${p.planned_days || "—"} дни\n- Вече просрочен с: ${p.overrun_days} дни\n\nМоля да извършите проверка на място относно забавянето, да предприемете необходимите мерки спрямо изпълнителя и да ме уведомите писмено на посочения адрес в законоустановения едномесечен срок по чл. 121 от АПК.\n\nС уважение,\n${name}`;

    const mailto = `mailto:${municipalEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank");
    setSignalOpen(false);
  }

  return (
    <div className="glass" style={{ position: "relative" }}>
      <div className="detail-inner">
        <button className="close" onClick={onClose} aria-label="Затвори">
          <X size={16} weight="bold" />
        </button>

        <div className="detail-tags">
          {isActive && (
            <span className="risk-chip" style={{ background: "#22d3ee22", color: "#22d3ee" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee" }} />
              Активна поръчка
            </span>
          )}
          <span className="risk-chip" style={{ background: `${c}22`, color: c }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            {riskLabel(p.risk)} риск · {Math.round(p.risk * 100)}%
          </span>
          {p.sector_name && (
            <span className="sector-chip"><SecIcon size={13} weight="duotone" /> {p.sector_name}</span>
          )}
        </div>

        <h3>{p.title || "Договор за ремонт"}</h3>
        {place && (
          <div className="meta" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={13} weight="fill" /> {place}
          </div>
        )}

        {isActive ? (
          /* активна поръчка: краен срок + процедура + документи */
          <div className="deadline-panel">
            <div className="deadline-panel-head">
              <span className="deadline-kicker"><Clock size={15} weight="duotone" /> Краен срок</span>
              <span className="deadline-pill mono">{remainingLabel}</span>
            </div>
            <div className="deadline-fields">
              <div>
                <span>Дата</span>
                <strong>{deadlineLabel}</strong>
              </div>
              <div>
                <span>Остават</span>
                <strong>{remainingLabel}</strong>
              </div>
              <div>
                <span>Тип</span>
                <strong>{tenderType}</strong>
              </div>
            </div>
            <div className="deadline-progress" aria-hidden="true">
              <i style={{ width: `${deadlineProgress}%` }} />
            </div>
          </div>
        ) : (
          /* прогноза: обещано -> реалистичен диапазон (ориентир, не точно число) */
          <div className="detail-pred">
            <div className="detail-pred-row">
              <div>
                <div className="detail-pred-n mono">{planned || "-"}</div>
                <div className="detail-pred-l">обещани дни</div>
              </div>
              <div className="detail-pred-arrow">→</div>
              <div>
                <div className="detail-pred-n mono" style={{ color: c }}>
                  {planned ? `${planned + loDays}–${planned + hiDays}` : "-"}
                </div>
                <div className="detail-pred-l">реалистично (ориентир)</div>
              </div>
            </div>
            <DelayBar planned={Math.max(planned, 10)} overrun={p.expected_days} height={12} capSize={16} />
            <div className="detail-pred-cap mono" style={{ color: "var(--red)" }}>
              обикновено +{loDays}–{hiDays} дни за такива проекти
            </div>
            <p className="detail-pred-note">{MODEL_NOTE}</p>
          </div>
        )}

        <div className="rows">
          <div className="row">
            <span className="k">{isActive ? "Прогнозна стойност" : "Стойност"}</span>
            <span className="v mono">{money(p.value, p.value_currency)}</span>
          </div>
          {isActive ? (
            <>
              <div className="row">
                <span className="k">Документи</span>
                <span className="v mono">{p.n_documents ?? 0}</span>
              </div>
              <div className="row">
                <span className="k">Възложител</span>
                <span className="v">{p.buyer || "Община Стара Загора"}</span>
              </div>
              {p.eop_url && (
                <a className="row" href={p.eop_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <span className="k">ЦАИС ЕОП</span>
                  <span className="v" style={{ color: "#22d3ee", display: "flex", alignItems: "center", gap: 4 }}>
                    {p.regnum} <ArrowSquareOut size={13} weight="bold" />
                  </span>
                </a>
              )}
            </>
          ) : (
            <>
              <div className="row">
                <span className="k">Изпълнител</span>
                <span className="v">{p.supplier || "няма данни"}</span>
              </div>
              {p.overrun_days > 0 && (
                <div className="row">
                  <span className="k">Вече просрочен</span>
                  <span className="v mono" style={{ color: "var(--red)" }}>+{p.overrun_days} дни</span>
                </div>
              )}
            </>
          )}
        </div>

        {isActive && p.risk_basis && (
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.45, display: "flex", gap: 5, alignItems: "flex-start" }}>
            <Files size={13} weight="duotone" style={{ flexShrink: 0, marginTop: 1 }} />
            Рискът е {p.risk_basis} — не е присъда за конкретния проект.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {!analysis && (
            <button className="btn detail-ai-btn" onClick={runAnalysis} disabled={busy}>
              <Sparkle size={16} weight="fill" /> {busy ? "AI анализира…" : "AI анализ: защо ще се бави?"}
            </button>
          )}
          {p.overrun_days > 0 && (
            <button
              className="btn"
              onClick={() => setSignalOpen(true)}
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                justifyContent: "center",
                padding: "8px 12px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: 12
              }}
            >
              <Megaphone size={16} weight="fill" /> Подай сигнал за просрочване
            </button>
          )}
        </div>

        {err && <p className="detail-ai-err">AI анализът не успя. Backend стартиран ли е?</p>}

        <AnimatePresence>
          {analysis && (
            <motion.div
              className="detail-ai"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="detail-ai-h"><Sparkle size={14} weight="fill" /> AI анализ</div>
              <p className="detail-ai-text">{analysis.analysis}</p>
              {analysis.drivers?.length > 0 && (
                <div className="detail-ai-drivers">
                  {analysis.drivers.map((d, i) => (
                    <motion.span
                      key={i} className="driver-chip"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.07 }}
                    >
                      {d}
                    </motion.span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {signalOpen && (
            <motion.div
              className="signal-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(15, 23, 32, 0.96)",
                backdropFilter: "blur(4px)",
                borderRadius: 8,
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                padding: 16,
                overflowY: "auto"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, color: "#ef4444", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Megaphone size={16} weight="fill" /> Подаване на официален сигнал
                </h4>
                <button className="close" onClick={() => setSignalOpen(false)} aria-label="Затвори" style={{ position: "static", background: "none", border: "none", color: "var(--ink-2)", cursor: "pointer" }}>
                  <X size={16} weight="bold" />
                </button>
              </div>

              <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4, margin: "0 0 12px" }}>
                По закон (АПК Гл. 8), общината е длъжна да заведе и разгледа сигнала Ви.
                <b style={{ color: "#ef4444" }}> Анонимни сигнали не се разглеждат</b>, затова се изискват имена и адрес.
                Сигналът ще се генерира като официален писмен текст и ще се зареди във Вашия имейл клиент за изпращане до <b>{municipalEmail}</b>.
              </p>

              <form onSubmit={submitSignal} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 11, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
                  Трите Ви имена (задължително)
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="напр. Георги Иванов Петров"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      padding: "6px 10px",
                      color: "white",
                      fontSize: 12,
                      outline: "none"
                    }}
                  />
                </label>

                <label style={{ fontSize: 11, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
                  Адрес за кореспонденция (задължително)
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="напр. гр. Стара Загора, ул. Боруйград 42"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      padding: "6px 10px",
                      color: "white",
                      fontSize: 12,
                      outline: "none"
                    }}
                  />
                </label>

                <label style={{ fontSize: 11, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
                  Телефон / Имейл за обратна връзка
                  <input
                    type="text"
                    value={emailPhone}
                    onChange={(e) => setEmailPhone(e.target.value)}
                    placeholder="напр. 0888 123 456 или georgi@mail.bg"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      padding: "6px 10px",
                      color: "white",
                      fontSize: 12,
                      outline: "none"
                    }}
                  />
                </label>

                <button
                  type="submit"
                  style={{
                    background: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    padding: "8px 12px",
                    fontWeight: "bold",
                    marginTop: 10,
                    cursor: "pointer",
                    fontSize: 12
                  }}
                >
                  Генерирай и изпрати имейл
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
