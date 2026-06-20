import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { RepairFeature } from "../lib/types";
import { riskRamp } from "../lib/risk";
import type { Theme } from "../theme";

export interface FocusTarget {
  lat: number;
  lon: number;
  zoom: number;
  key: number; // bump to re-trigger even for same coords
}

/** Smoothly flies the map to a focus target (driven by the AI chat). */
function Flyer({ focus }: { focus: FocusTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lon], focus.zoom, { duration: 1.4, easeLinearity: 0.18 });
  }, [focus, map]);
  return null;
}

const TILES: Record<Theme, string> = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

function radiusFor(value: number | null) {
  const v = Math.log10(Math.max(value ?? 8000, 1000));
  return 3 + Math.min(Math.max(v - 3, 0), 4) * 1.1;
}

interface Props {
  features: RepairFeature[];
  selected: string | null;
  onSelect: (f: RepairFeature) => void;
  theme: Theme;
  focus: FocusTarget | null;
}

export default function MapView({ features, selected, onSelect, theme, focus }: Props) {
  const stroke = theme === "dark" ? "rgba(255,255,255,0.5)" : "rgba(15,23,32,0.4)";

  const markers = useMemo(() => {
    // draw high-risk last so red dots sit on top
    const sorted = [...features].sort((a, b) => a.properties.risk - b.properties.risk);
    return sorted.map((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const c = riskRamp(f.properties.risk);
      const isSel = selected === f.properties.ocid;
      return (
        <CircleMarker
          key={f.properties.ocid}
          center={[lat, lon]}
          radius={radiusFor(f.properties.value) + (isSel ? 3 : 0)}
          pathOptions={{
            color: isSel ? (theme === "dark" ? "#fff" : "#0f1720") : stroke,
            fillColor: c,
            fillOpacity: 0.85,
            weight: isSel ? 2.5 : 0.7,
            opacity: 1,
          }}
          eventHandlers={{ click: () => onSelect(f) }}
        />
      );
    });
  }, [features, selected, onSelect, theme, stroke]);

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
        key={theme}
        url={TILES[theme]}
        attribution='&copy; OpenStreetMap, &copy; CARTO · данни: data.egov.bg'
        subdomains="abcd"
      />
      {markers}
      <Flyer focus={focus} />
    </MapContainer>
  );
}
