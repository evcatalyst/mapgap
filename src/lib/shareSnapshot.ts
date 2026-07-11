import type {
  AppSettings,
  IsochroneMode,
  IsochronePreset,
  LabelDensity,
  LatLng,
  LayoutMode,
  MapPoint,
  MobilityMode,
  RoutingProvider,
  ScenarioId,
  TransportMode,
  ViewMode,
} from "../types";

const SHARE_HASH_PREFIX = "#mg=";
const SHARE_VERSION = 1;

export type MapGapSharePoint = LatLng & {
  name?: string;
  address?: string;
  assetType?: string;
  capacity?: number;
  hoursOpen?: string;
  utilization?: string;
  staffing?: string;
  annualCost?: number;
  fundingSource?: string;
};

export type MapGapShareSettings = Pick<
  AppSettings,
  | "timeMinutes"
  | "transportMode"
  | "routingProvider"
  | "mobilityMode"
  | "viewMode"
  | "isochroneMode"
  | "preset"
  | "timeBuckets"
  | "ringSpacingMinutes"
  | "opacity"
  | "labelDensity"
  | "layoutMode"
>;

export type MapGapShareSnapshot = {
  v: typeof SHARE_VERSION;
  scenario: ScenarioId;
  settings: Partial<MapGapShareSettings>;
  points: MapGapSharePoint[];
};

const SCENARIOS: ScenarioId[] = [
  "relocation-household",
  "dual-career",
  "hospital-on-call",
  "school-fit",
  "workforce-access",
  "asset-audit",
  "laundromat-walkability",
  "real-estate-dev",
  "home-seeker",
  "urban-planner",
];

const TRANSPORT_MODES: TransportMode[] = ["driving-car", "cycling-regular", "foot-walking"];
const ROUTING_PROVIDERS: RoutingProvider[] = ["ors", "valhalla"];
const MOBILITY_MODES: MobilityMode[] = ["walk", "bike", "stroller", "senior"];
const VIEW_MODES: ViewMode[] = ["all", "points", "isochrones"];
const ISOCHRONE_MODES: IsochroneMode[] = ["unified", "individual", "overlap"];
const PRESETS: IsochronePreset[] = ["compact", "balanced", "spacious"];
const LABEL_DENSITIES: LabelDensity[] = ["none", "low", "medium", "high"];
const LAYOUT_MODES: LayoutMode[] = ["map-first", "split", "table-first"];

export function createShareSnapshot({
  scenario,
  settings,
  points,
}: {
  scenario: ScenarioId;
  settings: AppSettings;
  points: MapPoint[];
}): MapGapShareSnapshot {
  return {
    v: SHARE_VERSION,
    scenario,
    settings: {
      timeMinutes: settings.timeMinutes,
      transportMode: settings.transportMode,
      routingProvider: settings.routingProvider,
      mobilityMode: settings.mobilityMode,
      viewMode: settings.viewMode,
      isochroneMode: settings.isochroneMode,
      preset: settings.preset,
      timeBuckets: settings.timeBuckets,
      ringSpacingMinutes: settings.ringSpacingMinutes,
      opacity: settings.opacity,
      labelDensity: settings.labelDensity,
      layoutMode: settings.layoutMode,
    },
    points: points.map((point) => ({
      lat: roundCoordinate(point.lat),
      lng: roundCoordinate(point.lng),
      name: point.name,
      address: point.address,
      assetType: point.assetType,
      capacity: point.capacity,
      hoursOpen: point.hoursOpen,
      utilization: point.utilization,
      staffing: point.staffing,
      annualCost: point.annualCost,
      fundingSource: point.fundingSource,
    })),
  };
}

export function buildShareUrl(snapshot: MapGapShareSnapshot, href = window.location.href) {
  const url = new URL(href);

  url.hash = `${SHARE_HASH_PREFIX.slice(1)}${encodeSnapshot(snapshot)}`;
  return url.toString();
}

export function readShareSnapshotFromLocation(location = window.location) {
  const hash = location.hash;

  if (!hash.startsWith(SHARE_HASH_PREFIX)) {
    return undefined;
  }

  return decodeSnapshot(hash.slice(SHARE_HASH_PREFIX.length));
}

export function encodeSnapshot(snapshot: MapGapShareSnapshot) {
  const json = JSON.stringify(snapshot);
  const binary = Array.from(new TextEncoder().encode(json), (byte) =>
    String.fromCharCode(byte),
  ).join("");

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeSnapshot(encoded: string) {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

    return normalizeSnapshot(parsed);
  } catch {
    return undefined;
  }
}

function normalizeSnapshot(value: unknown): MapGapShareSnapshot | undefined {
  if (!isRecord(value) || value.v !== SHARE_VERSION || !isScenario(value.scenario)) {
    return undefined;
  }

  const points = Array.isArray(value.points) ? value.points.flatMap(normalizePoint) : [];
  const settings = isRecord(value.settings) ? normalizeSettings(value.settings) : {};

  return {
    v: SHARE_VERSION,
    scenario: value.scenario,
    settings,
    points,
  };
}

function normalizePoint(value: unknown): MapGapSharePoint[] {
  if (!isRecord(value)) {
    return [];
  }

  const lat = Number(value.lat);
  const lng = Number(value.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return [];
  }

  return [
    {
      lat: clamp(lat, -90, 90),
      lng: clamp(lng, -180, 180),
      name: stringValue(value.name),
      address: stringValue(value.address),
      assetType: stringValue(value.assetType),
      capacity: numberValue(value.capacity),
      hoursOpen: stringValue(value.hoursOpen),
      utilization: stringValue(value.utilization),
      staffing: stringValue(value.staffing),
      annualCost: numberValue(value.annualCost),
      fundingSource: stringValue(value.fundingSource),
    },
  ];
}

function normalizeSettings(value: Record<string, unknown>): Partial<MapGapShareSettings> {
  return omitUndefined({
    timeMinutes: positiveNumber(value.timeMinutes, 5, 60),
    transportMode: enumValue(value.transportMode, TRANSPORT_MODES),
    routingProvider: enumValue(value.routingProvider, ROUTING_PROVIDERS),
    mobilityMode: enumValue(value.mobilityMode, MOBILITY_MODES),
    viewMode: enumValue(value.viewMode, VIEW_MODES),
    isochroneMode: enumValue(value.isochroneMode, ISOCHRONE_MODES),
    preset: enumValue(value.preset, PRESETS),
    timeBuckets: numberArray(value.timeBuckets, 5, 60),
    ringSpacingMinutes: positiveNumber(value.ringSpacingMinutes, 5, 30),
    opacity: positiveNumber(value.opacity, 0.1, 0.8),
    labelDensity: enumValue(value.labelDensity, LABEL_DENSITIES),
    layoutMode: enumValue(value.layoutMode, LAYOUT_MODES),
  });
}

function isScenario(value: unknown): value is ScenarioId {
  return typeof value === "string" && SCENARIOS.includes(value as ScenarioId);
}

function enumValue<T extends string>(value: unknown, allowed: T[]) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}

function numberArray(value: unknown, min: number, max: number) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const numbers = value
    .map((item) => positiveNumber(item, min, max))
    .filter((item): item is number => item !== undefined);

  return numbers.length > 0 ? Array.from(new Set(numbers)).sort((a, b) => a - b) : undefined;
}

function positiveNumber(value: unknown, min: number, max: number) {
  const number = Number(value);

  return Number.isFinite(number) ? clamp(number, min, max) : undefined;
}

function numberValue(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 180) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
