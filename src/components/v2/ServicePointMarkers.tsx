import L from "leaflet";
import { useState } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import { SERVICE_POINT_COLORS } from "../../lib/servicePoints";
import type { ServicePoint } from "../../types";

type ServicePointMarkersProps = {
  compact?: boolean;
  points: ServicePoint[];
  selectedPointId?: string | null;
  onSelect: (point: ServicePoint) => void;
};

function getMarkerVisualSize(zoom: number, selected: boolean, compact: boolean) {
  if (compact) {
    const compactSize = zoom <= 9 ? 6 : zoom <= 11 ? 8 : 10;
    return selected ? compactSize + 4 : compactSize;
  }

  const baseSize = zoom <= 8 ? 12 : zoom <= 9 ? 15 : zoom <= 10 ? 18 : zoom <= 11 ? 22 : 28;

  return selected ? Math.min(34, baseSize + 6) : baseSize;
}

function makeServicePointIcon(
  point: ServicePoint,
  selected: boolean,
  zoom: number,
  compact: boolean,
) {
  const color = SERVICE_POINT_COLORS[point.category];
  const selectedClass = selected ? " mapgap-service-marker--selected" : "";
  const visualSize = getMarkerVisualSize(zoom, selected, compact);
  const hitSize = selected ? 36 : compact ? 24 : 28;

  return L.divIcon({
    className: "mapgap-service-marker-shell",
    html: `<div class="mapgap-service-marker${selectedClass}" style="--service-color:${color};--service-marker-size:${visualSize}px"><span></span></div>`,
    iconSize: [hitSize, hitSize],
    iconAnchor: [hitSize / 2, hitSize / 2],
    popupAnchor: [0, -12],
  });
}

export function ServicePointMarkers({
  compact = false,
  points,
  selectedPointId,
  onSelect,
}: ServicePointMarkersProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  return (
    <>
      {points.map((point) => {
        const selected = point.id === selectedPointId;

        return (
          <Marker
            key={point.id}
            position={[point.location.lat, point.location.lng]}
            icon={makeServicePointIcon(point, selected, zoom, compact)}
            eventHandlers={{
              click: () => onSelect(point),
            }}
          />
        );
      })}
    </>
  );
}
