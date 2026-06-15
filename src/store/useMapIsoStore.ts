import { create } from "zustand";
import {
  DEFAULT_CENTER,
  DEFAULT_TIME_BUCKETS,
  MOBILITY_MODES,
  POINT_COLORS,
} from "../constants";
import { fetchApiHealth, getInitialApiHealth, getUnavailableApiHealth } from "../lib/env";
import { debugLog } from "../lib/debug";
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
  MapPoint,
  MobilityMode,
  ScenarioId,
  ThemeMode,
  TransportMode,
  ViewMode,
} from "../types";
import { getScenarioPreset } from "../components/scenarios/scenarioPresets";

type MapIsoState = {
  points: MapPoint[];
  isochrones: IsochroneCollection;
  isGeneratingIsochrones: boolean;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  theme: ThemeMode;
  settings: AppSettings;
  status: AppStatus;
  addPoint: (location: LatLng, overrides?: Partial<Pick<MapPoint, "name" | "address">>) => string;
  addImportedPoints: (points: Array<LatLng & Partial<Pick<MapPoint, "name" | "address">>>) => void;
  updatePoint: (id: string, updates: Partial<Omit<MapPoint, "id" | "createdAt">>) => void;
  removePoint: (id: string) => void;
  clearPoints: () => void;
  setGeocodeStatus: (id: string, value: AsyncStatus) => void;
  setIsochrones: (features: IsochroneFeature[]) => void;
  clearIsochrones: () => void;
  setGeneratingIsochrones: (value: boolean) => void;
  setGenerationError: (message?: string) => void;
  setTimeMinutes: (minutes: number) => void;
  setTransportMode: (mode: TransportMode) => void;
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

function getInitialSidebarOpen() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.matchMedia("(min-width: 1024px)").matches;
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

function normalizeCoordinate(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function makePoint(
  location: LatLng,
  count: number,
  overrides?: Partial<Pick<MapPoint, "name" | "address">>,
): MapPoint {
  return {
    id: makePointId(),
    name: overrides?.name || makePointName(count),
    lat: normalizeCoordinate(location.lat, -90, 90),
    lng: normalizeCoordinate(location.lng, -180, 180),
    address: overrides?.address,
    color: POINT_COLORS[count % POINT_COLORS.length],
    createdAt: new Date().toISOString(),
  };
}

const apiHealth = getInitialApiHealth();

const defaultSettings: AppSettings = {
  timeMinutes: 15,
  transportMode: MOBILITY_MODES.walk.transportMode,
  mobilityMode: "walk",
  viewMode: "all",
  isochroneMode: "overlap",
  preset: "balanced",
  timeBuckets: DEFAULT_TIME_BUCKETS,
  ringSpacingMinutes: 5,
  opacity: 0.3,
  labelDensity: "medium",
  layoutMode: "map-first",
  selectedScenario: null,
  hasCompletedFirstRun: false,
};

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
  isochrones: [],
  isGeneratingIsochrones: false,
  sidebarOpen: getInitialSidebarOpen(),
  commandPaletteOpen: false,
  theme: getInitialTheme(),
  settings: defaultSettings,
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
        }),
      );

      return {
        points: [...state.points, ...points],
        isochrones: [],
      };
    });
    debugLog("Imported points added", { count: importedPoints.length });
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
    set({ isochrones: [] });
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

    set((state) => ({
      settings: {
        ...state.settings,
        ...scenario.settings,
      },
      isochrones: [],
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

    set((state) => ({
      status: {
        ...state.status,
        apiStatus: nextApiHealth.status,
        apiCapabilities: nextApiHealth.capabilities,
        apiMessage: nextApiHealth.message,
      },
    }));
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
