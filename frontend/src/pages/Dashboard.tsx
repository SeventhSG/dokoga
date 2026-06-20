import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "@phosphor-icons/react";
import { loadRepairs } from "../lib/api";
import type { RepairFeature } from "../lib/types";
import { riskLevel } from "../lib/risk";
import { useTheme } from "../theme";
import MapView from "../components/MapView";
import Brand from "../components/Brand";
import RegionFilter from "../components/RegionFilter";
import SectorFilter from "../components/SectorFilter";
import Legend from "../components/Legend";
import DetailCard from "../components/DetailCard";
import ChatDock from "../components/ChatDock";
import ThemeToggle from "../components/ThemeToggle";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const isHigh = (f: RepairFeature) => riskLevel(f.properties.risk) === "high";

export default function Dashboard() {
  const { theme, toggle } = useTheme();
  const [all, setAll] = useState<RepairFeature[]>([]);
  const [region, setRegion] = useState("");
  const [sector, setSector] = useState("");
  const [selected, setSelected] = useState<RepairFeature | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    loadRepairs()
      .then((c) => setAll(c.features))
      .catch(() => {});
  }, []);

  const regions = useMemo(
    () =>
      [...new Set(all.map((f) => f.properties.region).filter((r) => r && r !== "—"))].sort((a, b) =>
        a.localeCompare(b, "bg")
      ),
    [all]
  );
  const features = useMemo(
    () =>
      all.filter(
        (f) => (!region || f.properties.region === region) && (!sector || f.properties.sector === sector)
      ),
    [all, region, sector]
  );
  const sectorCounts = useMemo(() => {
    const base = region ? all.filter((f) => f.properties.region === region) : all;
    const c: Record<string, number> = { __all: base.length };
    for (const f of base) c[f.properties.sector] = (c[f.properties.sector] ?? 0) + 1;
    return c;
  }, [all, region]);
  const nationalHigh = useMemo(() => all.filter(isHigh).length, [all]);
  const viewHigh = useMemo(() => features.filter(isHigh).length, [features]);
  const atRiskPct = features.length ? Math.round((viewHigh / features.length) * 100) : 0;

  const rail = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, x: -16 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.5, delay: i * 0.08, ease: EASE } };

  return (
    <div className="stage">
      <MapView features={features} selected={selected?.properties.ocid ?? null} onSelect={setSelected} theme={theme} />

      <div className="hud">
        <div className="rail">
          <motion.div {...rail(0)}>
            <Brand total={all.length} atRisk={nationalHigh} />
          </motion.div>
          <motion.div {...rail(1)}>
            <RegionFilter regions={regions} value={region} onChange={setRegion} count={features.length} atRiskPct={atRiskPct} />
          </motion.div>
          <motion.div {...rail(2)}>
            <SectorFilter value={sector} onChange={setSector} counts={sectorCounts} />
          </motion.div>
          <motion.div {...rail(3)}>
            <Legend />
          </motion.div>
        </div>
      </div>

      <div className="topbar">
        <Link to="/" className="btn">
          <ArrowLeft size={15} weight="bold" /> Начало
        </Link>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.properties.ocid}
            className="detail"
            initial={reduce ? undefined : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 18 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <DetailCard feature={selected} onClose={() => setSelected(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <ChatDock open={chatOpen} onOpen={() => setChatOpen(true)} onClose={() => setChatOpen(false)} />
    </div>
  );
}
