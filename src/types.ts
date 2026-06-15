import type { Feature, MultiPolygon, Point, Polygon } from "geojson";

export type LatLng = {
  lat: number;
  lng: number;
};

export type TransportMode = "driving-car" | "cycling-regular" | "foot-walking";

export type MobilityMode = "walk" | "bike" | "stroller" | "senior";

export type IsochroneMode = "unified" | "individual" | "overlap";

export type IsochronePreset = "compact" | "balanced" | "spacious";

export type LabelDensity = "none" | "low" | "medium" | "high";

export type LayoutMode = "map-first" | "split" | "table-first";

export type ScenarioId = "real-estate-dev" | "home-seeker" | "urban-planner";

export type ViewMode = "all" | "points" | "isochrones";

export type ThemeMode = "light" | "dark";

export type ApiStatus = "unknown" | "ready" | "degraded" | "error";

export type ApiCapabilities = {
  openRouteService: boolean;
  openCage: boolean;
};

export type AsyncStatus = "idle" | "loading" | "success" | "failed";

export type SlopeSeverity = "easy" | "moderate" | "steep";

export type ExportFormat = "csv" | "geojson" | "png";

export type MapPoint = LatLng & {
  id: string;
  name: string;
  address?: string;
  color: string;
  createdAt: string;
};

export type IsochroneFeature = Feature<Polygon | MultiPolygon, {
  id: string;
  pointId: string;
  pointName: string;
  color: string;
  timeMinutes: number;
  bucketMinutes: number;
  adjustedMinutes: number;
  effortScore: number;
  mobilityMode: MobilityMode;
  transportMode: TransportMode;
  isochroneMode: IsochroneMode;
}>;

export type IsochroneCollection = IsochroneFeature[];

export type PointsFeatureCollection = {
  type: "FeatureCollection";
  features: Array<Feature<Point, {
    id: string;
    name: string;
    address?: string;
    color: string;
    createdAt: string;
  }>>;
};

export type AppSettings = {
  timeMinutes: number;
  transportMode: TransportMode;
  mobilityMode: MobilityMode;
  viewMode: ViewMode;
  isochroneMode: IsochroneMode;
  preset: IsochronePreset;
  timeBuckets: number[];
  ringSpacingMinutes: number;
  opacity: number;
  labelDensity: LabelDensity;
  layoutMode: LayoutMode;
  selectedScenario: ScenarioId | null;
  hasCompletedFirstRun: boolean;
};

export type AppStatus = {
  apiStatus: ApiStatus;
  apiCapabilities: ApiCapabilities;
  apiMessage?: string;
  lastGeneratedAt?: string;
  lastExportedAt?: string;
  geocodeStatusByPointId: Record<string, AsyncStatus>;
  generationError?: string;
  exportStatus: AsyncStatus;
};

export type MobilityModeConfig = {
  id: MobilityMode;
  label: string;
  shortLabel: string;
  description: string;
  transportMode: TransportMode;
  color: string;
  softColor: string;
  rangeMultiplier: number;
  slopeSensitivity: number;
};

export type ScenarioPreset = {
  id: ScenarioId;
  title: string;
  subtitle: string;
  description: string;
  settings: Partial<AppSettings>;
};

export type SlopeCell = LatLng & {
  id: string;
  label: string;
  severity: SlopeSeverity;
  intensity: number;
  radiusMeters: number;
};
