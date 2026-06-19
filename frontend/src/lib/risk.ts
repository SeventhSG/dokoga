export type RiskLevel = "low" | "med" | "high";

export const RISK = {
  low: { color: "#2BD46A", label: "Нисък" },
  med: { color: "#FFB020", label: "Среден" },
  high: { color: "#FF4D4D", label: "Висок" },
} as const;

export function riskLevel(r: number): RiskLevel {
  if (r >= 0.6) return "high";
  if (r >= 0.33) return "med";
  return "low";
}

export const riskColor = (r: number) => RISK[riskLevel(r)].color;
export const riskLabel = (r: number) => RISK[riskLevel(r)].label;

export const bgn = (v: number | null) =>
  v == null ? "няма данни" : new Intl.NumberFormat("bg-BG").format(Math.round(v)) + " лв";
