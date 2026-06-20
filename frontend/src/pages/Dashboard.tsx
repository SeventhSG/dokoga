import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "@phosphor-icons/react";
import { loadRepairs } from "../lib/api";
import type { RepairFeature, ChatFocus } from "../lib/types";
import { riskLevel } from "../lib/risk";
import { useTheme } from "../theme";
import MapView, { type FocusTarget } from "../components/MapView";

// център на всяка област (NUTS) - за полет към област от чата
const REGION_CENTER: Record<string, [number, number]> = {
  "Видин": [43.99, 22.88], "Монтана": [43.41, 23.23], "Враца": [43.21, 23.55],
  "Плевен": [43.42, 24.61], "Ловеч": [43.13, 24.71], "Велико Търново": [43.08, 25.63],
  "Габрово": [42.87, 25.32], "Русе": [43.85, 25.97], "Разград": [43.53, 26.52],
  "Силистра": [44.12, 27.26], "Варна": [43.2, 27.91], "Добрич": [43.57, 27.83],
  "Шумен": [43.27, 26.93], "Търговище": [43.25, 26.57], "Бургас": [42.5, 27.47],
  "Сливен": [42.68, 26.32], "Ямбол": [42.48, 26.5], "Стара Загора": [42.43, 25.64],
  "София (столица)": [42.7, 23.32], "София област": [42.55, 23.5], "Благоевград": [42.02, 23.1],
  "Перник": [42.6, 23.04], "Кюстендил": [42.28, 22.69], "Пловдив": [42.14, 24.75],
  "Пазарджик": [42.19, 24.33], "Смолян": [41.57, 24.71], "Хасково": [41.93, 25.56],
  "Кърджали": [41.65, 25.37],
};
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
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const focusKey = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    loadRepairs()
      .then((c) => setAll(c.features))
      .catch(() => {});
  }, []);

  const regions = useMemo(
    () =>
      [...new Set(all.map((f) => f.properties.region).filter((r) => r && r !== "-"))].sort((a, b) =>
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

  // чатът поиска да фокусираме картата към проект (ocid) или област
  function handleChatFocus(f: ChatFocus) {
    let target: [number, number] | null = null;
    let zoom = 9;
    if (f.ocid) {
      const feat = all.find((x) => x.properties.ocid === f.ocid);
      if (feat) {
        setRegion("");
        setSector("");
        setSelected(feat);
        const [lon, lat] = feat.geometry.coordinates;
        target = [lat, lon];
        zoom = 12;
      }
    }
    if (!target && f.region && REGION_CENTER[f.region]) {
      target = REGION_CENTER[f.region];
      zoom = 9;
    }
    if (target) {
      focusKey.current += 1;
      setFocus({ lat: target[0], lon: target[1], zoom, key: focusKey.current });
    }
  }

  return (
    <div className="stage">
      <MapView features={features} selected={selected?.properties.ocid ?? null} onSelect={setSelected} theme={theme} focus={focus} />

      <div className="hud">
        <div className="rail">
          <motion.div {...rail(0)} style={{ position: "relative", zIndex: 40 }}>
            <Brand total={all.length} atRisk={nationalHigh} />
          </motion.div>
          <motion.div {...rail(1)} style={{ position: "relative", zIndex: 30 }}>
            <RegionFilter regions={regions} value={region} onChange={setRegion} count={features.length} atRiskPct={atRiskPct} />
          </motion.div>
          <motion.div {...rail(2)} style={{ position: "relative", zIndex: 20 }}>
            <SectorFilter value={sector} onChange={setSector} counts={sectorCounts} />
          </motion.div>
          <motion.div {...rail(3)} style={{ position: "relative", zIndex: 10 }}>
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

      <ChatDock open={chatOpen} onOpen={() => setChatOpen(true)} onClose={() => setChatOpen(false)} onFocus={handleChatFocus} />
    </div>
  );
}
