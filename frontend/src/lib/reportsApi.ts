import type { Category, ReportPin, ReportDetail, Session } from "./reportTypes";

const API_BASE = (import.meta.env as Record<string, string | undefined>).VITE_API_BASE ?? "http://localhost:8000";
let session: Session | null = JSON.parse(localStorage.getItem("dokoga_session") || "null");

function authHeaders(): Record<string, string> {
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
export function getSession() {
  return session;
}

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers || {}) },
    ...init,
  });
}

const ERRORS: Record<string, string> = {
  bad_domain: "Използвай личен имейл (gmail, yahoo, abv.bg, mail.bg…).",
  no_name: "Въведи името си.",
  rate_limited: "Твърде много опити. Опитай пак след 3 дни.",
  bad_code: "Грешен код.",
  expired: "Кодът изтече. Поискай нов.",
  too_many: "Твърде много грешни опити. Поискай нов код.",
};
async function asError(res: Response): Promise<never> {
  let detail = "";
  try { detail = (await res.json()).detail; } catch { /* ignore */ }
  throw new Error(ERRORS[detail] ?? "Нещо се обърка. Опитай пак.");
}

/** Step 1: ask for a code. Returns dev_code in dev (no Resend key). */
export async function requestCode(name: string, email: string): Promise<{ sent: boolean; dev_code: string | null }> {
  const res = await api("/auth/request", { method: "POST", body: JSON.stringify({ name, email }) });
  if (!res.ok) await asError(res);
  return res.json();
}

/** Step 2: verify the code; persists the session + cookie. */
export async function verifyEmail(email: string, code: string): Promise<Session> {
  const res = await api("/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) });
  if (!res.ok) await asError(res);
  session = await res.json();
  localStorage.setItem("dokoga_session", JSON.stringify(session));
  return session!;
}

/** Returning visitor: recognised via cookie even if localStorage was cleared. */
export async function me(): Promise<{ user_id: number; name: string } | null> {
  const res = await api("/auth/me");
  if (!res.ok) return null;
  const u = await res.json();
  if (!session) session = { token: "", user_id: u.user_id, name: u.name };
  return u;
}

export async function logout() {
  await api("/auth/logout", { method: "POST" });
  session = null;
  localStorage.removeItem("dokoga_session");
}

export async function createReport(lat: number, lng: number, category: Category, note = "") {
  const res = await api("/reports", { method: "POST", body: JSON.stringify({ lat, lng, category, note }) });
  if (res.status === 401) throw new Error("Влез с имейл, за да докладваш.");
  if (!res.ok) throw new Error("Неуспешно подаване");
  return res.json();
}

export async function confirmReport(id: number, kind: "confirm" | "fixed" | "nothere" = "confirm") {
  const res = await api(`/reports/${id}/confirm`, { method: "POST", body: JSON.stringify({ kind }) });
  if (res.status === 401) throw new Error("Влез с имейл, за да потвърдиш.");
  if (res.status === 409) throw new Error("Вече потвърди този сигнал.");
  if (!res.ok) throw new Error("Неуспешно потвърждение");
  return res.json();
}

export async function listReports(b: { min_lat: number; min_lng: number; max_lat: number; max_lng: number }): Promise<ReportPin[]> {
  const q = new URLSearchParams(Object.entries(b).map(([k, v]) => [k, String(v)]));
  const res = await api(`/reports?${q}`);
  if (!res.ok) throw new Error("Сигналите не се заредиха");
  return (await res.json()).reports;
}

export async function getReport(id: number): Promise<ReportDetail> {
  const res = await api(`/reports/${id}`);
  if (!res.ok) throw new Error("Сигналът не е намерен");
  return res.json();
}

export async function authoritySummary(region: string) {
  const res = await api(`/authorities/${encodeURIComponent(region)}/summary`);
  if (!res.ok) throw new Error("Няма данни за областта");
  return res.json();
}
