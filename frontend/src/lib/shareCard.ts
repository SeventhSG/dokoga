import { RISK, type RiskLevel } from "./risk";

export interface CardData {
  region: string;
  category: string;
  riskPct: number;
  level: RiskLevel;
  expectedDays: number;
  plannedDays: number;
}

const W = 1080, H = 1080, PAD = 96;

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, h / 2, w / 2);
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
}

/** Render a 1080×1080 branded share image from a prediction. */
export async function renderShareCard(d: CardData): Promise<Blob> {
  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* fonts optional */ }

  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  const risk = RISK[d.level].color;

  // background
  c.fillStyle = "#090c11";
  c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, W * 0.9);
  glow.addColorStop(0, "rgba(255,106,43,0.20)");
  glow.addColorStop(1, "rgba(255,106,43,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);

  // brand mark
  c.textBaseline = "alphabetic";
  c.font = "800 44px Unbounded, sans-serif";
  c.fillStyle = "#eaf0f7";
  c.fillText("ДОКОГА", PAD, PAD + 30);
  const mw = c.measureText("ДОКОГА").width;
  c.fillStyle = "#ff6a2b";
  c.fillText("?", PAD + mw + 4, PAD + 30);

  c.font = "600 24px Manrope, sans-serif";
  c.fillStyle = "#6a7787";
  c.textAlign = "right";
  c.fillText("по данни от обществените поръчки", W - PAD, PAD + 26);
  c.textAlign = "left";

  // place + category
  c.font = "700 30px Manrope, sans-serif";
  c.fillStyle = "#9fadbd";
  c.fillText(`${d.category} · ${d.region}`, PAD, 300);

  // big risk %
  c.font = "800 220px Unbounded, sans-serif";
  c.fillStyle = risk;
  c.fillText(`${d.riskPct}%`, PAD - 6, 500);

  c.font = "700 38px Manrope, sans-serif";
  c.fillStyle = "#eaf0f7";
  c.fillText(`${RISK[d.level].label.toUpperCase()} РИСК ОТ ПРОСРОЧВАНЕ`, PAD, 560);

  // delay bar
  const barY = 660, barH = 46, barW = W - PAD * 2;
  const total = d.plannedDays + d.expectedDays;
  const pw = total > 0 ? Math.max(0.12, d.plannedDays / total) * barW : barW * 0.5;
  rr(c, PAD, barY, barW, barH, 23); c.fillStyle = "#151c26"; c.fill();
  rr(c, PAD, barY, pw, barH, 23); c.fillStyle = "#5bc8d6"; c.fill();
  // hatched overrun
  c.save();
  rr(c, PAD + pw, barY, barW - pw, barH, 23); c.clip();
  c.fillStyle = "#ff4d4d"; c.fillRect(PAD + pw, barY, barW - pw, barH);
  c.strokeStyle = "rgba(0,0,0,0.28)"; c.lineWidth = 10;
  for (let x = PAD + pw - barH; x < PAD + barW + barH; x += 26) {
    c.beginPath(); c.moveTo(x, barY + barH); c.lineTo(x + barH, barY); c.stroke();
  }
  c.restore();

  c.font = "600 26px Manrope, sans-serif";
  c.fillStyle = "#9fadbd";
  c.fillText(`обещано: ${d.plannedDays} дни`, PAD, barY + barH + 48);
  c.textAlign = "right";
  c.fillStyle = "#ff4d4d";
  c.font = "700 26px JetBrains Mono, monospace";
  c.fillText(`+${d.expectedDays} дни забавяне`, W - PAD, barY + barH + 48);
  c.textAlign = "left";

  // headline + footer
  c.font = "800 52px Unbounded, sans-serif";
  c.fillStyle = "#eaf0f7";
  c.fillText("Кога РЕАЛНО свършва", PAD, 900);
  c.fillStyle = "#ff6a2b";
  c.fillText("този ремонт?", PAD, 968);

  c.font = "500 22px Manrope, sans-serif";
  c.fillStyle = "#6a7787";
  c.fillText("Провери своя на dokoga · оценка по история, не присъда", PAD, H - 60);

  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png", 0.95));
}

/** Share via Web Share API (files) with a download fallback. */
export async function shareCard(d: CardData) {
  const blob = await renderShareCard(d);
  const file = new File([blob], "dokoga.png", { type: "image/png" });
  const text = `${d.category} в ${d.region}: ${d.riskPct}% риск от просрочване, ~${d.expectedDays} дни забавяне. Провери своя ремонт - ДОКОГА?`;

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: "ДОКОГА?", text }); return; }
    catch { /* user cancelled or share failed - fall through to download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "dokoga.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
