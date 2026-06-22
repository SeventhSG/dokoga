import { MapContainer, TileLayer, CircleMarker, GeoJSON, useMap } from "react-leaflet";
import { useEffect, useMemo, Fragment } from "react";
import type { GeoJsonObject, Feature } from "geojson";
import type { PathOptions } from "leaflet";
import type { RepairFeature } from "../lib/types";
import { riskRamp } from "../lib/risk";
import type { Theme } from "../theme";
import TrackpadPan from "./TrackpadPan";

// corruption-risk choropleth color by share of high-risk contracts in the област
const hotColor = (pct: number | undefined) =>
  pct == null ? "rgba(150,160,175,0.22)" : pct >= 6 ? "#ff4d4d" : pct >= 3 ? "#ffb020" : "#2bd46a";

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
  regionGeo?: GeoJsonObject | null;
  regionRisk?: Record<string, number> | null; // region_name -> high_pct
  showRisk?: boolean;
}

export default function MapView({ features, selected, onSelect, theme, focus, regionGeo, regionRisk, showRisk }: Props) {
  const stroke = theme === "dark" ? "rgba(255,255,255,0.5)" : "rgba(15,23,32,0.4)";

  const riskStyle = (f?: Feature): PathOptions => ({
    fillColor: hotColor(regionRisk?.[(f?.properties as { region_name?: string })?.region_name ?? ""]),
    weight: 1, color: theme === "dark" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)", fillOpacity: 0.5,
  });

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
      // uniform dots: every pin colored by risk, sized by value, same stroke. Only selection changes
      // the core style; an ongoing procedure adds a subtle pulse (more info), not a different dot.
      const ring = isSel ? (theme === "dark" ? "#fff" : "#0f1720") : stroke;
      const baseRadius = radiusFor(f.properties.value);
      const r = baseRadius + (isSel ? 3 : 0);

      return (
        <Fragment key={f.properties.ocid}>
          {isSel && (
            <CircleMarker
              className="map-halo-selected"
              center={[lat, lon]}
              radius={r + 7}
              pathOptions={{ color: c, weight: 0, fillColor: c, fillOpacity: 0.22, opacity: 0 }}
              eventHandlers={{ click: () => onSelect(f) }}
            />
          )}
          {isActive && !isSel && (
            <CircleMarker
              className="map-halo-active"
              center={[lat, lon]}
              radius={r + 4}
              pathOptions={{ color: "#5bc8d6", weight: 0, fillColor: "#5bc8d6", fillOpacity: 0.13, opacity: 0 }}
              eventHandlers={{ click: () => onSelect(f) }}
            />
          )}
          {/* Solid core pin - identical style for every project */}
          <CircleMarker
            center={[lat, lon]}
            radius={r}
            pathOptions={{ color: ring, fillColor: c, fillOpacity: 0.9, weight: isSel ? 2.5 : 0.7, opacity: 1 }}
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
      {showRisk && regionGeo && (
        <GeoJSON key={`risk-${theme}`} data={regionGeo} style={riskStyle} />
      )}
      {markers}
      <TrackpadPan />
      <Flyer focus={focus} />
    </MapContainer>
  );
}
