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

// continuous color ramp for the map (green -> yellow -> orange -> red)
const STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [31, 209, 122]],
  [0.33, [255, 210, 63]],
  [0.6, [255, 138, 61]],
  [1.0, [255, 59, 59]],
];
export function riskRamp(r: number): string {
  const x = Math.max(0, Math.min(1, r));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [a0, c0] = STOPS[i - 1];
      const [a1, c1] = STOPS[i];
      const t = (x - a0) / (a1 - a0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(255,59,59)";
}
