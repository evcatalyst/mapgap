import { GeoJSON, Popup } from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import { MOBILITY_MODES, ROUTING_PROVIDER_LABELS } from "../../constants";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { IsochroneFeature } from "../../types";

export function IsochroneLayer({ features }: { features: IsochroneFeature[] }) {
  const settings = useMapIsoStore((state) => state.settings);
  const sortedFeatures = [...features].sort(
    (a, b) => b.properties.bucketMinutes - a.properties.bucketMinutes,
  );

  return (
    <>
      {sortedFeatures.map((feature) => {
        return (
          <GeoJSON
            key={`${feature.properties.id}-${settings.isochroneMode}-hit`}
            data={feature as GeoJsonObject}
            style={{
              className:
                settings.isochroneMode === "overlap"
                  ? "mapiso-network-hit-area mapiso-shared-access"
                  : "mapiso-network-hit-area",
              color: "transparent",
              fillColor: "transparent",
              fillOpacity: 0.001,
              opacity: 0,
              weight: 0,
              lineCap: "round",
              lineJoin: "round",
            }}
            eventHandlers={{
              mouseover: (event) => {
                event.originalEvent.stopPropagation();
              },
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{feature.properties.pointName}</div>
                <div>{feature.properties.bucketMinutes} minute network ring</div>
                <div>
                  {ROUTING_PROVIDER_LABELS[feature.properties.routingProvider]} routing,
                  terrain effort estimate {feature.properties.adjustedMinutes} min
                </div>
                {settings.isochroneMode === "overlap" && (
                  <div className="text-neutral-600">
                    Blended areas mean shared access from multiple points, not faster travel.
                  </div>
                )}
                <div className="text-neutral-600">
                  {MOBILITY_MODES[feature.properties.mobilityMode].label} mode,
                  effort +{feature.properties.effortScore}%
                </div>
              </div>
            </Popup>
          </GeoJSON>
        );
      })}
    </>
  );
}
