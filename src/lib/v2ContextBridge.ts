import type {
  HeatmapMode,
  IsochroneFeature,
  MapBounds,
  ServicePoint,
  ServicePointCategory,
} from "../types";

export const V2_CONTEXT_SCHEMA = "mapgap.v2.context/v1" as const;
export const V2_READY_SCHEMA = "mapgap.v2.ready/v1" as const;
export const DEFAULT_V3_HOST_ORIGIN = "https://mapgap-v3-preview.netlify.app";
export const V2_CONTEXT_DEBOUNCE_MS = 180;
export const V2_CONTEXT_MAX_POINTS = 200;
export const V2_CONTEXT_MAX_ISOCHRONES = 80;
export const V2_CONTEXT_MAX_BYTES = 384 * 1024;

const MAX_ACTIVE_EXTENSIONS = 32;
const MAX_COORDINATES_PER_FEATURE = 12_000;
const SERVICE_POINT_CATEGORIES = ["laundry", "coffee", "grocery", "library", "custom"] as const;
const SERVICE_POINT_SOURCES = [
  "google_places",
  "ny_libraries",
  "nj_libraries",
  "hybrid",
  "openstreetmap",
  "official_local",
] as const;
const MOBILITY_MODES = ["walk", "bike", "stroller", "senior"] as const;
const TRANSPORT_MODES = ["driving-car", "cycling-regular", "foot-walking"] as const;
const ROUTING_PROVIDERS = ["ors", "valhalla"] as const;
const ISOCHRONE_MODES = ["unified", "individual", "overlap"] as const;

type SafeServicePoint = {
  id: string;
  name: string;
  category: ServicePointCategory;
  categoryLabel?: string;
  location: { lat: number; lng: number };
  source: ServicePoint["source"];
  address?: string;
  sourceDatasetId?: string;
  sourceUpdatedAt?: string;
  jurisdiction?: ServicePoint["jurisdiction"];
  confidence?: ServicePoint["confidence"];
};

type SafeIsochroneFeature = {
  type: "Feature";
  geometry: IsochroneFeature["geometry"];
  properties: Pick<
    IsochroneFeature["properties"],
    | "id"
    | "pointId"
    | "pointName"
    | "color"
    | "timeMinutes"
    | "bucketMinutes"
    | "adjustedMinutes"
    | "effortScore"
    | "mobilityMode"
    | "transportMode"
    | "routingProvider"
    | "isochroneMode"
  >;
};

export type V2ContextInput = {
  bounds: MapBounds;
  category: ServicePointCategory | null;
  query?: string;
  activeExtensions: string[];
  selectedPointId: string | null;
  servicePoints: ServicePoint[];
  isochrones: IsochroneFeature[];
  heatmapMode: HeatmapMode;
};

export type V2ContextMessage = {
  schema: typeof V2_CONTEXT_SCHEMA;
  revision: number;
  context: {
    bbox: [number, number, number, number];
    category: ServicePointCategory | null;
    query?: string;
    activeExtensions: string[];
    selectedPointId: string | null;
    servicePoints: SafeServicePoint[];
    isochrones: SafeIsochroneFeature[];
    heatmapMode: HeatmapMode;
  };
};

export type V2ReadyMessage = {
  schema: typeof V2_READY_SCHEMA;
  contextSchema: typeof V2_CONTEXT_SCHEMA;
};

type ParentMessageTarget = {
  postMessage: (message: V2ContextMessage | V2ReadyMessage, targetOrigin: string) => void;
};

export type V2BridgeHost = {
  parent: ParentMessageTarget | V2BridgeHost;
  setTimeout: (handler: () => void, timeout?: number) => number;
  clearTimeout: (handle?: number) => void;
};

export type V2ContextPublisher = {
  embedded: boolean;
  ready: () => void;
  publish: (input: V2ContextInput, priority?: "immediate" | "viewport") => void;
  destroy: () => void;
};

let contextRevision = 0;

function safeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function finiteNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : undefined;
}

function boundedNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

function isAllowedValue<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function sanitizePoint(point: ServicePoint): SafeServicePoint | undefined {
  const id = safeString(point.id, 160);
  const name = safeString(point.name, 240);
  const lat = boundedNumber(point.location?.lat, -90, 90);
  const lng = boundedNumber(point.location?.lng, -180, 180);

  if (
    !id ||
    !name ||
    lat === undefined ||
    lng === undefined ||
    !isAllowedValue(point.category, SERVICE_POINT_CATEGORIES) ||
    !isAllowedValue(point.source, SERVICE_POINT_SOURCES)
  ) {
    return undefined;
  }

  return {
    id,
    name,
    category: point.category,
    categoryLabel: safeString(point.categoryLabel, 120),
    location: { lat, lng },
    source: point.source,
    address: safeString(point.address, 320),
    sourceDatasetId: safeString(point.sourceDatasetId, 160),
    sourceUpdatedAt: safeString(point.sourceUpdatedAt, 80),
    jurisdiction: point.jurisdiction === "NY" || point.jurisdiction === "NJ"
      ? point.jurisdiction
      : undefined,
    confidence:
      point.confidence === "high" || point.confidence === "medium" || point.confidence === "low"
        ? point.confidence
        : undefined,
  };
}

type Position = [number, number];

function sanitizeRing(value: unknown, budget: { remaining: number }): Position[] | undefined {
  if (!Array.isArray(value) || budget.remaining < 4) {
    return undefined;
  }

  const positions: Position[] = [];

  for (const candidate of value) {
    if (budget.remaining <= 1 || !Array.isArray(candidate)) {
      break;
    }

    const lng = boundedNumber(candidate[0], -180, 180);
    const lat = boundedNumber(candidate[1], -90, 90);

    if (lng === undefined || lat === undefined) {
      continue;
    }

    positions.push([lng, lat]);
    budget.remaining -= 1;
  }

  if (positions.length < 3) {
    return undefined;
  }

  const first = positions[0];
  const last = positions[positions.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    positions.push([...first]);
    budget.remaining -= 1;
  }

  return positions.length >= 4 ? positions : undefined;
}

function sanitizePolygon(value: unknown, budget: { remaining: number }): Position[][] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const rings = value
    .map((ring) => sanitizeRing(ring, budget))
    .filter((ring): ring is Position[] => Boolean(ring));

  return rings.length > 0 ? rings : undefined;
}

function sanitizeGeometry(
  geometry: IsochroneFeature["geometry"],
): IsochroneFeature["geometry"] | undefined {
  const budget = { remaining: MAX_COORDINATES_PER_FEATURE };

  if (geometry.type === "Polygon") {
    const coordinates = sanitizePolygon(geometry.coordinates, budget);
    return coordinates ? { type: "Polygon", coordinates } : undefined;
  }

  const polygons = geometry.coordinates
    .map((polygon) => sanitizePolygon(polygon, budget))
    .filter((polygon): polygon is Position[][] => Boolean(polygon));

  return polygons.length > 0 ? { type: "MultiPolygon", coordinates: polygons } : undefined;
}

function sanitizeIsochrone(feature: IsochroneFeature): SafeIsochroneFeature | undefined {
  const geometry = sanitizeGeometry(feature.geometry);
  const id = safeString(feature.properties?.id, 160);
  const pointId = safeString(feature.properties?.pointId, 160);

  if (
    !geometry ||
    !id ||
    !pointId ||
    !isAllowedValue(feature.properties.mobilityMode, MOBILITY_MODES) ||
    !isAllowedValue(feature.properties.transportMode, TRANSPORT_MODES) ||
    !isAllowedValue(feature.properties.routingProvider, ROUTING_PROVIDERS) ||
    !isAllowedValue(feature.properties.isochroneMode, ISOCHRONE_MODES)
  ) {
    return undefined;
  }

  return {
    type: "Feature",
    geometry,
    properties: {
      id,
      pointId,
      pointName: safeString(feature.properties.pointName, 240) || "Service point",
      color: safeString(feature.properties.color, 32) || "#047857",
      timeMinutes: finiteNumber(feature.properties.timeMinutes, 0, 1_440) || 0,
      bucketMinutes: finiteNumber(feature.properties.bucketMinutes, 0, 1_440) || 0,
      adjustedMinutes: finiteNumber(feature.properties.adjustedMinutes, 0, 1_440) || 0,
      effortScore: finiteNumber(feature.properties.effortScore, 0, 1_000_000) || 0,
      mobilityMode: feature.properties.mobilityMode,
      transportMode: feature.properties.transportMode,
      routingProvider: feature.properties.routingProvider,
      isochroneMode: feature.properties.isochroneMode,
    },
  };
}

function sanitizeBounds(bounds: MapBounds): [number, number, number, number] {
  const west = finiteNumber(bounds.west, -180, 180) ?? -180;
  const south = finiteNumber(bounds.south, -90, 90) ?? -90;
  const east = finiteNumber(bounds.east, -180, 180) ?? 180;
  const north = finiteNumber(bounds.north, -90, 90) ?? 90;

  return [Math.min(west, east), Math.min(south, north), Math.max(west, east), Math.max(south, north)];
}

export function getV2ContextPayloadBytes(message: V2ContextMessage) {
  return new TextEncoder().encode(JSON.stringify(message)).byteLength;
}

export function makeV2ContextMessage(input: V2ContextInput, revision: number): V2ContextMessage {
  const message: V2ContextMessage = {
    schema: V2_CONTEXT_SCHEMA,
    revision,
    context: {
      bbox: sanitizeBounds(input.bounds),
      category: input.category,
      query: safeString(input.query, 240),
      activeExtensions: Array.from(
        new Set(input.activeExtensions.map((extension) => safeString(extension, 120)).filter(Boolean)),
      ).slice(0, MAX_ACTIVE_EXTENSIONS) as string[],
      selectedPointId: safeString(input.selectedPointId, 160) || null,
      servicePoints: input.servicePoints
        .slice(0, V2_CONTEXT_MAX_POINTS)
        .map(sanitizePoint)
        .filter((point): point is SafeServicePoint => Boolean(point)),
      isochrones: input.isochrones
        .slice(0, V2_CONTEXT_MAX_ISOCHRONES)
        .map(sanitizeIsochrone)
        .filter((feature): feature is SafeIsochroneFeature => Boolean(feature)),
      heatmapMode: input.heatmapMode,
    },
  };

  while (
    getV2ContextPayloadBytes(message) > V2_CONTEXT_MAX_BYTES &&
    message.context.isochrones.length > 0
  ) {
    message.context.isochrones.pop();
  }

  while (
    getV2ContextPayloadBytes(message) > V2_CONTEXT_MAX_BYTES &&
    message.context.servicePoints.length > 0
  ) {
    message.context.servicePoints.pop();
  }

  while (
    getV2ContextPayloadBytes(message) > V2_CONTEXT_MAX_BYTES &&
    message.context.activeExtensions.length > 0
  ) {
    message.context.activeExtensions.pop();
  }

  return message;
}

export function resolveV2BridgeTargetOrigin(configuredOrigin?: string): string | null {
  const candidate = configuredOrigin?.trim() || DEFAULT_V3_HOST_ORIGIN;

  try {
    const url = new URL(candidate);
    const localDevelopmentHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && localDevelopmentHost)) ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      candidate.includes("*")
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function createV2ContextPublisher(options: {
  host?: V2BridgeHost;
  targetOrigin: string | null;
  debounceMs?: number;
}): V2ContextPublisher {
  const host = options.host || (window as unknown as V2BridgeHost);
  const embedded = Boolean(options.targetOrigin) && host.parent !== host;
  let timeout: number | undefined;
  let destroyed = false;
  let latestInput: V2ContextInput | undefined;

  function clearPending() {
    if (timeout !== undefined) {
      host.clearTimeout(timeout);
      timeout = undefined;
    }
  }

  function send() {
    clearPending();

    if (!embedded || destroyed || !latestInput || !options.targetOrigin) {
      return;
    }

    contextRevision += 1;
    (host.parent as ParentMessageTarget).postMessage(
      makeV2ContextMessage(latestInput, contextRevision),
      options.targetOrigin,
    );
  }

  return {
    embedded,
    ready() {
      if (!embedded || destroyed || !options.targetOrigin) {
        return;
      }

      (host.parent as ParentMessageTarget).postMessage(
        { schema: V2_READY_SCHEMA, contextSchema: V2_CONTEXT_SCHEMA },
        options.targetOrigin,
      );
    },
    publish(input, priority = "immediate") {
      latestInput = input;

      if (!embedded || destroyed) {
        return;
      }

      if (priority === "immediate") {
        send();
        return;
      }

      clearPending();
      timeout = host.setTimeout(send, options.debounceMs ?? V2_CONTEXT_DEBOUNCE_MS);
    },
    destroy() {
      destroyed = true;
      latestInput = undefined;
      clearPending();
    },
  };
}
