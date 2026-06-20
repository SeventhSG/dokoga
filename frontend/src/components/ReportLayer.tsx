import { CircleMarker, useMapEvents } from "react-leaflet";
import type { ReportPin } from "../lib/reportTypes";

const COLOR: Record<string, string> = { reported: "#f5a623", verified: "#e3402b" };

export function ReportLayer({ pins, onPick, onMapClick }: {
  pins: ReportPin[];
  onPick: (id: number) => void;
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return (
    <>
      {pins.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={6 + Math.min(p.confirmations, 6)}
          pathOptions={{ color: "#fff", weight: 1, fillColor: COLOR[p.status] ?? "#888", fillOpacity: 0.85 }}
          eventHandlers={{ click: () => onPick(p.id) }}
        />
      ))}
    </>
  );
}
