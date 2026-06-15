import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import toast from "react-hot-toast";
import { reverseGeocode } from "../../lib/api";
import { debugError } from "../../lib/debug";
import { formatCoordinate } from "../../lib/format";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { MapPoint } from "../../types";

function makeMarkerIcon(point: MapPoint) {
  return L.divIcon({
    className: "mapiso-marker-shell",
    html: `<div class="mapiso-marker" style="--marker-color:${point.color}"><span></span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
    popupAnchor: [0, -34],
  });
}

export function PointMarkers({ points }: { points: MapPoint[] }) {
  const updatePoint = useMapIsoStore((state) => state.updatePoint);
  const setGeocodeStatus = useMapIsoStore((state) => state.setGeocodeStatus);
  const geocodeStatusByPointId = useMapIsoStore((state) => state.status.geocodeStatusByPointId);
  const canReverseGeocode = useMapIsoStore(
    (state) => state.status.apiCapabilities.openCage,
  );

  return (
    <>
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={makeMarkerIcon(point)}
          draggable
          eventHandlers={{
            dragend: async (event) => {
              const marker = event.target;
              const next = marker.getLatLng();
              updatePoint(point.id, { lat: next.lat, lng: next.lng, address: undefined });

              if (!canReverseGeocode) {
                setGeocodeStatus(point.id, "failed");
                return;
              }

              setGeocodeStatus(point.id, "loading");

              try {
                const address = await reverseGeocode(next.lat, next.lng);
                if (address) {
                  updatePoint(point.id, { address });
                  setGeocodeStatus(point.id, "success");
                } else {
                  setGeocodeStatus(point.id, "failed");
                }
              } catch (error) {
                setGeocodeStatus(point.id, "failed");
                debugError("Reverse geocode after drag failed", error);
                toast.error("Geocoding failed for the moved point.");
              }
            },
          }}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <div className="font-semibold">{point.name}</div>
              <div>
                {formatCoordinate(point.lat)}, {formatCoordinate(point.lng)}
              </div>
              <div className="max-w-56 text-neutral-600">
                {geocodeStatusByPointId[point.id] === "loading"
                  ? "Resolving address..."
                  : point.address || "No address"}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
