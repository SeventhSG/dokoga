import { CircleMarker, useMapEvents, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { ReportPin } from "../lib/reportTypes";

const COLOR: Record<string, string> = { reported: "#f5a623", verified: "#e3402b" };

interface Draft { lat: number; lng: number; }

/** Flies the map to the draft pin so the user can see where it will land. */
function Recenter({ draft }: { draft: Draft | null }) {
  const map = useMap();
  useEffect(() => {
    if (draft) map.flyTo([draft.lat, draft.lng], Math.max(map.getZoom(), 16), { duration: 0.7 });
  }, [draft, map]);
  return null;
}

export function ReportLayer({ pins, draft, onPick, onMapClick }: {
  pins: ReportPin[];
  draft: Draft | null;
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
      {draft && (
        <>
          <CircleMarker center={[draft.lat, draft.lng]} radius={18}
            pathOptions={{ color: "#f5a623", weight: 2, fillColor: "#f5a623", fillOpacity: 0.2 }} />
          <CircleMarker center={[draft.lat, draft.lng]} radius={8}
            pathOptions={{ color: "#fff", weight: 3, fillColor: "#e3402b", fillOpacity: 1 }} />
        </>
      )}
      <Recenter draft={draft} />
    </>
  );
}
