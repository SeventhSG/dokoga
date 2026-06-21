import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import { useEffect, useMemo, Fragment } from "react";
import type { RepairFeature } from "../lib/types";
import { riskRamp } from "../lib/risk";
import type { Theme } from "../theme";
import TrackpadPan from "./TrackpadPan";

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
    // draw high-risk last so red dots sit on top; активните - най-отгоре
    const sorted = [...features].sort((a, b) => {
      const aa = a.properties.is_active ? 1 : 0;
      const ba = b.properties.is_active ? 1 : 0;
      if (aa !== ba) return aa - ba;
      return a.properties.risk - b.properties.risk;
    });
    return sorted.map((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const c = riskRamp(f.properties.risk);
      const isSel = selected === f.properties.ocid;
      const isActive = !!f.properties.is_active;
      const ring = isSel ? (theme === "dark" ? "#fff" : "#0f1720") : isActive ? "#22d3ee" : stroke;
      const baseRadius = radiusFor(f.properties.value);
      const r = baseRadius + (isSel ? 3 : 0) + (isActive ? 2 : 0);

      return (
        <Fragment key={f.properties.ocid}>
          {/* Soft outer glowing halo for active or selected projects */}
          {(isSel || isActive) && (
            <CircleMarker
              className={isSel ? "map-halo-selected" : "map-halo-active"}
              center={[lat, lon]}
              radius={r + (isSel ? 7 : 5)}
              pathOptions={{
                color: isSel ? c : "#22d3ee",
                weight: 0,
                fillColor: isSel ? c : "#22d3ee",
                fillOpacity: isSel ? 0.22 : 0.14,
                opacity: 0,
              }}
              eventHandlers={{ click: () => onSelect(f) }}
            />
          )}
          {/* Solid core pin */}
          <CircleMarker
            center={[lat, lon]}
            radius={r}
            pathOptions={{
              color: ring,
              fillColor: c,
              fillOpacity: 0.9,
              weight: isSel ? 2.5 : isActive ? 2.0 : 0.7,
              opacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(f) }}
          />
        </Fragment>
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
      scrollWheelZoom={false}
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
      <TrackpadPan />
      <Flyer focus={focus} />
    </MapContainer>
  );
}
