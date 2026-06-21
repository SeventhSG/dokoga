import { MapContainer, TileLayer } from "react-leaflet";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReportLayer } from "../components/ReportLayer";
import { ReportForm } from "../components/ReportForm";
import { ReportPanel } from "../components/ReportPanel";
import ThemeToggle from "../components/ThemeToggle";
import TrackpadPan from "../components/TrackpadPan";
import { useTheme, type Theme } from "../theme";
import { listReports } from "../lib/reportsApi";
import type { ReportPin } from "../lib/reportTypes";

const TILES: Record<Theme, string> = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

export default function Report() {
  const { theme, toggle } = useTheme();
  const [pins, setPins] = useState<ReportPin[]>([]);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [loadErr, setLoadErr] = useState(false);

  async function refresh() {
    try {
      setPins(await listReports({ min_lat: 41, min_lng: 22, max_lat: 44.5, max_lng: 29 }));
      setLoadErr(false);
    } catch {
      setLoadErr(true);
    }
  }
  useEffect(() => { refresh(); }, []);

  function report() {
    setPicked(null); setGeoMsg("");
    if (!navigator.geolocation) {
      setGeoMsg("Браузърът не дава местоположение — докосни картата, за да посочиш мястото.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setDraft({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setLocating(false); setGeoMsg("Няма достъп до местоположение — докосни картата, за да посочиш мястото."); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className="report-page">
      <div className="report-top">
        <div className="report-top-l">
          <Link to="/app" className="btn">← Карта</Link>
          <span className="report-title">Сигнали на граждани</span>
        </div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </div>

      <MapContainer className="map" center={[42.73, 25.4]} zoom={7} minZoom={6} maxZoom={18} scrollWheelZoom={false} preferCanvas>
        <TileLayer
          key={theme}
          url={TILES[theme]}
          subdomains="abcd"
          attribution="&copy; OpenStreetMap, &copy; CARTO"
        />
        <ReportLayer
          pins={pins}
          draft={draft}
          onPick={(id) => { setDraft(null); setPicked(id); }}
          onMapClick={(lat, lng) => { setPicked(null); setDraft({ lat, lng }); }}
        />
        <TrackpadPan />
      </MapContainer>

      {loadErr && (
        <div className="map-error" role="alert">Сигналите не се заредиха. Сървърът включен ли е?</div>
      )}

      {!draft && picked == null && (
        <div className="report-fab-wrap">
          <button className="report-fab" onClick={report} disabled={locating}>
            <span className="report-fab-icon">⚠</span>
            {locating ? "Определяме мястото…" : "Подай сигнал"}
          </button>
          <p className="report-fab-hint" role="status" aria-live="polite">
            {geoMsg || "или докосни картата, за да посочиш мястото"}
          </p>
        </div>
      )}

      {draft && (
        <div className="report-sheet" role="dialog" aria-modal="true" aria-label="Подай сигнал">
          <button className="sheet-close" onClick={() => setDraft(null)} aria-label="Затвори">×</button>
          <p className="sheet-pinhint">📍 Карфицата е поставена. Докосни друго място на картата, за да я преместиш.</p>
          <ReportForm lat={draft.lat} lng={draft.lng} onDone={() => { setDraft(null); refresh(); }} />
        </div>
      )}

      {picked != null && (
        <ReportPanel id={picked} onClose={() => setPicked(null)} onChanged={refresh} />
      )}
    </div>
  );
}
