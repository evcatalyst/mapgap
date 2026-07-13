export const V2_CONTEXT_SCHEMA = "mapgap.v2.context/v1" as const;
export const V2_READY_SCHEMA = "mapgap.v2.ready/v1" as const;
export const V2_CONTEXT_MAX_BYTES = 384 * 1024;

const categories = new Set(["laundry", "coffee", "grocery", "library", "custom"]);
const sources = new Set(["google_places", "ny_libraries", "nj_libraries", "hybrid", "openstreetmap", "official_local"]);
const heatModes = new Set(["off", "walk", "drive"]);
const mobilityModes = new Set(["walk", "bike", "stroller", "senior"]);
const transportModes = new Set(["driving-car", "cycling-regular", "foot-walking"]);
const routingProviders = new Set(["ors", "valhalla"]);
const isochroneModes = new Set(["unified", "individual", "overlap"]);

export type V2ServicePoint = {
  id: string;
  name: string;
  category: string;
  categoryLabel?: string;
  location: {lat: number; lng: number};
  source: string;
  address?: string;
  sourceDatasetId?: string;
  sourceUpdatedAt?: string;
  jurisdiction?: "NY" | "NJ";
  confidence?: "high" | "medium" | "low";
};

export type V2Isochrone = {
  type: "Feature";
  geometry: {type: "Polygon" | "MultiPolygon"; coordinates: unknown};
  properties: {
    id: string;
    pointId: string;
    pointName: string;
    color: string;
    timeMinutes: number;
    bucketMinutes: number;
    adjustedMinutes: number;
    effortScore: number;
    mobilityMode: string;
    transportMode: string;
    routingProvider: string;
    isochroneMode: string;
  };
};

export type V2Context = {
  bbox: [number, number, number, number];
  category: string | null;
  query?: string;
  activeExtensions: string[];
  selectedPointId: string | null;
  servicePoints: V2ServicePoint[];
  isochrones: V2Isochrone[];
  heatmapMode: "off" | "walk" | "drive";
};

export type V2ContextEnvelope = {
  schema: typeof V2_CONTEXT_SCHEMA;
  revision: number;
  context: V2Context;
};

export type V2ContextRejection =
  | "origin" | "source" | "bytes" | "shape" | "revision";

/**
 * The host accepts only the documented one-way bridge message. It rejects
 * unexpected keys so internal V2 state, credentials, and provider payloads
 * cannot accidentally cross the deployment boundary.
 */
export function validateV2ContextEvent(options: {
  event: MessageEvent<unknown>;
  expectedOrigin: string;
  expectedSource: Window | null;
  lastRevision: number;
}): {ok: true; value: V2ContextEnvelope} | {ok: false; reason: V2ContextRejection} {
  const {event, expectedOrigin, expectedSource, lastRevision} = options;
  if (event.origin !== expectedOrigin) return {ok: false, reason: "origin"};
  if (!expectedSource || event.source !== expectedSource) return {ok: false, reason: "source"};
  let bytes = V2_CONTEXT_MAX_BYTES + 1;
  try { bytes = new TextEncoder().encode(JSON.stringify(event.data)).byteLength; } catch { /* rejected below */ }
  if (bytes > V2_CONTEXT_MAX_BYTES) return {ok: false, reason: "bytes"};
  const envelope = parseEnvelope(event.data);
  if (!envelope) return {ok: false, reason: "shape"};
  if (envelope.revision <= lastRevision) return {ok: false, reason: "revision"};
  return {ok: true, value: envelope};
}

export function makeV2ReadyMessage() {
  return {schema: V2_READY_SCHEMA, contextSchema: V2_CONTEXT_SCHEMA} as const;
}

function parseEnvelope(value: unknown): V2ContextEnvelope | null {
  if (!isExactRecord(value, ["schema", "revision", "context"])) return null;
  if (value.schema !== V2_CONTEXT_SCHEMA || !isInteger(value.revision, 1, Number.MAX_SAFE_INTEGER)) return null;
  const context = parseContext(value.context);
  return context ? {schema: V2_CONTEXT_SCHEMA, revision: value.revision, context} : null;
}

function parseContext(value: unknown): V2Context | null {
  if (!isExactRecord(value, ["bbox", "category", "query", "activeExtensions", "selectedPointId", "servicePoints", "isochrones", "heatmapMode"], ["query"])) return null;
  const bbox = parseBbox(value.bbox);
  const category = value.category === null ? null : typeof value.category === "string" && categories.has(value.category) ? value.category : undefined;
  const query = value.query === undefined ? undefined : safeString(value.query, 240);
  const selectedPointId = value.selectedPointId === null ? null : safeString(value.selectedPointId, 160);
  if (!bbox || category === undefined || (value.query !== undefined && query === undefined) || selectedPointId === undefined) return null;
  if (!Array.isArray(value.activeExtensions) || value.activeExtensions.length > 32) return null;
  const activeExtensions = value.activeExtensions.map((entry) => safeString(entry, 120));
  if (activeExtensions.some((entry) => !entry) || new Set(activeExtensions).size !== activeExtensions.length) return null;
  if (!Array.isArray(value.servicePoints) || value.servicePoints.length > 200) return null;
  const servicePoints = value.servicePoints.map(parseServicePoint);
  if (servicePoints.some((entry) => !entry)) return null;
  if (!Array.isArray(value.isochrones) || value.isochrones.length > 80) return null;
  const isochrones = value.isochrones.map(parseIsochrone);
  if (isochrones.some((entry) => !entry)) return null;
  if (typeof value.heatmapMode !== "string" || !heatModes.has(value.heatmapMode)) return null;
  return {
    bbox,
    category,
    ...(query ? {query} : {}),
    activeExtensions: activeExtensions as string[],
    selectedPointId,
    servicePoints: servicePoints as V2ServicePoint[],
    isochrones: isochrones as V2Isochrone[],
    heatmapMode: value.heatmapMode as V2Context["heatmapMode"],
  };
}

function parseServicePoint(value: unknown): V2ServicePoint | null {
  const required = ["id", "name", "category", "location", "source"];
  const optional = ["categoryLabel", "address", "sourceDatasetId", "sourceUpdatedAt", "jurisdiction", "confidence"];
  if (!isExactRecord(value, [...required, ...optional], optional)) return null;
  const id = safeString(value.id, 160);
  const name = safeString(value.name, 240);
  if (!id || !name || typeof value.category !== "string" || !categories.has(value.category) || typeof value.source !== "string" || !sources.has(value.source)) return null;
  if (!isExactRecord(value.location, ["lat", "lng"])) return null;
  if (!finiteIn(value.location.lat, -90, 90) || !finiteIn(value.location.lng, -180, 180)) return null;
  const stringFields = [["categoryLabel", 120], ["address", 320], ["sourceDatasetId", 160], ["sourceUpdatedAt", 80]] as const;
  for (const [field, max] of stringFields) if (value[field] !== undefined && !safeString(value[field], max)) return null;
  if (value.jurisdiction !== undefined && value.jurisdiction !== "NY" && value.jurisdiction !== "NJ") return null;
  if (value.confidence !== undefined && value.confidence !== "high" && value.confidence !== "medium" && value.confidence !== "low") return null;
  return value as unknown as V2ServicePoint;
}

function parseIsochrone(value: unknown): V2Isochrone | null {
  if (!isExactRecord(value, ["type", "geometry", "properties"]) || value.type !== "Feature") return null;
  if (!isExactRecord(value.geometry, ["type", "coordinates"])) return null;
  if (value.geometry.type !== "Polygon" && value.geometry.type !== "MultiPolygon") return null;
  if (!validCoordinates(value.geometry.coordinates, value.geometry.type, {count: 0})) return null;
  const keys = ["id", "pointId", "pointName", "color", "timeMinutes", "bucketMinutes", "adjustedMinutes", "effortScore", "mobilityMode", "transportMode", "routingProvider", "isochroneMode"];
  if (!isExactRecord(value.properties, keys)) return null;
  for (const [field, max] of [["id", 160], ["pointId", 160], ["pointName", 240], ["color", 32]] as const) if (!safeString(value.properties[field], max)) return null;
  for (const field of ["timeMinutes", "bucketMinutes", "adjustedMinutes", "effortScore"] as const) if (!finiteIn(value.properties[field], 0, field === "effortScore" ? 1_000_000 : 1_440)) return null;
  if (typeof value.properties.mobilityMode !== "string" || !mobilityModes.has(value.properties.mobilityMode)) return null;
  if (typeof value.properties.transportMode !== "string" || !transportModes.has(value.properties.transportMode)) return null;
  if (typeof value.properties.routingProvider !== "string" || !routingProviders.has(value.properties.routingProvider)) return null;
  if (typeof value.properties.isochroneMode !== "string" || !isochroneModes.has(value.properties.isochroneMode)) return null;
  return value as unknown as V2Isochrone;
}

function validCoordinates(value: unknown, kind: "Polygon" | "MultiPolygon", budget: {count: number}) {
  const polygons = kind === "Polygon" ? [value] : value;
  if (!Array.isArray(polygons) || polygons.length === 0) return false;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) return false;
      for (const position of ring) {
        budget.count += 1;
        if (budget.count > 12_000 || !Array.isArray(position) || position.length !== 2 || !finiteIn(position[0], -180, 180) || !finiteIn(position[1], -90, 90)) return false;
      }
    }
  }
  return true;
}

function parseBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4 || !finiteIn(value[0], -180, 180) || !finiteIn(value[1], -90, 90) || !finiteIn(value[2], -180, 180) || !finiteIn(value[3], -90, 90)) return null;
  return value[0] < value[2] && value[1] < value[3] ? value as [number, number, number, number] : null;
}

function safeString(value: unknown, max: number) {
  return typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value ? value : undefined;
}

function finiteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= min && value <= max;
}

function isExactRecord(value: unknown, keys: string[], optional: string[] = []): value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value as object);
  if (actual.some((key) => !keys.includes(key))) return false;
  return keys.filter((key) => !optional.includes(key)).every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
