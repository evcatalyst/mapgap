import { ApiError } from "../http.mjs";

export const SCHEMA_VERSION = "mapgap-routing/v1";
export const SYNTHETIC_NOTICE = "Mock isochrones — schematic reach, not network travel time.";
const MODES = ["DRIVE", "BICYCLE", "WALK", "TWO_WHEELER"];
const DIRECTIONS = ["FROM", "TO"];
const FIDELITIES = ["LOW", "MEDIUM", "HIGH", "POLYGON_FIDELITY_UNSPECIFIED"];
const PREFERENCES = ["TRAFFIC_UNAWARE", "TRAFFIC_AWARE", "ROUTING_PREFERENCE_UNSPECIFIED"];
const FIELDS = new Set(["location", "place", "travelDuration", "travelMode", "travelDirection", "routingPreference", "enableSmoothing", "polygonFidelity"]);
export const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const invalid = (message) => { throw new ApiError(400, "INVALID_ARGUMENT", message); };

export function validateGoogleRequest(input) {
  if (!isObject(input)) invalid("Request must be an object.");
  if (Object.keys(input).some((key) => !FIELDS.has(key))) invalid("Unknown request field.");
  if (!MODES.includes(input.travelMode)) invalid("Unsupported travelMode.");
  if (!DIRECTIONS.includes(input.travelDirection)) invalid("travelDirection must be FROM or TO.");
  if (typeof input.travelDuration !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,9})?s$/.test(input.travelDuration)) invalid("travelDuration must be seconds, for example 600s.");
  const seconds = Number(input.travelDuration.slice(0, -1));
  const maximum = ["DRIVE", "TWO_WHEELER"].includes(input.travelMode) ? 3600 : 7200;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > maximum) invalid(`travelDuration must be greater than zero and at most ${maximum}s for this mode.`);
  if (("location" in input) === ("place" in input)) invalid("Specify exactly one of location or place.");
  if ("location" in input) {
    const location = input.location;
    if (!isObject(location) || Object.keys(location).some((key) => !["latitude", "longitude"].includes(key)) ||
        !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) ||
        Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) invalid("location must contain valid numeric latitude and longitude.");
  } else if (typeof input.place !== "string" || !/^places\/[^/\s]+$/.test(input.place)) invalid("place must use places/{place_id}.");
  if (input.routingPreference !== undefined && !PREFERENCES.includes(input.routingPreference)) invalid("Unsupported routingPreference.");
  if (input.polygonFidelity !== undefined && !FIDELITIES.includes(input.polygonFidelity)) invalid("Unsupported polygonFidelity.");
  if (input.enableSmoothing !== undefined && typeof input.enableSmoothing !== "boolean") invalid("enableSmoothing must be boolean.");
  return input;
}

export function requestKey(input) {
  return JSON.stringify([
    input.location?.latitude, input.location?.longitude, input.place,
    Number(input.travelDuration.slice(0, -1)), input.travelMode, input.travelDirection,
    input.routingPreference === "ROUTING_PREFERENCE_UNSPECIFIED" ? "TRAFFIC_UNAWARE" : input.routingPreference ?? "TRAFFIC_UNAWARE",
    input.enableSmoothing ?? false, input.polygonFidelity ?? "POLYGON_FIDELITY_UNSPECIFIED",
  ]);
}

// Host-independent application contract. Provider identity stays outside the Google wire payload.
export function legacyToAnalysis(input) {
  if (!isObject(input) || !isObject(input.point)) invalid("A point is required.");
  const modes = { "foot-walking": "walk", "cycling-regular": "bike", "driving-car": "drive" };
  const mode = modes[input.transportMode];
  if (!mode) invalid("Unsupported transportMode.");
  if (!["synthetic", "valhalla", "google", "ors"].includes(input.provider)) invalid("Select an explicit provider.");
  if (!Array.isArray(input.ranges) || input.ranges.length < 1 || input.ranges.length > 8 ||
      input.ranges.some((value) => !Number.isFinite(value) || value <= 0)) invalid("Provide one to eight positive numeric ranges in seconds.");
  if (new Set(input.ranges).size !== input.ranges.length) invalid("Ranges must be unique.");
  const direction = input.direction ?? "FROM";
  if (!DIRECTIONS.includes(direction)) invalid("direction must be FROM or TO.");
  const analysis = {
    provider: input.provider,
    origin: { lat: input.point.lat, lng: input.point.lng },
    mode,
    direction,
    thresholdsSeconds: [...input.ranges].sort((a, b) => a - b),
    trafficPolicy: "static",
  };
  for (const seconds of analysis.thresholdsSeconds) validateGoogleRequest(toGoogleRequest(analysis, seconds));
  return analysis;
}

export function toGoogleRequest(analysis, seconds) {
  return {
    location: { latitude: analysis.origin.lat, longitude: analysis.origin.lng },
    travelDuration: `${seconds}s`,
    travelMode: { walk: "WALK", bike: "BICYCLE", drive: "DRIVE", two_wheeler: "TWO_WHEELER" }[analysis.mode],
    travelDirection: analysis.direction,
    routingPreference: "TRAFFIC_UNAWARE",
    enableSmoothing: false,
    polygonFidelity: "MEDIUM",
  };
}
