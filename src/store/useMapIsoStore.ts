import { create } from "zustand";
import {
  DEFAULT_CENTER,
  DEFAULT_TIME_BUCKETS,
  MOBILITY_MODES,
  POINT_COLORS,
} from "../constants";
import { fetchApiHealth, getInitialApiHealth, getUnavailableApiHealth } from "../lib/env";
import { debugLog } from "../lib/debug";
import type { MapGapShareSnapshot } from "../lib/shareSnapshot";
import { makeScenarioProfile } from "../domain/profileDefaults";
import type {
  AnchorLocation,
  CandidateHome,
  DecisionConstraint,
  HouseholdProfile,
  ScoreWeights,
} from "../domain/decisionTypes";
import type {
  AppSettings,
  AppStatus,
  AsyncStatus,
  ExportFormat,
  IsochroneCollection,
  IsochroneFeature,
  IsochroneMode,
  IsochronePreset,
  LabelDensity,
  LatLng,
  LayoutMode,
  MapJumpTarget,
  MapBounds,
  MapPoint,
  MobilityMode,
  PlaceSearchResult,
  PoiLayer,
  PoiCategory,
  PointOfInterest,
  PoiLayerSource,
  RoutingProvider,
  ScenarioId,
  ThemeMode,
  TransportMode,
  ViewMode,
} from "../types";
import { getScenarioPreset } from "../components/scenarios/scenarioPresets";

const VALHALLA_ACCESS_SECRET_STORAGE_KEY = "mapgap-valhalla-access-secret";

type MapPointInputMetadata = Pick<
  MapPoint,
  | "name"
  | "address"
  | "assetType"
  | "capacity"
  | "hoursOpen"
  | "utilization"
  | "staffing"
  | "annualCost"
  | "fundingSource"
>;

type MapIsoState = {
  points: MapPoint[];
  poiLayers: PoiLayer[];
  candidateHomes: CandidateHome[];
  isochrones: IsochroneCollection;
  mapBounds?: MapBounds;
  mapJumpTarget?: MapJumpTarget;
  selectedPlace?: PlaceSearchResult;
  isGeneratingIsochrones: boolean;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  theme: ThemeMode;
  settings: AppSettings;
  decisionProfile: HouseholdProfile;
  status: AppStatus;
  addPoint: (location: LatLng, overrides?: Partial<MapPointInputMetadata>) => string;
  addImportedPoints: (points: Array<LatLng & Partial<MapPointInputMetadata>>) => void;
  replacePoints: (points: Array<LatLng & Partial<MapPointInputMetadata>>) => MapPoint[];
  updatePoint: (id: string, updates: Partial<Omit<MapPoint, "id" | "createdAt">>) => void;
  removePoint: (id: string) => void;
  clearPoints: () => void;
  addPoiLayer: (input: {
    category: PoiCategory;
    query: string;
    label: string;
    source: PoiLayerSource;
    points: PointOfInterest[];
    message?: string;
    truncated?: boolean;
  }) => string;
  removePoiLayer: (id: string) => void;
  clearPoiLayers: () => void;
  setPoiLayerVisibility: (id: string, visible: boolean) => void;
  setPoiLayerStatus: (id: string, status: AsyncStatus, message?: string) => void;
  clearAll: () => void;
  setCandidateHomes: (candidates: CandidateHome[]) => void;
  clearCandidateHomes: () => void;
  setSelectedPlace: (place?: PlaceSearchResult) => void;
  setMapJumpTarget: (target?: MapJumpTarget) => void;
  setMapBounds: (bounds: MapBounds) => void;
  setGeocodeStatus: (id: string, value: AsyncStatus) => void;
  setIsochrones: (features: IsochroneFeature[]) => void;
  clearIsochrones: () => void;
  setGeneratingIsochrones: (value: boolean) => void;
  setGenerationError: (message?: string) => void;
  setTimeMinutes: (minutes: number) => void;
  setTransportMode: (mode: TransportMode) => void;
  setRoutingProvider: (provider: RoutingProvider) => void;
  setValhallaAccessSecret: (secret: string) => void;
  setMobilityMode: (mode: MobilityMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setIsochroneMode: (mode: IsochroneMode) => void;
  setPreset: (preset: IsochronePreset) => void;
  setTimeBuckets: (buckets: number[]) => void;
  setRingSpacingMinutes: (minutes: number) => void;
  setOpacity: (opacity: number) => void;
  setLabelDensity: (density: LabelDensity) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  applyScenario: (scenario: ScenarioId) => void;
  applyShareSnapshot: (snapshot: MapGapShareSnapshot) => void;
  updateDecisionProfileAnchor: (id: string, updates: Partial<AnchorLocation>) => void;
  replaceDecisionProfileConstraint: (index: number, constraint: DecisionConstraint) => void;
  updateDecisionProfileWeights: (updates: Partial<ScoreWeights>) => void;
  setLastExported: (format?: ExportFormat) => void;
  setExportStatus: (status: AsyncStatus) => void;
  refreshApiStatus: () => Promise<void>;
  toggleSidebar: () => void;
  setSidebarOpen: (value: boolean) => void;
  setCommandPaletteOpen: (value: boolean) => void;
  toggleTheme: () => void;
};

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = window.localStorage.getItem("mapiso-theme");

  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return "light";
}

function getInitialValhallaAccessSecret() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(VALHALLA_ACCESS_SECRET_STORAGE_KEY) || "";
}

function getInitialSidebarOpen() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.matchMedia("(min-width: 1280px)").matches;
}

function makePointName(count: number) {
  return `Point ${count + 1}`;
}

function makePointId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeLayerId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCoordinate(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function makePoint(
  location: LatLng,
  count: number,
  overrides?: Partial<MapPointInputMetadata>,
): MapPoint {
  return {
    id: makePointId(),
    name: overrides?.name || makePointName(count),
    lat: normalizeCoordinate(location.lat, -90, 90),
    lng: normalizeCoordinate(location.lng, -180, 180),
    address: overrides?.address,
    assetType: overrides?.assetType,
    capacity: overrides?.capacity,
    hoursOpen: overrides?.hoursOpen,
    utilization: overrides?.utilization,
    staffing: overrides?.staffing,
    annualCost: overrides?.annualCost,
    fundingSource: overrides?.fundingSource,
    color: POINT_COLORS[count % POINT_COLORS.length],
    createdAt: new Date().toISOString(),
  };
}

const apiHealth = getInitialApiHealth();

const defaultSettings: AppSettings = {
  timeMinutes: 15,
  transportMode: MOBILITY_MODES.walk.transportMode,
  routingProvider: "ors",
  valhallaAccessSecret: getInitialValhallaAccessSecret(),
  mobilityMode: "walk",
  viewMode: "all",
  isochroneMode: "overlap",
  preset: "balanced",
  timeBuckets: DEFAULT_TIME_BUCKETS,
  ringSpacingMinutes: 5,
  opacity: 0.3,
  labelDensity: "medium",
  layoutMode: "map-first",
  selectedScenario: "relocation-household",
  hasCompletedFirstRun: false,
};

function getReadyRoutingProvider(
  provider: RoutingProvider,
  capabilities: AppStatus["apiCapabilities"],
) {
  if (provider === "ors" && !capabilities.openRouteService && capabilities.valhalla) {
    return "valhalla";
  }

  if (provider === "valhalla" && !capabilities.valhalla && capabilities.openRouteService) {
    return "ors";
  }

  return provider;
}

export const useMapIsoStore = create<MapIsoState>((set, get) => ({
  points: [
    {
      id: makePointId(),
      name: "Niskayuna Center",
      lat: DEFAULT_CENTER.lat,
      lng: DEFAULT_CENTER.lng,
      address: "Niskayuna, NY",
      color: POINT_COLORS[0],
      createdAt: new Date().toISOString(),
    },
  ],
  poiLayers: [],
  candidateHomes: [],
  isochrones: [],
  mapBounds: undefined,
  mapJumpTarget: undefined,
  selectedPlace: undefined,
  isGeneratingIsochrones: false,
  sidebarOpen: getInitialSidebarOpen(),
  commandPaletteOpen: false,
  theme: getInitialTheme(),
  settings: defaultSettings,
  decisionProfile: makeScenarioProfile("relocation-household"),
  status: {
    apiStatus: apiHealth.status,
    apiCapabilities: apiHealth.capabilities,
    apiMessage: apiHealth.message,
    geocodeStatusByPointId: {},
    exportStatus: "idle",
  },
  addPoint: (location, overrides) => {
    const point = makePoint(location, get().points.length, overrides);

    set((state) => ({
      points: [...state.points, point],
      isochrones: [],
    }));
    debugLog("Point added", point);
    return point.id;
  },
  addImportedPoints: (importedPoints) => {
    set((state) => {
      const points = importedPoints.map((point, index) =>
        makePoint(point, state.points.length + index, {
          name: point.name,
          address: point.address,
          assetType: point.assetType,
          capacity: point.capacity,
          hoursOpen: point.hoursOpen,
          utilization: point.utilization,
          staffing: point.staffing,
          annualCost: point.annualCost,
          fundingSource: point.fundingSource,
        }),
      );

      return {
        points: [...state.points, ...points],
        isochrones: [],
      };
    });
    debugLog("Imported points added", { count: importedPoints.length });
  },
  replacePoints: (replacementPoints) => {
    const points = replacementPoints.map((point, index) =>
      makePoint(point, index, {
        name: point.name,
        address: point.address,
        assetType: point.assetType,
        capacity: point.capacity,
        hoursOpen: point.hoursOpen,
        utilization: point.utilization,
        staffing: point.staffing,
        annualCost: point.annualCost,
        fundingSource: point.fundingSource,
      }),
    );

    set((state) => ({
      points,
      isochrones: [],
      status: {
        ...state.status,
        geocodeStatusByPointId: {},
        generationError: undefined,
      },
    }));
    debugLog("Points replaced", { count: points.length });
    return points;
  },
  updatePoint: (id, updates) => {
    set((state) => {
      const geometryChanged = updates.lat !== undefined || updates.lng !== undefined;
      const nextPoints = state.points.map((point) => {
        if (point.id !== id) {
          return point;
        }

        return {
          ...point,
          ...updates,
          lat:
            updates.lat === undefined
              ? point.lat
              : normalizeCoordinate(updates.lat, -90, 90),
          lng:
            updates.lng === undefined
              ? point.lng
              : normalizeCoordinate(updates.lng, -180, 180),
        };
      });

      return {
        points: nextPoints,
        isochrones: geometryChanged
          ? state.isochrones.filter((feature) => feature.properties.pointId !== id)
          : state.isochrones,
      };
    });
    debugLog("Point updated", { id, updates });
  },
  removePoint: (id) => {
    set((state) => {
      const { [id]: _removedGeocode, ...geocodeStatusByPointId } =
        state.status.geocodeStatusByPointId;

      return {
        points: state.points.filter((point) => point.id !== id),
        isochrones: state.isochrones.filter((feature) => feature.properties.pointId !== id),
        status: {
          ...state.status,
          geocodeStatusByPointId,
        },
      };
    });
    debugLog("Point removed", { id });
  },
  clearPoints: () => {
    set((state) => ({
      points: [],
      isochrones: [],
      status: {
        ...state.status,
        geocodeStatusByPointId: {},
      },
    }));
    debugLog("All points cleared");
  },
  addPoiLayer: ({ category, query, label, source, points, message, truncated }) => {
    const id = makeLayerId();
    const layer: PoiLayer = {
      id,
      category,
      query,
      label,
      source,
      points,
      visible: true,
      status: "success",
      createdAt: new Date().toISOString(),
      message,
      truncated,
    };

    set((state) => ({
      poiLayers: [...state.poiLayers, layer],
      status: {
        ...state.status,
        generationError: undefined,
      },
    }));
    debugLog("POI layer added", { id, category, count: points.length });
    return id;
  },
  removePoiLayer: (id) => {
    set((state) => ({
      poiLayers: state.poiLayers.filter((layer) => layer.id !== id),
    }));
    debugLog("POI layer removed", { id });
  },
  clearPoiLayers: () => {
    set({ poiLayers: [] });
    debugLog("POI layers cleared");
  },
  setPoiLayerVisibility: (id, visible) => {
    set((state) => ({
      poiLayers: state.poiLayers.map((layer) =>
        layer.id === id ? { ...layer, visible } : layer,
      ),
    }));
  },
  setPoiLayerStatus: (id, status, message) => {
    set((state) => ({
      poiLayers: state.poiLayers.map((layer) =>
        layer.id === id ? { ...layer, status, message } : layer,
      ),
    }));
  },
  clearAll: () => {
    set((state) => ({
      points: [],
      poiLayers: [],
      candidateHomes: [],
      isochrones: [],
      selectedPlace: undefined,
      mapJumpTarget: undefined,
      status: {
        ...state.status,
        geocodeStatusByPointId: {},
        generationError: undefined,
      },
    }));
    debugLog("MapGap state cleared");
  },
  setCandidateHomes: (candidates) => {
    set({ candidateHomes: candidates });
    debugLog("Candidate homes updated", { count: candidates.length });
  },
  clearCandidateHomes: () => {
    set({ candidateHomes: [] });
    debugLog("Candidate homes cleared");
  },
  setSelectedPlace: (place) => {
    set({ selectedPlace: place });
  },
  setMapJumpTarget: (target) => {
    set({ mapJumpTarget: target });
  },
  setMapBounds: (bounds) => {
    set((state) => {
      const previous = state.mapBounds;

      if (
        previous &&
        Math.abs(previous.south - bounds.south) < 0.000001 &&
        Math.abs(previous.west - bounds.west) < 0.000001 &&
        Math.abs(previous.north - bounds.north) < 0.000001 &&
        Math.abs(previous.east - bounds.east) < 0.000001
      ) {
        return {};
      }

      return { mapBounds: bounds };
    });
  },
  setGeocodeStatus: (id, value) => {
    set((state) => ({
      status: {
        ...state.status,
        geocodeStatusByPointId: {
          ...state.status.geocodeStatusByPointId,
          [id]: value,
        },
      },
    }));
  },
  setIsochrones: (features) => {
    set((state) => ({
      isochrones: features,
      status: {
        ...state.status,
        lastGeneratedAt: new Date().toISOString(),
        generationError: undefined,
      },
    }));
    debugLog("Isochrones updated", { count: features.length });
  },
  clearIsochrones: () => {
    set({
      isochrones: [],
    });
    debugLog("Isochrones cleared");
  },
  setGeneratingIsochrones: (value) => set({ isGeneratingIsochrones: value }),
  setGenerationError: (message) => {
    set((state) => ({
      status: {
        ...state.status,
        generationError: message,
      },
    }));
  },
  setTimeMinutes: (minutes) => {
    set((state) => ({
      settings: {
        ...state.settings,
        timeMinutes: minutes,
      },
      isochrones: [],
    }));
    debugLog("Time changed", { minutes });
  },
  setTransportMode: (mode) => {
    set((state) => ({
      settings: {
        ...state.settings,
        transportMode: mode,
        mobilityMode: mode === "cycling-regular" ? "bike" : state.settings.mobilityMode,
      },
      isochrones: [],
    }));
    debugLog("Transport changed", { mode });
  },
  setRoutingProvider: (provider) => {
    set((state) => ({
      settings: {
        ...state.settings,
        routingProvider: provider,
      },
      isochrones: [],
    }));
    debugLog("Routing provider changed", { provider });
  },
  setValhallaAccessSecret: (secret) => {
    if (typeof window !== "undefined") {
      if (secret) {
        window.localStorage.setItem(VALHALLA_ACCESS_SECRET_STORAGE_KEY, secret);
      } else {
        window.localStorage.removeItem(VALHALLA_ACCESS_SECRET_STORAGE_KEY);
      }
    }

    set((state) => ({
      settings: {
        ...state.settings,
        valhallaAccessSecret: secret,
      },
    }));
  },
  setMobilityMode: (mode) => {
    set((state) => ({
      settings: {
        ...state.settings,
        mobilityMode: mode,
        transportMode: MOBILITY_MODES[mode].transportMode,
      },
      isochrones: [],
    }));
    debugLog("Mobility mode changed", { mode });
  },
  setViewMode: (mode) => {
    set((state) => ({
      settings: {
        ...state.settings,
        viewMode: mode,
      },
    }));
  },
  setIsochroneMode: (mode) => {
    set((state) => ({
      settings: {
        ...state.settings,
        isochroneMode: mode,
      },
    }));
  },
  setPreset: (preset) => {
    const presetSettings: Record<IsochronePreset, Partial<AppSettings>> = {
      compact: {
        preset,
        timeBuckets: [5, 10, 15],
        ringSpacingMinutes: 5,
        opacity: 0.26,
        labelDensity: "low",
      },
      balanced: {
        preset,
        timeBuckets: [5, 10, 15, 20, 25, 30],
        ringSpacingMinutes: 5,
        opacity: 0.32,
        labelDensity: "medium",
      },
      spacious: {
        preset,
        timeBuckets: [5, 10, 15, 20, 25, 30],
        ringSpacingMinutes: 5,
        opacity: 0.36,
        labelDensity: "high",
      },
    };

    set((state) => ({
      settings: {
        ...state.settings,
        ...presetSettings[preset],
      },
      isochrones: [],
    }));
  },
  setTimeBuckets: (buckets) => {
    set((state) => ({
      settings: {
        ...state.settings,
        timeBuckets: buckets,
      },
      isochrones: [],
    }));
  },
  setRingSpacingMinutes: (minutes) => {
    set((state) => ({
      settings: {
        ...state.settings,
        ringSpacingMinutes: minutes,
      },
      isochrones: [],
    }));
  },
  setOpacity: (opacity) => {
    set((state) => ({
      settings: {
        ...state.settings,
        opacity,
      },
    }));
  },
  setLabelDensity: (density) => {
    set((state) => ({
      settings: {
        ...state.settings,
        labelDensity: density,
      },
    }));
  },
  setLayoutMode: (mode) => {
    set((state) => ({
      settings: {
        ...state.settings,
        layoutMode: mode,
      },
    }));
  },
  applyScenario: (scenarioId) => {
    const scenario = getScenarioPreset(scenarioId);

    if (!scenario) {
      return;
    }

    set((state) => {
      const nextSettings = {
        ...state.settings,
        ...scenario.settings,
      };

      return {
        settings: {
          ...nextSettings,
          routingProvider: getReadyRoutingProvider(
            nextSettings.routingProvider,
            state.status.apiCapabilities,
          ),
        },
        decisionProfile: makeScenarioProfile(scenarioId),
        isochrones: [],
      };
    });
  },
  updateDecisionProfileAnchor: (id, updates) => {
    set((state) => ({
      decisionProfile: {
        ...state.decisionProfile,
        anchors: state.decisionProfile.anchors.map((anchor) =>
          anchor.id === id ? { ...anchor, ...updates, id: anchor.id } : anchor,
        ),
      },
      candidateHomes: [],
      isochrones: [],
    }));
  },
  replaceDecisionProfileConstraint: (index, constraint) => {
    set((state) => ({
      decisionProfile: {
        ...state.decisionProfile,
        constraints: state.decisionProfile.constraints.map((item, itemIndex) =>
          itemIndex === index ? constraint : item,
        ),
      },
      candidateHomes: [],
    }));
  },
  applyShareSnapshot: (snapshot) => {
    const scenario = getScenarioPreset(snapshot.scenario);

    if (!scenario) {
      return;
    }

    set((state) => {
      const nextSettings = {
        ...state.settings,
        ...scenario.settings,
        ...snapshot.settings,
        selectedScenario: snapshot.scenario,
        hasCompletedFirstRun: true,
      };
      const points = snapshot.points.map((point, index) =>
        makePoint(point, index, {
          name: point.name,
          address: point.address,
          assetType: point.assetType,
          capacity: point.capacity,
          hoursOpen: point.hoursOpen,
          utilization: point.utilization,
          staffing: point.staffing,
          annualCost: point.annualCost,
          fundingSource: point.fundingSource,
        }),
      );

      return {
        points,
        poiLayers: [],
        candidateHomes: [],
        isochrones: [],
        selectedPlace: undefined,
        mapJumpTarget:
          points.length > 0
            ? {
                id: "shared-project",
                label: "Shared MapGap project",
                lat: points[0].lat,
                lng: points[0].lng,
                zoom: points.length > 1 ? 11 : 13,
              }
            : undefined,
        settings: {
          ...nextSettings,
          routingProvider: getReadyRoutingProvider(
            nextSettings.routingProvider,
            state.status.apiCapabilities,
          ),
        },
        decisionProfile: makeScenarioProfile(snapshot.scenario),
        status: {
          ...state.status,
          geocodeStatusByPointId: {},
          generationError: undefined,
        },
      };
    });
    debugLog("Share snapshot applied", {
      scenario: snapshot.scenario,
      pointCount: snapshot.points.length,
    });
  },
  updateDecisionProfileWeights: (updates) => {
    set((state) => ({
      decisionProfile: {
        ...state.decisionProfile,
        weights: {
          ...state.decisionProfile.weights,
          ...updates,
        },
      },
    }));
  },
  setLastExported: () => {
    set((state) => ({
      status: {
        ...state.status,
        lastExportedAt: new Date().toISOString(),
        exportStatus: "success",
      },
    }));
  },
  setExportStatus: (exportStatus) => {
    set((state) => ({
      status: {
        ...state.status,
        exportStatus,
      },
    }));
  },
  refreshApiStatus: async () => {
    let nextApiHealth;

    try {
      nextApiHealth = await fetchApiHealth();
    } catch {
      nextApiHealth = getUnavailableApiHealth();
    }

    set((state) => {
      const capabilities = nextApiHealth.capabilities;

      return {
        settings: {
          ...state.settings,
          routingProvider: getReadyRoutingProvider(state.settings.routingProvider, capabilities),
        },
        status: {
          ...state.status,
          apiStatus: nextApiHealth.status,
          apiCapabilities: capabilities,
          apiMessage: nextApiHealth.message,
        },
      };
    });
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  setCommandPaletteOpen: (value) => set({ commandPaletteOpen: value }),
  toggleTheme: () => {
    const nextTheme = get().theme === "dark" ? "light" : "dark";

    if (typeof window !== "undefined") {
      window.localStorage.setItem("mapiso-theme", nextTheme);
    }

    set({ theme: nextTheme });
    debugLog("Theme changed", { theme: nextTheme });
  },
}));
