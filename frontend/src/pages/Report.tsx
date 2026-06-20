import { MapContainer, TileLayer } from "react-leaflet";
import { useEffect, useState } from "react";
import { ReportLayer } from "../components/ReportLayer";
import { ReportForm } from "../components/ReportForm";
import { ReportPanel } from "../components/ReportPanel";
import { listReports } from "../lib/reportsApi";
import type { ReportPin } from "../lib/reportTypes";

export default function Report() {
  const [pins, setPins] = useState<ReportPin[]>([]);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  async function refresh() {
    setPins(await listReports({ min_lat: 41, min_lng: 22, max_lat: 44.5, max_lng: 29 }).catch(() => []));
  }
  useEffect(() => { refresh(); }, []);

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPicked(null); setDraft({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => alert("Няма достъп до местоположение — кликни на картата."),
    );
  }

  return (
    <div className="report-page">
      <button className="locate-btn" onClick={locate}>📍 Тук съм</button>
      <MapContainer className="map" center={[42.73, 25.4]} zoom={7} minZoom={6} maxZoom={18} preferCanvas>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          attribution="&copy; OpenStreetMap, &copy; CARTO"
        />
        <ReportLayer
          pins={pins}
          onPick={(id) => { setDraft(null); setPicked(id); }}
          onMapClick={(lat, lng) => { setPicked(null); setDraft({ lat, lng }); }}
        />
      </MapContainer>
      {draft && (
        <div className="draft-panel">
          <ReportForm lat={draft.lat} lng={draft.lng} onDone={() => { setDraft(null); refresh(); }} />
        </div>
      )}
      {picked != null && (
        <ReportPanel id={picked} onClose={() => setPicked(null)} onChanged={refresh} />
      )}
    </div>
  );
}
