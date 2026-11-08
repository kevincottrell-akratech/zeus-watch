import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowUpRight, LocateFixed, MapPin, Search, ShieldCheck } from "lucide-react";
import "./colony-map.css";

export type ColonyMapRow = {
  id?: string | number;
  alias?: string;
  display_name?: string;
  known_identity_count?: number;
  issue_count?: number;
  quadrant?: string;
  color?: string;
  [key: string]: unknown;
};

export type ColonyMapData = {
  parks: {
      type: string;
    features: Array<{
      type: string;
      geometry: unknown;
      properties?: { ID?: string | number; NAME?: string; [key: string]: unknown };
    }>;
  };
  locations: Array<{
    colony_id: string;
    colony_alias: string;
    park_id: string;
    park_name: string;
    coordinates: number[];
    fictional: boolean;
  }>;
  attribution: {
    countySourceUrl: string;
    countyPointSourceUrl: string;
    countyTermsUrl: string;
    countyDisclaimer: string;
  };
};

type Props = {
  colonies: ColonyMapRow[];
  mapData: ColonyMapData;
  onOpenColony: (colony: ColonyMapRow) => void;
};

const markerColors: Record<string, string> = {
  red: "#bd8065",
  amber: "#b59a53",
  blue: "#829e90",
  green: "#718d68",
  neutral: "#87977b",
  gray: "#87977b",
};

function displayName(colony: ColonyMapRow) {
  return String(colony.display_name || colony.alias || "Unnamed colony");
}

function createTooltip(label: string) {
  const element = document.createElement("span");
  element.className = "zw-map-tooltip";
  element.textContent = `Fictional demo location · ${label}`;
  return element;
}

export default function ColonyMap({ colonies, mapData, onOpenColony }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countyLayerRef = useRef<L.GeoJSON | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const onOpenColonyRef = useRef(onOpenColony);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  onOpenColonyRef.current = onOpenColony;

  const records = useMemo(() => {
    const locationById = new Map(
      mapData.locations.map((location) => [String(location.colony_id), location]),
    );
    const term = query.trim().toLocaleLowerCase();
    return colonies.map((colony) => ({
      colony,
      location: locationById.get(String(colony.id)),
    })).filter(({ colony, location }) => {
      if (!term) return true;
      return [
        colony.alias,
        colony.display_name,
        location?.park_name,
      ].some((value) => String(value || "").toLocaleLowerCase().includes(term));
    });
  }, [colonies, mapData.locations, query]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      keyboard: true,
      attributionControl: true,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      // OSM requires the request origin; keep this local to tile images.
      referrerPolicy: "origin",
    } as L.TileLayerOptions).addTo(map);
    mapRef.current = map;
    setMapReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const frame = mapElement.current?.parentElement;
    if (!map || !frame || !mapReady || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
      const bounds = countyLayerRef.current?.getBounds();
      if (bounds?.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11, animate: false });
    });
    observer.observe(frame);

    return () => {
      observer.disconnect();
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    countyLayerRef.current?.remove();
    markerLayerRef.current?.remove();

    const county = L.geoJSON(mapData.parks as unknown as GeoJSON.GeoJsonObject, {
      style: {
        color: "#78916c",
        weight: 1.15,
        opacity: 0.78,
        fillColor: "#dfe9d4",
        fillOpacity: 0.25,
      },
      interactive: false,
    }).addTo(map);
    countyLayerRef.current = county;

    const markers = L.layerGroup().addTo(map);
    markerLayerRef.current = markers;

    const bounds = county.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });

    const locationById = new Map(
      mapData.locations.map((location) => [String(location.colony_id), location]),
    );
    records.forEach(({ colony }) => {
      const location = locationById.get(String(colony.id));
      if (!location || location.fictional !== true) return;
      const latLng: L.LatLngExpression = [location.coordinates[1], location.coordinates[0]];
      const color = markerColors[String(colony.color || "").toLowerCase()] || markerColors.neutral;
      const marker = L.marker(latLng, {
        keyboard: true,
        title: `Fictional demo location for ${displayName(colony)} · ${location.park_name}`,
        alt: `Fictional demo location for ${displayName(colony)} at ${location.park_name}`,
        icon: L.divIcon({
          className: "zw-colony-marker",
          html: `<span class="zw-colony-marker__dot" style="--marker-color:${color}"><span aria-hidden="true"></span></span>`,
          iconSize: [30, 38],
          iconAnchor: [15, 30],
          tooltipAnchor: [0, -27],
        }),
        riseOnHover: true,
      });
      marker.bindTooltip(createTooltip(`${displayName(colony)} · ${location.park_name}`), {
        permanent: false,
        direction: "top",
        offset: [0, -3],
        className: "zw-map-tooltip-shell",
      });
      marker.on("click", () => {
        setSelectedId(String(colony.id));
        onOpenColonyRef.current(colony);
      });
      marker.addTo(markers);
    });

    return () => {
      county.remove();
      markers.remove();
    };
  }, [records, mapData, mapReady]);

  function selectColony(colony: ColonyMapRow) {
    setSelectedId(String(colony.id));
    onOpenColonyRef.current(colony);
  }

  function resetCountyView() {
    const map = mapRef.current;
    const countyBounds = countyLayerRef.current?.getBounds();
    if (map && countyBounds?.isValid()) {
      map.fitBounds(countyBounds, { padding: [28, 28], maxZoom: 11 });
    }
    setSelectedId(null);
  }

  return (
    <section className="colony-map-workspace" aria-label="Fictional colony map">
      <div className="colony-map-intro">
        <div>
          <span className="colony-map-eyebrow"><MapPin size={14} /> FICTIONAL DEMO MAP</span>
          <h2>Colony network</h2>
          <p>Park references help coordinators navigate stable colony records—not real colony positions.</p>
        </div>
        <button className="colony-map-reset" type="button" onClick={resetCountyView}>
          <LocateFixed size={16} /> Reset county view
        </button>
      </div>

      <div className="colony-map-layout">
        <div className="colony-map-frame">
          <div ref={mapElement} className="colony-map-canvas" role="region" aria-label="Map of Miami-Dade County parks and fictional demo locations" />
          <div className="colony-map-legend">
            <span className="colony-map-legend-dot" aria-hidden="true" />
            <span>Fictional demo location · park reference only</span>
          </div>
        </div>

        <aside className="colony-map-list" aria-label="Colony records">
          <div className="colony-map-list-heading">
            <div>
              <span className="colony-map-eyebrow">STABLE RECORDS</span>
              <h3>Find a colony <small>{colonies.length}</small></h3>
            </div>
          </div>
          <label className="colony-map-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search colonies by alias, name, or associated park</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Alias, name, or park…"
              type="search"
            />
          </label>
          <div className="colony-map-records" role="list">
            {records.map(({ colony, location }) => {
              const id = String(colony.id);
              return (
                <div className="colony-map-record-item" key={id} role="listitem">
                  <button
                    className={`colony-map-record${selectedId === id ? " is-selected" : ""}`}
                    data-colony-id={id}
                    type="button"
                    onClick={() => selectColony(colony)}
                    aria-label={`Open ${displayName(colony)}; fictional demo location${location ? ` at ${location.park_name}` : ""}`}
                    aria-current={selectedId === id ? "true" : undefined}
                  >
                    <span className="colony-map-record-marker" aria-hidden="true">
                      <span style={{ background: markerColors[String(colony.color || "").toLowerCase()] || markerColors.neutral }} />
                    </span>
                    <span className="colony-map-record-copy">
                      <strong>{displayName(colony)}</strong>
                      <small>{location?.park_name || "Park reference unavailable"}</small>
                    </span>
                    <span className="colony-map-record-count">{colony.known_identity_count ?? "—"}<small>known</small></span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            {!records.length && (
              <div className="colony-map-empty" role="status">
                <Search size={20} />
                <strong>No matching colony</strong>
                <span>Try an alias, colony name, or park name.</span>
              </div>
            )}
          </div>
          <div className="colony-map-safety-note">
            <ShieldCheck size={16} />
            <span>Human-reviewed fictional rescue-care workspace. Pins are not real colony locations.</span>
          </div>
        </aside>
      </div>

      <div className="colony-map-attribution">
        <p>{mapData.attribution.countyDisclaimer}</p>
        <div>
          <a href={mapData.attribution.countySourceUrl} target="_blank" rel="noreferrer">County park boundary source</a>
          <a href={mapData.attribution.countyPointSourceUrl} target="_blank" rel="noreferrer">County park point source</a>
          <a href={mapData.attribution.countyTermsUrl} target="_blank" rel="noreferrer">County terms and disclaimer</a>
        </div>
      </div>
    </section>
  );
}
