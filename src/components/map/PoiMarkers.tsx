import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { formatCoordinate } from "../../lib/format";
import type { PoiCategory, PoiLayer, PointOfInterest } from "../../types";

const CATEGORY_COLORS: Record<PoiCategory, string> = {
  grocery: "#16a34a",
  bookstore: "#7c3aed",
  laundry: "#0ea5e9",
  coffee: "#b45309",
  restaurant: "#f97316",
  "farmers-market": "#65a30d",
  butcher: "#dc2626",
  "fresh-produce": "#059669",
  hospital: "#e11d48",
  school: "#2563eb",
  library: "#9333ea",
  pharmacy: "#0891b2",
  park: "#22c55e",
  transit: "#475569",
  custom: "#0f766e",
};

function makePoiIcon(point: PointOfInterest) {
  const color = CATEGORY_COLORS[point.category] || CATEGORY_COLORS.custom;

  return L.divIcon({
    className: "mapgap-poi-marker-shell",
    html: `<div class="mapgap-poi-marker" style="--poi-color:${color}"><span></span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -10],
  });
}

export function PoiMarkers({ layers }: { layers: PoiLayer[] }) {
  const points = layers.flatMap((layer) =>
    layer.visible
      ? layer.points.map((point) => ({ ...point, layerId: layer.id, layerLabel: layer.label }))
      : [],
  );

  return (
    <>
      {points.map((point) => (
        <Marker
          key={`${point.layerId}-${point.sourceId}-${point.category}`}
          position={[point.lat, point.lng]}
          icon={makePoiIcon(point)}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <div className="font-semibold">{point.name}</div>
              <div className="text-neutral-600">{point.layerLabel}</div>
              {point.address && <div className="max-w-56 text-neutral-600">{point.address}</div>}
              <div>
                {formatCoordinate(point.lat)}, {formatCoordinate(point.lng)}
              </div>
              {point.rating !== undefined && (
                <div className="text-neutral-600">
                  Rating {point.rating.toFixed(1)}
                  {point.userRatingCount ? ` (${point.userRatingCount})` : ""}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
