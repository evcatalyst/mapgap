import { CircleMarker, Tooltip } from "react-leaflet";
import type { AnchorLocation } from "../../domain/decisionTypes";

const priorityColors: Record<AnchorLocation["priority"], string> = {
  required: "#e11d48",
  preferred: "#d97706",
  optional: "#64748b",
};

export function DecisionAnchorMarkers({ anchors }: { anchors: AnchorLocation[] }) {
  return (
    <>
      {anchors.map((anchor) => (
        <CircleMarker
          key={anchor.id}
          center={[anchor.lat, anchor.lng]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            fillColor: priorityColors[anchor.priority],
            fillOpacity: 1,
            opacity: 1,
            weight: 3,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <strong>{anchor.name}</strong>
            <br />
            {anchor.category} · {anchor.priority}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
