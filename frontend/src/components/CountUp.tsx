import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

interface Props {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);
const fmt = (n: number, d: number) =>
  new Intl.NumberFormat("bg-BG", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

/** Counts from 0 to `to` on mount via rAF. StrictMode-safe; respects reduced-motion. */
export default function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration = 1.3 }: Props) {
  const reduce = useReducedMotion();
  const [val, setVal] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) return;   // no animation; render `to` directly below
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / (duration * 1000));
      setVal(to * EASE_OUT(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduce]);

  return <>{prefix}{fmt(reduce ? to : val, decimals)}{suffix}</>;
}
