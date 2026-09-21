import manifest from "./fixtures/manifest.json" with { type: "json" };
import from300 from "./fixtures/albany-walk-from-300s.response.json" with { type: "json" };
import from600 from "./fixtures/albany-walk-from-600s.response.json" with { type: "json" };
import from1200 from "./fixtures/albany-walk-from-1200s.response.json" with { type: "json" };
import to600 from "./fixtures/albany-walk-to-600s.response.json" with { type: "json" };
import hole600 from "./fixtures/albany-walk-hole-600s.response.json" with { type: "json" };
import disconnected from "./fixtures/albany-drive-disconnected-900s.response.json" with { type: "json" };
import from300Request from "./fixtures/albany-walk-from-300s.request.json" with { type: "json" };
import from600Request from "./fixtures/albany-walk-from-600s.request.json" with { type: "json" };
import from1200Request from "./fixtures/albany-walk-from-1200s.request.json" with { type: "json" };
import to600Request from "./fixtures/albany-walk-to-600s.request.json" with { type: "json" };
import holeRequest from "./fixtures/albany-walk-hole-600s.request.json" with { type: "json" };
import disconnectedRequest from "./fixtures/albany-drive-disconnected-900s.request.json" with { type: "json" };
import { ApiError } from "../http.mjs";
import { requestKey } from "./contract.mjs";

const fixtures = {
  "albany-walk-from-300s": [from300Request, from300],
  "albany-walk-from-600s": [from600Request, from600],
  "albany-walk-from-1200s": [from1200Request, from1200],
  "albany-walk-to-600s": [to600Request, to600],
  "albany-walk-hole-600s": [holeRequest, hole600],
  "albany-drive-disconnected-900s": [disconnectedRequest, disconnected],
};
const errorStatuses = { 400: "INVALID_ARGUMENT", 403: "PERMISSION_DENIED", 404: "NOT_FOUND", 429: "RESOURCE_EXHAUSTED", 503: "UNAVAILABLE" };

export const scenarios = manifest;

export function generateSynthetic(request, { mode = "fixtures", scenario } = {}) {
  if (!["fixtures", "schematic"].includes(mode)) throw new ApiError(503, "FAILED_PRECONDITION", "Synthetic mode is not configured.");
  if (scenario?.startsWith("error-")) {
    const code = Number(scenario.slice(6));
    if (errorStatuses[code]) throw new ApiError(code, errorStatuses[code], `Synthetic ${errorStatuses[code]} fixture for MapGap UI testing.`, code === 429 ? { "Retry-After": "2" } : {});
  }
  const key = requestKey(request);
  if (scenario) {
    const fixture = fixtures[scenario];
    if (!fixture) throw new ApiError(404, "NOT_FOUND", "Unknown synthetic scenario.");
    if (requestKey(fixture[0]) !== key) throw new ApiError(409, "SCENARIO_MISMATCH", "This scenario does not match the requested origin and settings.");
    return structuredClone(fixture[1]);
  }
  const matched = Object.values(fixtures).find(([expected]) => requestKey(expected) === key);
  if (matched) return structuredClone(matched[1]);
  if (mode === "fixtures") throw new ApiError(404, "NOT_FOUND", "No synthetic scenario matches this origin and settings.");
  if (!request.location) throw new ApiError(404, "NOT_FOUND", "No synthetic place lookup exists. Use coordinates.");
  if (Math.abs(request.location.latitude) > 85) throw new ApiError(422, "UNSUPPORTED_SCHEMATIC_ORIGIN", "The schematic preview supports latitudes between -85 and 85.");
  if (request.routingPreference === "TRAFFIC_AWARE") throw new ApiError(422, "UNSUPPORTED_TRAFFIC_POLICY", "Synthetic contours do not model traffic.");
  return schematic(request);
}

function schematic(request) {
  // Display-only geometry. These constants and direction offsets are not routing models.
  const speed = { WALK: 4.5, BICYCLE: 15, DRIVE: 40, TWO_WHEELER: 35 }[request.travelMode];
  const radius = speed * Number(request.travelDuration.slice(0, -1)) / 3600;
  const { latitude: lat, longitude: lng } = request.location;
  const count = { LOW: 32, MEDIUM: 64, HIGH: 96 }[request.polygonFidelity] ?? 64;
  const direction = request.travelDirection === "TO" ? -1 : 1;
  const ring = Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    return [
      lng + radius * (Math.cos(angle) * 1.1 + direction * 0.08) / (111.32 * Math.cos(lat * Math.PI / 180)),
      lat + radius * Math.sin(angle) * 0.82 / 111.32,
    ];
  });
  if (ring.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90)) throw new ApiError(422, "UNSUPPORTED_SCHEMATIC_ORIGIN", "Schematic geometry would cross the date line or a pole.");
  ring.push([...ring[0]]);
  return { isochrone: { geoJson: { type: "Polygon", coordinates: [ring] } } };
}
