import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ColonyMapData, ColonyMapRow } from "./ColonyMap";

type Props = {
  colony: ColonyMapRow;
  mapData: ColonyMapData;
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

export default function SelectedParkMap({ colony, mapData }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const colonyId = String(colony.id ?? "");
    const location = mapData.locations.find(
      (entry) => String(entry.colony_id) === colonyId && entry.fictional === true,
    );
    const parkId = location ? String(location.park_id) : "";
    const park = location
      ? mapData.parks.features.find(
          (feature) => String(feature.properties?.ID ?? "") === parkId,
        )
      : undefined;

    canvas.dataset.zoom = "";
    canvas.dataset.selectedPointVisible = "false";
    if (!location || location.coordinates.length < 2 ||
        !Number.isFinite(location.coordinates[0]) || !Number.isFinite(location.coordinates[1])) return;

    const map = L.map(canvas, {
      zoomControl: false,
      scrollWheelZoom: true,
      keyboard: true,
      attributionControl: true,
      zoomSnap: 0.25,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      referrerPolicy: "origin",
    } as L.TileLayerOptions).addTo(map);

    const selectedPoint = location && location.coordinates.length >= 2
      ? L.latLng(location.coordinates[1], location.coordinates[0])
      : null;
    let parkBounds: L.LatLngBounds | null = null;

    if (park) {
      const boundary = L.geoJSON(park as unknown as GeoJSON.GeoJsonObject, {
        style: {
          color: "#6e8661",
          weight: 2,
          opacity: 0.9,
          fillColor: "#cbd8bf",
          fillOpacity: 0.24,
        },
        interactive: false,
      }).addTo(map);
      const bounds = boundary.getBounds();
      if (bounds.isValid()) parkBounds = bounds;
    }

    if (location && selectedPoint) {
      const color = markerColors[String(colony.color || "").toLowerCase()] || markerColors.neutral;
      L.marker(selectedPoint, {
        keyboard: false,
        title: `Fictional demo location for ${displayName(colony)}`,
        alt: `Fictional demo location for ${displayName(colony)}; park reference only`,
        icon: L.divIcon({
          className: "zw-colony-marker",
          html: `<span class="zw-colony-marker__dot" style="--marker-color:${color}"><span aria-hidden="true"></span></span>`,
          iconSize: [30, 38],
          iconAnchor: [15, 30],
        }),
        interactive: false,
      }).addTo(map);
    }

    const updateMapData = () => {
      canvas.dataset.zoom = String(map.getZoom());
      canvas.dataset.selectedPointVisible = String(
        selectedPoint ? map.getBounds().contains(selectedPoint) : false,
      );
    };
    map.on("zoomend moveend", updateMapData);

    const fitSelectedLocation = () => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
      if (parkBounds?.isValid()) {
        map.fitBounds(parkBounds, { padding: [36, 36], maxZoom: 15, animate: false });
      } else if (selectedPoint) {
        map.setView(selectedPoint, 15, { animate: false });
      }
      updateMapData();
    };

    let frameId = requestAnimationFrame(fitSelectedLocation);
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          cancelAnimationFrame(frameId);
          frameId = requestAnimationFrame(fitSelectedLocation);
        });
    observer?.observe(canvas);

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frameId);
      map.off("zoomend moveend", updateMapData);
      map.remove();
    };
  }, [colony, mapData]);

  const colonyId = String(colony.id ?? "");
  const location = mapData.locations.find(
    (entry) => String(entry.colony_id) === colonyId && entry.fictional === true,
  );

  return (
    <div
      className="selected-park-map"
      data-colony-id={colonyId}
      data-park-id={location ? String(location.park_id) : ""}
      aria-label={`Close-up map for ${displayName(colony)}`}
    >
      <div className="selected-park-caption">
        {location ? location.park_name : "Park reference: Not recorded"}
      </div>
      <div
        ref={canvasRef}
        className="selected-park-canvas"
        role="region"
        aria-label={`Selected fictional park reference map for ${displayName(colony)}`}
      />
    </div>
  );
}
