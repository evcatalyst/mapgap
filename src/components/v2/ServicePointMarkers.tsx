import L from "leaflet";
import { Marker } from "react-leaflet";
import { SERVICE_POINT_COLORS } from "../../lib/servicePoints";
import type { ServicePoint } from "../../types";

type ServicePointMarkersProps = {
  points: ServicePoint[];
  selectedPointId?: string | null;
  onSelect: (point: ServicePoint) => void;
};

function makeServicePointIcon(point: ServicePoint, selected: boolean) {
  const color = SERVICE_POINT_COLORS[point.category];
  const selectedClass = selected ? " mapgap-service-marker--selected" : "";

  return L.divIcon({
    className: "mapgap-service-marker-shell",
    html: `<div class="mapgap-service-marker${selectedClass}" style="--service-color:${color}"><span></span></div>`,
    iconSize: selected ? [36, 36] : [28, 28],
    iconAnchor: selected ? [18, 18] : [14, 14],
    popupAnchor: [0, -12],
  });
}

export function ServicePointMarkers({
  points,
  selectedPointId,
  onSelect,
}: ServicePointMarkersProps) {
  return (
    <>
      {points.map((point) => {
        const selected = point.id === selectedPointId;

        return (
          <Marker
            key={point.id}
            position={[point.location.lat, point.location.lng]}
            icon={makeServicePointIcon(point, selected)}
            eventHandlers={{
              click: () => onSelect(point),
            }}
          />
        );
      })}
    </>
  );
}
