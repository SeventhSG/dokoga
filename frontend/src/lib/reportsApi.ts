import type { Category, ReportPin, ReportDetail, Session } from "./reportTypes";

const API_BASE = (import.meta.env as Record<string, string | undefined>).VITE_API_BASE ?? "http://localhost:8000";
let session: Session | null = JSON.parse(localStorage.getItem("dokoga_session") || "null");

function auth(): Record<string, string> {
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
export function getSession() {
  return session;
}

export async function verify(phone: string, code: string, fingerprint: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code, fingerprint }),
  });
  if (!res.ok) throw new Error("Грешен код");
  session = await res.json();
  localStorage.setItem("dokoga_session", JSON.stringify(session));
  return session!;
}

export async function createReport(lat: number, lng: number, category: Category, note = "") {
  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth() },
    body: JSON.stringify({ lat, lng, category, note, device_id: session?.device_id }),
  });
  if (res.status === 401) throw new Error("Влез с телефон, за да докладваш.");
  if (!res.ok) throw new Error("Неуспешно подаване");
  return res.json();
}

export async function confirmReport(id: number, kind: "confirm" | "fixed" | "nothere" = "confirm") {
  const res = await fetch(`${API_BASE}/reports/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth() },
    body: JSON.stringify({ device_id: session?.device_id, kind }),
  });
  if (res.status === 409) throw new Error("Вече потвърди този сигнал.");
  if (!res.ok) throw new Error("Неуспешно потвърждение");
  return res.json();
}

export async function listReports(b: { min_lat: number; min_lng: number; max_lat: number; max_lng: number }): Promise<ReportPin[]> {
  const q = new URLSearchParams(Object.entries(b).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${API_BASE}/reports?${q}`);
  if (!res.ok) throw new Error("Сигналите не се заредиха");
  return (await res.json()).reports;
}

export async function getReport(id: number): Promise<ReportDetail> {
  const res = await fetch(`${API_BASE}/reports/${id}`);
  if (!res.ok) throw new Error("Сигналът не е намерен");
  return res.json();
}

export async function authoritySummary(region: string) {
  const res = await fetch(`${API_BASE}/authorities/${encodeURIComponent(region)}/summary`);
  if (!res.ok) throw new Error("Няма данни за областта");
  return res.json();
}
