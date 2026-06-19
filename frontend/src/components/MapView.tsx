import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import { useMemo } from "react";
import type { RepairFeature } from "../lib/types";
import { riskColor } from "../lib/risk";

interface Props {
  features: RepairFeature[];
  selected: string | null;
  onSelect: (f: RepairFeature) => void;
}

function radiusFor(value: number | null) {
  const v = Math.log10(Math.max(value ?? 8000, 1000));
  return 4 + Math.min(Math.max(v - 3, 0), 4) * 1.6;
}

export default function MapView({ features, selected, onSelect }: Props) {
  const markers = useMemo(
    () =>
      features.map((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const c = riskColor(f.properties.risk);
        const isSel = selected === f.properties.ocid;
        return (
          <CircleMarker
            key={f.properties.ocid}
            center={[lat, lon]}
            radius={radiusFor(f.properties.value) + (isSel ? 3 : 0)}
            pathOptions={{
              className: "repair-dot",
              color: isSel ? "#fff" : c,
              fillColor: c,
              fillOpacity: 0.62,
              weight: isSel ? 2.5 : 1,
              opacity: 0.9,
            }}
            eventHandlers={{ click: () => onSelect(f) }}
          />
        );
      }),
    [features, selected, onSelect]
  );

  return (
    <MapContainer
      className="map"
      center={[42.73, 25.4]}
      zoom={7}
      minZoom={6}
      maxZoom={13}
      zoomControl={false}
      preferCanvas
      attributionControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap, &copy; CARTO · данни: data.egov.bg'
        subdomains="abcd"
      />
      {markers}
    </MapContainer>
  );
}
