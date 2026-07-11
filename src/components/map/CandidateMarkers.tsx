import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { CandidateHome } from "../../domain/decisionTypes";
import { formatCoordinate } from "../../lib/format";

function scoreColor(score: number) {
  if (score >= 85) {
    return "#059669";
  }

  if (score >= 70) {
    return "#16a34a";
  }

  if (score >= 50) {
    return "#f59e0b";
  }

  return "#dc2626";
}

function makeCandidateIcon(candidate: CandidateHome, index: number) {
  const score = candidate.score?.total || 0;

  return L.divIcon({
    className: "mapgap-candidate-marker-shell",
    html: `<div class="mapgap-candidate-marker" style="--candidate-color:${scoreColor(
      score,
    )}"><span>${index + 1}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -14],
  });
}

export function CandidateMarkers({ candidates }: { candidates: CandidateHome[] }) {
  return (
    <>
      {candidates.map((candidate, index) => (
        <Marker
          key={candidate.id}
          position={[candidate.lat, candidate.lng]}
          icon={makeCandidateIcon(candidate, index)}
        >
          <Popup>
            <div className="space-y-2 text-sm">
              <div>
                <div className="font-semibold">{candidate.label}</div>
                <div className="text-neutral-600">
                  {formatCoordinate(candidate.lat)}, {formatCoordinate(candidate.lng)}
                </div>
              </div>
              <div className="font-medium">Score {candidate.score?.total ?? 0}/100</div>
              {candidate.score?.components.slice(0, 4).map((component) => (
                <div key={component.key} className="text-xs text-neutral-600">
                  {component.label}: {component.value}
                </div>
              ))}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
