import type { Feature, MultiPolygon, Point, Polygon } from "geojson";

export type LatLng = {
  lat: number;
  lng: number;
};

export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type TransportMode = "driving-car" | "cycling-regular" | "foot-walking";

export type RoutingProvider = "ors" | "valhalla";

export type MobilityMode = "walk" | "bike" | "stroller" | "senior";

export type IsochroneMode = "unified" | "individual" | "overlap";

export type IsochronePreset = "compact" | "balanced" | "spacious";

export type LabelDensity = "none" | "low" | "medium" | "high";

export type LayoutMode = "map-first" | "split" | "table-first";

export type ScenarioId =
  | "relocation-household"
  | "dual-career"
  | "hospital-on-call"
  | "school-fit"
  | "workforce-access"
  | "asset-audit"
  | "laundromat-walkability"
  | "real-estate-dev"
  | "home-seeker"
  | "urban-planner";

export type ViewMode = "all" | "points" | "isochrones";

export type ThemeMode = "light" | "dark";

export type ApiStatus = "unknown" | "ready" | "degraded" | "error";

export type ApiCapabilities = {
  openRouteService: boolean;
  valhalla: boolean;
  valhallaRequiresSecret: boolean;
  openCage: boolean;
};

export type AsyncStatus = "idle" | "loading" | "success" | "failed";

export type SlopeSeverity = "easy" | "moderate" | "steep";

export type ExportFormat = "csv" | "geojson" | "png" | "memo";

export type PoiCategory =
  | "grocery"
  | "bookstore"
  | "laundry"
  | "coffee"
  | "restaurant"
  | "farmers-market"
  | "butcher"
  | "fresh-produce"
  | "hospital"
  | "school"
  | "library"
  | "pharmacy"
  | "park"
  | "transit"
  | "custom";

export type PoiSource = "google" | "osm" | "open-data";

export type PoiLayerSource = PoiSource | "mixed";

export type ServicePointCategory = "laundry" | "coffee" | "grocery" | "library" | "custom";

export type ServicePointSource =
  | "google_places"
  | "ny_libraries"
  | "nj_libraries"
  | "hybrid"
  | "openstreetmap"
  | "official_local";

export type ServicePointConfidence = "high" | "medium" | "low";

export type DrawerMode =
  | "closed"
  | "categoryPicker"
  | "resultsPeek"
  | "resultsHalf"
  | "poiDetail"
  | "evidenceFull";

export type HeatmapMode = "off" | "walk" | "drive";

export type ServicePoint = {
  id: string;
  name: string;
  category: ServicePointCategory;
  categoryLabel?: string;
  location: LatLng;
  source: ServicePointSource;
  address?: string;
  phone?: string;
  website?: string;
  hoursSummary?: string;
  sourceUrl?: string;
  sourceDatasetId?: string;
  sourceUpdatedAt?: string;
  jurisdiction?: "NY" | "NJ";
  confidence?: ServicePointConfidence;
  provenance?: {
    label?: string;
    datasetId?: string;
    sourceUrl?: string;
    sourceUpdatedAt?: string;
    note?: string;
  };
  rawData?: unknown;
};

export type ServicePointResponse = {
  category: ServicePointCategory;
  label?: string;
  query?: string;
  bbox?: [number, number, number, number];
  center?: LatLng;
  radiusMeters?: number;
  count: number;
  sources: ServicePointSource[];
  points: ServicePoint[];
  warnings?: string[];
};

export type MapPoint = LatLng & {
  id: string;
  name: string;
  address?: string;
  assetType?: string;
  capacity?: number;
  hoursOpen?: string;
  utilization?: string;
  staffing?: string;
  annualCost?: number;
  fundingSource?: string;
  color: string;
  createdAt: string;
};

export type PointOfInterest = LatLng & {
  id: string;
  name: string;
  address?: string;
  category: PoiCategory;
  source: PoiSource;
  sourceId: string;
  rating?: number;
  userRatingCount?: number;
  tags?: string[];
};

export type PoiLayer = {
  id: string;
  label: string;
  category: PoiCategory;
  query: string;
  source: PoiLayerSource;
  points: PointOfInterest[];
  visible: boolean;
  status: AsyncStatus;
  createdAt: string;
  message?: string;
  truncated?: boolean;
};

export type PlaceSearchResult = LatLng & {
  id: string;
  name: string;
  address?: string;
  source: "google";
  sourceId: string;
  viewport?: MapBounds;
  types?: string[];
};

export type MapJumpTarget = LatLng & {
  id: string;
  label: string;
  zoom?: number;
  bounds?: MapBounds;
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
  routingProvider: RoutingProvider;
  isochroneMode: IsochroneMode;
}>;

export type IsochroneCollection = IsochroneFeature[];

export type PointsFeatureCollection = {
  type: "FeatureCollection";
  features: Array<Feature<Point, {
    id: string;
      name: string;
      address?: string;
      assetType?: string;
      capacity?: number;
      hoursOpen?: string;
      utilization?: string;
      staffing?: string;
      annualCost?: number;
      fundingSource?: string;
      color: string;
      createdAt: string;
    }>>;
};

export type AppSettings = {
  timeMinutes: number;
  transportMode: TransportMode;
  routingProvider: RoutingProvider;
  valhallaAccessSecret: string;
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
  category: "relocation" | "civic" | "development";
  featured?: boolean;
  settings: Partial<AppSettings>;
};

export type SlopeCell = LatLng & {
  id: string;
  label: string;
  severity: SlopeSeverity;
  intensity: number;
  radiusMeters: number;
};
