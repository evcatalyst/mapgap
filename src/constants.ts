import type {
  IsochroneMode,
  IsochronePreset,
  LabelDensity,
  MobilityMode,
  MobilityModeConfig,
  RoutingProvider,
  TransportMode,
} from "./types";

export const DEFAULT_CENTER = {
  lat: 42.7798,
  lng: -73.8457,
};

export const DEFAULT_ZOOM = 13;

export const TIME_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60];

export const DEFAULT_TIME_BUCKETS = [5, 10, 15, 20, 25, 30];

export const ISOCHRONE_MODE_LABELS: Record<IsochroneMode, string> = {
  unified: "Unified",
  individual: "Individual",
  overlap: "Overlap",
};

export const ISOCHRONE_PRESET_LABELS: Record<IsochronePreset, string> = {
  compact: "Compact",
  balanced: "Balanced",
  spacious: "Spacious",
};

export const LABEL_DENSITY_LABELS: Record<LabelDensity, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  "driving-car": "Drive",
  "cycling-regular": "Bike",
  "foot-walking": "Walk",
};

export const TRANSPORT_DESCRIPTIONS: Record<TransportMode, string> = {
  "driving-car": "Fastest road-access travel areas",
  "cycling-regular": "Regular cycling travel areas",
  "foot-walking": "Pedestrian travel areas",
};

export const ROUTING_PROVIDER_LABELS: Record<RoutingProvider, string> = {
  ors: "ORS",
  valhalla: "Valhalla beta",
};

export const ROUTING_PROVIDER_DESCRIPTIONS: Record<RoutingProvider, string> = {
  ors: "OpenRouteService is the production-safe default provider.",
  valhalla: "Valhalla beta uses local hill-aware costing when the local service is available.",
};

export const ROUTING_PROVIDER_ORDER: RoutingProvider[] = ["ors", "valhalla"];

export const MOBILITY_MODES: Record<MobilityMode, MobilityModeConfig> = {
  walk: {
    id: "walk",
    label: "Walk",
    shortLabel: "Walk",
    description: "Everyday walking with hill-aware effort.",
    transportMode: "foot-walking",
    color: "#10b981",
    softColor: "rgba(16, 185, 129, 0.16)",
    rangeMultiplier: 0.92,
    slopeSensitivity: 0.52,
  },
  bike: {
    id: "bike",
    label: "Bike",
    shortLabel: "Bike",
    description: "Cycling reach with steep climbs dialed back.",
    transportMode: "cycling-regular",
    color: "#0ea5e9",
    softColor: "rgba(14, 165, 233, 0.16)",
    rangeMultiplier: 1,
    slopeSensitivity: 0.36,
  },
  stroller: {
    id: "stroller",
    label: "Stroller",
    shortLabel: "Stroller",
    description: "Gentler access for wheels, curb cuts, and grades.",
    transportMode: "foot-walking",
    color: "#f59e0b",
    softColor: "rgba(245, 158, 11, 0.18)",
    rangeMultiplier: 0.76,
    slopeSensitivity: 0.72,
  },
  senior: {
    id: "senior",
    label: "Senior",
    shortLabel: "Senior",
    description: "Conservative reach for slower pace and hills.",
    transportMode: "foot-walking",
    color: "#ec4899",
    softColor: "rgba(236, 72, 153, 0.16)",
    rangeMultiplier: 0.68,
    slopeSensitivity: 0.86,
  },
};

export const MOBILITY_MODE_ORDER: MobilityMode[] = ["walk", "bike", "stroller", "senior"];

export const POINT_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#ec4899",
];
