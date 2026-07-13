import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Car,
  ChevronDown,
  ChevronUp,
  Coffee,
  Database,
  Download,
  Library,
  List,
  Loader2,
  MapPin,
  Navigation,
  RotateCcw,
  Route,
  Search,
  Share2,
  Shirt,
  ShoppingBasket,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { DEFAULT_CENTER } from "../../constants";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { cn } from "../../lib/utils";
import {
  formatDistanceMiles,
  getBoundsCenter,
  getDistanceMiles,
  servicePointsToGeoJson,
  servicePointToMapPoint,
  SERVICE_POINT_CATEGORY_LABELS,
  SERVICE_POINT_SOURCE_LABELS,
} from "../../lib/servicePoints";
import {
  createV2ContextPublisher,
  resolveV2BridgeTargetOrigin,
  type V2ContextInput,
  type V2ContextPublisher,
} from "../../lib/v2ContextBridge";
import { fetchServicePoints } from "../../services/servicePointsClient";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type {
  AppSettings,
  AsyncStatus,
  DrawerMode,
  HeatmapMode,
  MapBounds,
  ServicePoint,
  ServicePointCategory,
  ServicePointExtension,
  ServicePointSource,
} from "../../types";
import { MapCanvas } from "../map/MapCanvas";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ServicePointMarkers } from "./ServicePointMarkers";

const CATEGORY_OPTIONS: Array<{
  id: ServicePointCategory;
  description: string;
  icon: typeof Shirt;
}> = [
  { id: "laundry", description: "Daily chore access", icon: Shirt },
  { id: "coffee", description: "Morning routines", icon: Coffee },
  { id: "grocery", description: "Food access", icon: ShoppingBasket },
  { id: "library", description: "Public capacity", icon: Library },
];

const FALLBACK_BOUNDS: MapBounds = {
  south: DEFAULT_CENTER.lat - 0.08,
  west: DEFAULT_CENTER.lng - 0.12,
  north: DEFAULT_CENTER.lat + 0.08,
  east: DEFAULT_CENTER.lng + 0.12,
};

const HEATMAP_POINT_LIMIT = 20;
const WALK_REACH_OPTIONS = [5, 10, 20] as const;
const DEFAULT_WALK_REACH_MINUTES = 10;
const BOOSTED_SERVICE_POINTS_KEY = "mapgap-v2-boosted-service-points";
const V3_BRIDGE_TARGET_ORIGIN = resolveV2BridgeTargetOrigin(
  import.meta.env.VITE_MAPGAP_V3_HOST_ORIGIN,
);

type WalkReachMinutes = (typeof WALK_REACH_OPTIONS)[number];

function getWalkTimeBuckets(minutes: WalkReachMinutes) {
  return [5, 10, 15, 20].filter((bucket) => bucket <= minutes);
}

function getStoredBoostedPointIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const value = JSON.parse(window.localStorage.getItem(BOOSTED_SERVICE_POINTS_KEY) || "[]");
    return new Set<string>(Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

type PointsState = {
  activeExtensions: string[];
  extensions: ServicePointExtension[];
  points: ServicePoint[];
  sources: ServicePointSource[];
  warnings: string[];
};

const EMPTY_POINTS_STATE: PointsState = {
  activeExtensions: [],
  extensions: [],
  points: [],
  sources: [],
  warnings: [],
};

const DRAWER_MODES: DrawerMode[] = [
  "closed",
  "categoryPicker",
  "resultsPeek",
  "resultsHalf",
  "poiDetail",
  "evidenceFull",
];

const SERVICE_POINT_CATEGORIES: ServicePointCategory[] = [
  "laundry",
  "coffee",
  "grocery",
  "library",
  "custom",
];

type LastSearch = {
  bounds: MapBounds;
  category: ServicePointCategory;
  extensions: string[];
  query?: string;
};

function isDrawerMode(value: unknown): value is DrawerMode {
  return typeof value === "string" && DRAWER_MODES.includes(value as DrawerMode);
}

function parseServicePointCategory(value: string | null): ServicePointCategory | undefined {
  return SERVICE_POINT_CATEGORIES.includes(value as ServicePointCategory)
    ? (value as ServicePointCategory)
    : undefined;
}

function formatBoundsParam(bounds: MapBounds) {
  return [bounds.west, bounds.south, bounds.east, bounds.north]
    .map((value) => value.toFixed(5))
    .join(",");
}

function parseBoundsParam(value: string | null): MapBounds | undefined {
  if (!value) {
    return undefined;
  }

  const [west, south, east, north] = value.split(",").map(Number);

  if ([west, south, east, north].some((part) => !Number.isFinite(part))) {
    return undefined;
  }

  return { south, west, north, east };
}

function boundsChangedEnough(current: MapBounds, previous?: MapBounds) {
  if (!previous) {
    return false;
  }

  const latSpan = Math.max(0.01, previous.north - previous.south);
  const lngSpan = Math.max(0.01, previous.east - previous.west);
  const currentCenter = getBoundsCenter(current);
  const previousCenter = getBoundsCenter(previous);

  if (!currentCenter || !previousCenter) {
    return false;
  }

  const latDelta = Math.abs(currentCenter.lat - previousCenter.lat);
  const lngDelta = Math.abs(currentCenter.lng - previousCenter.lng);
  const zoomDelta =
    Math.abs(current.north - current.south - latSpan) / latSpan +
    Math.abs(current.east - current.west - lngSpan) / lngSpan;

  return latDelta > latSpan * 0.18 || lngDelta > lngSpan * 0.18 || zoomDelta > 0.35;
}

export function V2PublicDemoShell() {
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [selectedCategory, setSelectedCategory] = useState<ServicePointCategory | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>();
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("off");
  const [walkReachMinutes, setWalkReachMinutes] = useState<WalkReachMinutes>(
    DEFAULT_WALK_REACH_MINUTES,
  );
  const [boostedPointIds, setBoostedPointIds] = useState(getStoredBoostedPointIds);
  const [pointsState, setPointsState] = useState<PointsState>(EMPTY_POINTS_STATE);
  const [requestStatus, setRequestStatus] = useState<AsyncStatus>("idle");
  const [requestError, setRequestError] = useState<string | undefined>();
  const [heatmapMessage, setHeatmapMessage] = useState<string | undefined>();
  const [selectedQuery, setSelectedQuery] = useState<string | undefined>();
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null);
  const drawerModeRef = useRef(drawerMode);
  const previousDrawerModeRef = useRef(drawerMode);
  const fabRef = useRef<HTMLButtonElement>(null);
  const restoredUrlSearchRef = useRef(false);
  const contextPublisherRef = useRef<V2ContextPublisher | null>(null);
  const latestContextRef = useRef<V2ContextInput | null>(null);

  const mapBounds = useMapIsoStore((state) => state.mapBounds);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const status = useMapIsoStore((state) => state.status);
  const settings = useMapIsoStore((state) => state.settings);
  const clearIsochrones = useMapIsoStore((state) => state.clearIsochrones);
  const refreshApiStatus = useMapIsoStore((state) => state.refreshApiStatus);
  const setMapJumpTarget = useMapIsoStore((state) => state.setMapJumpTarget);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();

  const activeBounds = mapBounds || FALLBACK_BOUNDS;
  const mapCenter = useMemo(() => getBoundsCenter(activeBounds), [activeBounds]);
  const selectedPoint = pointsState.points.find((point) => point.id === selectedPointId);
  const routingAvailable = status.apiCapabilities.openRouteService || status.apiCapabilities.valhalla;
  const selectedCategoryLabel = selectedCategory
    ? selectedLabel || SERVICE_POINT_CATEGORY_LABELS[selectedCategory]
    : undefined;
  const isSearchStale =
    requestStatus === "success" &&
    pointsState.points.length > 0 &&
    Boolean(selectedCategory) &&
    boundsChangedEnough(activeBounds, lastSearch?.bounds);

  latestContextRef.current = {
    bounds: activeBounds,
    category: selectedCategory,
    query: selectedQuery,
    activeExtensions: pointsState.activeExtensions,
    selectedPointId,
    servicePoints: pointsState.points,
    isochrones,
    heatmapMode,
  };

  useEffect(() => {
    const publisher = createV2ContextPublisher({ targetOrigin: V3_BRIDGE_TARGET_ORIGIN });
    contextPublisherRef.current = publisher;
    const announceReady = () => publisher.ready();
    if (document.readyState === "complete") {
      announceReady();
    } else {
      window.addEventListener("load", announceReady, { once: true });
    }

    return () => {
      window.removeEventListener("load", announceReady);
      publisher.destroy();
      contextPublisherRef.current = null;
    };
  }, []);

  useEffect(() => {
    const context = latestContextRef.current;

    if (context) {
      contextPublisherRef.current?.publish(context, "viewport");
    }
  }, [mapBounds]);

  useEffect(() => {
    const context = latestContextRef.current;

    if (context) {
      contextPublisherRef.current?.publish(context, "immediate");
    }
  }, [
    heatmapMode,
    isochrones,
    pointsState.activeExtensions,
    pointsState.points,
    selectedCategory,
    selectedPointId,
    selectedQuery,
  ]);

  useEffect(() => {
    drawerModeRef.current = drawerMode;

    if (previousDrawerModeRef.current !== "closed" && drawerMode === "closed") {
      window.requestAnimationFrame(() => fabRef.current?.focus());
    }

    previousDrawerModeRef.current = drawerMode;
  }, [drawerMode]);

  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      const nextMode = isDrawerMode(event.state?.mapgapV2Drawer)
        ? event.state.mapgapV2Drawer
        : "closed";

      setDrawerMode(nextMode);

      if (nextMode !== "poiDetail") {
        setSelectedPointId(null);
      }
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (restoredUrlSearchRef.current) {
      return;
    }

    const url = new URL(window.location.href);
    const category = parseServicePointCategory(url.searchParams.get("category"));

    if (!category) {
      return;
    }

    restoredUrlSearchRef.current = true;
    const query = url.searchParams.get("q") || undefined;
    const extensions = (url.searchParams.get("include") || "").split(",").filter(Boolean);
    const sharedBounds = parseBoundsParam(url.searchParams.get("bbox"));

    if (sharedBounds) {
      const center = getBoundsCenter(sharedBounds);

      if (center) {
        setMapJumpTarget({
          id: "v2-shared-view",
          label: "Shared view",
          lat: center.lat,
          lng: center.lng,
          bounds: sharedBounds,
        });
      }
    }

    void chooseCategory(category, query, sharedBounds || activeBounds, extensions);
  }, [activeBounds, setMapJumpTarget]);

  function setDrawerModeWithHistory(nextMode: DrawerMode, options?: { replace?: boolean }) {
    setDrawerMode(nextMode);

    const nextState = {
      ...(window.history.state || {}),
      mapgapV2Drawer: nextMode === "closed" ? undefined : nextMode,
    };

    if (options?.replace || nextMode === "closed") {
      window.history.replaceState(nextState, "", window.location.href);
      return;
    }

    if (window.history.state?.mapgapV2Drawer !== nextMode) {
      window.history.pushState(nextState, "", window.location.href);
    }
  }

  function syncSearchUrl(
    category: ServicePointCategory,
    query: string | undefined,
    bounds: MapBounds,
    extensions: string[],
  ) {
    const url = new URL(window.location.href);
    url.searchParams.set("category", category);
    url.searchParams.set("bbox", formatBoundsParam(bounds));

    if (category === "custom" && query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }

    if (extensions.length > 0) {
      url.searchParams.set("include", extensions.join(","));
    } else {
      url.searchParams.delete("include");
    }

    window.history.replaceState(
      {
        ...(window.history.state || {}),
        mapgapV2Drawer: drawerModeRef.current === "closed" ? "resultsPeek" : drawerModeRef.current,
      },
      "",
      url,
    );
  }

  function clearSearchUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("category");
    url.searchParams.delete("q");
    url.searchParams.delete("bbox");
    url.searchParams.delete("include");
    window.history.replaceState(
      {
        ...(window.history.state || {}),
        mapgapV2Drawer: undefined,
      },
      "",
      url,
    );
  }

  async function chooseCategory(
    category: ServicePointCategory,
    query?: string,
    boundsOverride?: MapBounds,
    extensionsOverride: string[] = [],
  ) {
    const boundsForSearch = boundsOverride || activeBounds;
    const cleanedQuery = query?.trim();
    const nextLabel =
      category === "custom"
        ? cleanedQuery || SERVICE_POINT_CATEGORY_LABELS.custom
        : SERVICE_POINT_CATEGORY_LABELS[category];

    setSelectedCategory(category);
    setSelectedLabel(nextLabel);
    setSelectedQuery(cleanedQuery);
    setSelectedPointId(null);
    setDrawerModeWithHistory("resultsPeek");
    setRequestStatus("loading");
    setRequestError(undefined);
    setHeatmapMode("off");
    setHeatmapMessage(undefined);
    setLastSearch({
      bounds: boundsForSearch,
      category,
      extensions: extensionsOverride,
      query: cleanedQuery,
    });
    syncSearchUrl(category, cleanedQuery, boundsForSearch, extensionsOverride);
    clearIsochrones();

    try {
      const response = await fetchServicePoints({
        category,
        bounds: boundsForSearch,
        extensions: extensionsOverride,
        query: cleanedQuery,
      });

      setSelectedLabel(response.label || nextLabel);
      setPointsState({
        activeExtensions: response.activeExtensions || extensionsOverride,
        extensions: response.extensions || [],
        points: response.points,
        sources: response.sources,
        warnings: response.warnings || [],
      });
      setRequestStatus("success");

      if (response.points.length === 0) {
        setRequestError(
          `No ${nextLabel.toLowerCase()} found in this view. Try zooming out or moving the map.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nearby search failed. Try again in a moment.";
      setPointsState(EMPTY_POINTS_STATE);
      setRequestStatus("failed");
      setRequestError(message);
      toast.error("Nearby search failed.");
    }
  }

  function selectPoint(point: ServicePoint, openDetail = true) {
    setSelectedPointId(point.id);
    setMapJumpTarget({
      id: point.id,
      label: point.name,
      lat: point.location.lat,
      lng: point.location.lng,
      zoom: 15,
    });

    if (openDetail) {
      setDrawerModeWithHistory("poiDetail");
    }
  }

  function selectNextPoint() {
    if (pointsState.points.length === 0) {
      return;
    }

    const selectedIndex = pointsState.points.findIndex((point) => point.id === selectedPointId);
    const nextIndex = selectedIndex < 0 ? 0 : (selectedIndex + 1) % pointsState.points.length;
    selectPoint(pointsState.points[nextIndex]);
  }

  function resetNearbySearch() {
    setDrawerModeWithHistory("closed", { replace: true });
    setSelectedCategory(null);
    setSelectedLabel(undefined);
    setSelectedQuery(undefined);
    setSelectedPointId(null);
    setHeatmapMode("off");
    setWalkReachMinutes(DEFAULT_WALK_REACH_MINUTES);
    setPointsState(EMPTY_POINTS_STATE);
    setLastSearch(null);
    setRequestStatus("idle");
    setRequestError(undefined);
    setHeatmapMessage(undefined);
    clearSearchUrl();
    clearIsochrones();
  }

  function refreshCurrentSearch() {
    if (!selectedCategory) {
      return;
    }

    void chooseCategory(
      selectedCategory,
      selectedQuery,
      activeBounds,
      pointsState.activeExtensions,
    );
  }

  function toggleResultExtension(extensionId: string) {
    if (!selectedCategory) {
      return;
    }

    const nextExtensions = pointsState.activeExtensions.includes(extensionId)
      ? pointsState.activeExtensions.filter((id) => id !== extensionId)
      : [...pointsState.activeExtensions, extensionId];

    void chooseCategory(
      selectedCategory,
      selectedQuery,
      lastSearch?.bounds || activeBounds,
      nextExtensions,
    );
  }

  async function shareCurrentView() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Share link copied.");
    } catch {
      toast.error("Copy failed. Use the browser address bar.");
    }
  }

  async function updateHeatmap(
    nextMode: HeatmapMode,
    walkMinutesOverride: WalkReachMinutes = walkReachMinutes,
  ) {
    setHeatmapMode(nextMode);
    setHeatmapMessage(undefined);

    if (nextMode === "off") {
      clearIsochrones();
      return;
    }

    if (pointsState.points.length === 0) {
      setHeatmapMessage("Choose a category with results before showing access heat.");
      return;
    }

    let latestStatus = useMapIsoStore.getState().status;

    if (!latestStatus.apiCapabilities.valhalla && !latestStatus.apiCapabilities.openRouteService) {
      await refreshApiStatus();
      latestStatus = useMapIsoStore.getState().status;
    }

    const provider = latestStatus.apiCapabilities.valhalla ? "valhalla" : "ors";
    const heatmapPoints = pointsState.points
      .slice(0, HEATMAP_POINT_LIMIT)
      .map((point, index) => servicePointToMapPoint(point, index));
    const heatmapSettings: AppSettings = {
      ...settings,
      routingProvider: provider,
      transportMode: nextMode === "drive" ? "driving-car" : "foot-walking",
      mobilityMode: "walk",
      isochroneMode: "individual",
      preset: "compact",
      timeMinutes: nextMode === "drive" ? 15 : walkMinutesOverride,
      timeBuckets:
        nextMode === "drive" ? [5, 10, 15] : getWalkTimeBuckets(walkMinutesOverride),
      ringSpacingMinutes: 5,
      opacity: 0.28,
      labelDensity: "low",
      viewMode: "all",
    };

    if (pointsState.points.length > HEATMAP_POINT_LIMIT) {
      setHeatmapMessage(
        `Showing access heat for the first ${HEATMAP_POINT_LIMIT} places to keep this demo responsive.`,
      );
    }

    await generateIsochrones({
      points: heatmapPoints,
      quiet: true,
      settings: heatmapSettings,
    });

    const latestError = useMapIsoStore.getState().status.generationError;

    if (latestError) {
      setHeatmapMessage("Access heatmap unavailable. POIs are still shown.");
    }
  }

  function updateWalkReach(nextMinutes: WalkReachMinutes) {
    setWalkReachMinutes(nextMinutes);

    if (heatmapMode === "walk") {
      void updateHeatmap("walk", nextMinutes);
    }
  }

  function togglePointBoost(pointId: string) {
    setBoostedPointIds((current) => {
      const next = new Set(current);

      if (next.has(pointId)) {
        next.delete(pointId);
      } else {
        next.add(pointId);
      }

      window.localStorage.setItem(BOOSTED_SERVICE_POINTS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function exportResults(scope: "selected" | "all") {
    const points = scope === "selected" && selectedPoint ? [selectedPoint] : pointsState.points;

    if (points.length === 0) {
      toast.error("No nearby places to export.");
      return;
    }

    const blob = new Blob([JSON.stringify(servicePointsToGeoJson(points), null, 2)], {
      type: "application/geo+json",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const exportSlug =
      (selectedCategoryLabel || selectedCategory || "nearby")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "nearby";
    link.download = `mapgap-${exportSlug}-${scope}.geojson`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  const fabVisible = drawerMode === "closed";
  const fabLabel =
    selectedCategory && pointsState.points.length > 0
      ? `${selectedCategoryLabel} nearby`
      : "Explore Nearby";

  return (
    <main className="mapgap-v2-shell relative h-dvh min-h-screen overflow-hidden bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <MapCanvas
        allowPointCreate={false}
        className="h-dvh min-h-screen"
        fitStoredPoints={false}
        heatmapBuckets={
          heatmapMode === "drive" ? [5, 10, 15] : getWalkTimeBuckets(walkReachMinutes)
        }
        publicMode
        showIsochroneLayers={heatmapMode !== "off"}
        showLegacyData={false}
        showLegends={heatmapMode !== "off"}
        showRegionLabel={false}
      >
        <ServicePointMarkers
          points={pointsState.points}
          selectedPointId={selectedPointId}
          onSelect={selectPoint}
        />
      </MapCanvas>

      <PublicTopBar routingAvailable={routingAvailable} />

      {fabVisible && (
        <button
          ref={fabRef}
          type="button"
          className="mapgap-v2-fab fixed right-4 z-[850] inline-flex min-h-14 max-w-[calc(100vw-2rem)] items-center gap-2 overflow-hidden rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-950/20 transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          onClick={() =>
            setDrawerModeWithHistory(
              selectedCategory && pointsState.points.length > 0 ? "resultsPeek" : "categoryPicker",
            )
          }
          aria-label={fabLabel}
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <span className="truncate sm:hidden">
            {selectedCategory && pointsState.points.length > 0
              ? selectedCategoryLabel || "Nearby"
              : "Explore"}
          </span>
          <span className="hidden truncate sm:inline">{fabLabel}</span>
        </button>
      )}

      {drawerMode !== "closed" && (
        <BottomDrawer
          activeExtensions={pointsState.activeExtensions}
          category={selectedCategory}
          boostedPointIds={boostedPointIds}
          categoryLabel={selectedCategoryLabel}
          drawerMode={drawerMode}
          heatmapMessage={heatmapMessage}
          heatmapMode={heatmapMode}
          isGeneratingIsochrones={isGeneratingIsochrones}
          mapCenter={mapCenter}
          onCategorySelect={chooseCategory}
          onClose={() => setDrawerModeWithHistory("closed", { replace: true })}
          onExport={exportResults}
          onHeatmapChange={updateHeatmap}
          onTogglePointBoost={togglePointBoost}
          onToggleResultExtension={toggleResultExtension}
          onWalkReachChange={updateWalkReach}
          onOpenCategories={() => setDrawerModeWithHistory("categoryPicker")}
          onReset={resetNearbySearch}
          onSelectPoint={selectPoint}
          onSetDrawerMode={setDrawerModeWithHistory}
          onSelectNextPoint={selectNextPoint}
          points={pointsState.points}
          requestError={requestError}
          requestStatus={requestStatus}
          isSearchStale={isSearchStale}
          selectedPoint={selectedPoint}
          sources={pointsState.sources}
          extensions={pointsState.extensions}
          warnings={pointsState.warnings}
          walkReachMinutes={walkReachMinutes}
          onRefreshSearch={refreshCurrentSearch}
          onShare={shareCurrentView}
        />
      )}
    </main>
  );
}

function PublicTopBar({ routingAvailable }: { routingAvailable: boolean }) {
  return (
    <div className="mapgap-v2-topbar pointer-events-none absolute left-[5.25rem] right-3 z-[1100] flex items-start justify-between gap-3 sm:left-4 sm:right-4">
      <div className="pointer-events-auto inline-flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-white/80 bg-white/95 px-3 py-2 shadow-lg shadow-neutral-950/10 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 pr-1">
          <div className="truncate text-sm font-semibold">MapGap</div>
          <div className="hidden text-xs text-neutral-500 dark:text-neutral-400 sm:block">
            Nearby is not always easy to reach
          </div>
        </div>
        <span
          className={cn(
            "ml-auto h-2.5 w-2.5 shrink-0 rounded-full sm:hidden",
            routingAvailable ? "bg-emerald-500" : "bg-amber-500",
          )}
          aria-label={routingAvailable ? "Heat ready" : "POIs only"}
          title={routingAvailable ? "Heat ready" : "POIs only"}
        />
      </div>
      <Badge
        variant={routingAvailable ? "success" : "warning"}
        className="pointer-events-auto hidden h-8 gap-1 rounded-full bg-white/95 shadow-lg shadow-neutral-950/10 backdrop-blur dark:bg-neutral-950/90 sm:inline-flex"
      >
        <Database className="h-3.5 w-3.5" aria-hidden="true" />
        {routingAvailable ? "Heat ready" : "POIs only"}
      </Badge>
    </div>
  );
}

type BottomDrawerProps = {
  activeExtensions: string[];
  boostedPointIds: Set<string>;
  category: ServicePointCategory | null;
  categoryLabel?: string;
  drawerMode: DrawerMode;
  heatmapMessage?: string;
  heatmapMode: HeatmapMode;
  isGeneratingIsochrones: boolean;
  isSearchStale: boolean;
  mapCenter?: { lat: number; lng: number };
  onCategorySelect: (category: ServicePointCategory, query?: string) => void;
  onClose: () => void;
  onExport: (scope: "selected" | "all") => void;
  onHeatmapChange: (mode: HeatmapMode) => void;
  onTogglePointBoost: (pointId: string) => void;
  onToggleResultExtension: (extensionId: string) => void;
  onWalkReachChange: (minutes: WalkReachMinutes) => void;
  onOpenCategories: () => void;
  onRefreshSearch: () => void;
  onReset: () => void;
  onSelectNextPoint: () => void;
  onSelectPoint: (point: ServicePoint) => void;
  onSetDrawerMode: (mode: DrawerMode) => void;
  onShare: () => void;
  points: ServicePoint[];
  requestError?: string;
  requestStatus: AsyncStatus;
  selectedPoint?: ServicePoint;
  extensions: ServicePointExtension[];
  sources: ServicePointSource[];
  warnings: string[];
  walkReachMinutes: WalkReachMinutes;
};

function BottomDrawer({
  activeExtensions,
  boostedPointIds,
  category,
  categoryLabel,
  drawerMode,
  heatmapMessage,
  heatmapMode,
  isGeneratingIsochrones,
  isSearchStale,
  mapCenter,
  onCategorySelect,
  onClose,
  onExport,
  onHeatmapChange,
  onTogglePointBoost,
  onToggleResultExtension,
  onWalkReachChange,
  onOpenCategories,
  onRefreshSearch,
  onReset,
  onSelectNextPoint,
  onSelectPoint,
  onSetDrawerMode,
  onShare,
  points,
  requestError,
  requestStatus,
  selectedPoint,
  extensions,
  sources,
  warnings,
  walkReachMinutes,
}: BottomDrawerProps) {
  const title =
    drawerMode === "categoryPicker"
      ? "Explore nearby"
      : selectedPoint && drawerMode === "poiDetail"
        ? selectedPoint.name
        : category
          ? `${categoryLabel || SERVICE_POINT_CATEGORY_LABELS[category]} nearby`
          : "Nearby places";
  const stageClass = getDrawerStageClass(drawerMode);
  const canExpand = drawerMode === "resultsPeek" || drawerMode === "resultsHalf";
  const nextStage = drawerMode === "resultsPeek" ? "resultsHalf" : "resultsPeek";
  const hasActiveSearch =
    Boolean(category) || requestStatus !== "idle" || points.length > 0 || Boolean(selectedPoint);

  return (
    <section
      className={cn(
        "mapgap-v2-drawer fixed inset-x-0 bottom-0 z-[900] mx-auto flex w-full max-w-3xl flex-col rounded-t-[28px] border border-neutral-200 bg-white shadow-2xl shadow-neutral-950/20 dark:border-neutral-800 dark:bg-neutral-950",
        stageClass,
      )}
      aria-label="Nearby access drawer"
    >
      <div className="flex justify-center">
        <button
          type="button"
          className="grid h-11 w-14 place-items-center bg-transparent"
          aria-label="Toggle drawer stage"
          onClick={() => {
            if (canExpand) {
              onSetDrawerMode(nextStage);
            }
          }}
        >
          <span className="h-1.5 w-11 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </button>
      </div>
      <header className="flex min-h-14 items-start justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight tracking-normal text-neutral-950 sm:text-lg dark:text-neutral-50">
            {title}
          </h1>
          <p
            className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400"
            role="status"
            aria-live="polite"
          >
            {drawerMode === "categoryPicker"
              ? "Choose a category or search your own."
              : getDrawerSubtitle(points.length, requestStatus, sources)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canExpand && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => onSetDrawerMode(nextStage)}
              aria-label={drawerMode === "resultsPeek" ? "Expand results" : "Collapse results"}
            >
              {drawerMode === "resultsPeek" ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
          {hasActiveSearch && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={onReset}
              aria-label="Reset nearby search"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={onClose}
            aria-label="Close nearby drawer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 sm:px-5">
        {drawerMode === "categoryPicker" && (
          <CategoryPicker onCategorySelect={onCategorySelect} />
        )}

        {(drawerMode === "resultsPeek" ||
          drawerMode === "resultsHalf" ||
          drawerMode === "evidenceFull") && (
          <ResultsContent
            activeExtensions={activeExtensions}
            boostedPointIds={boostedPointIds}
            category={category}
            categoryLabel={categoryLabel}
            heatmapMessage={heatmapMessage}
            heatmapMode={heatmapMode}
            isGeneratingIsochrones={isGeneratingIsochrones}
            mapCenter={mapCenter}
            onExport={onExport}
            onHeatmapChange={onHeatmapChange}
            onTogglePointBoost={onTogglePointBoost}
            onToggleResultExtension={onToggleResultExtension}
            onWalkReachChange={onWalkReachChange}
            onOpenCategories={onOpenCategories}
            onRefreshSearch={onRefreshSearch}
            onSelectPoint={onSelectPoint}
            onSetDrawerMode={onSetDrawerMode}
            onShare={onShare}
            points={points}
            requestError={requestError}
            requestStatus={requestStatus}
            isSearchStale={isSearchStale}
            showList={drawerMode !== "resultsPeek"}
            sources={sources}
            extensions={extensions}
            warnings={warnings}
            walkReachMinutes={walkReachMinutes}
          />
        )}

        {drawerMode === "poiDetail" && selectedPoint && (
          <PointDetail
            boosted={boostedPointIds.has(selectedPoint.id)}
            heatmapMode={heatmapMode}
            isGeneratingIsochrones={isGeneratingIsochrones}
            mapCenter={mapCenter}
            onExport={onExport}
            onHeatmapChange={onHeatmapChange}
            onTogglePointBoost={() => onTogglePointBoost(selectedPoint.id)}
            onWalkReachChange={onWalkReachChange}
            onSelectNextPoint={onSelectNextPoint}
            onSetDrawerMode={onSetDrawerMode}
            onShare={onShare}
            point={selectedPoint}
            walkReachMinutes={walkReachMinutes}
          />
        )}
      </div>
    </section>
  );
}

function CategoryPicker({
  onCategorySelect,
}: {
  onCategorySelect: (category: ServicePointCategory, query?: string) => void;
}) {
  const [customQuery, setCustomQuery] = useState("");
  const cleanedQuery = customQuery.trim();
  const customReady = cleanedQuery.length >= 2;

  function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customReady) {
      return;
    }

    onCategorySelect("custom", cleanedQuery);
  }

  return (
    <div className="space-y-3 pb-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CATEGORY_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              type="button"
              className="flex min-h-12 items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-emerald-950/40"
              onClick={() => onCategorySelect(option.id)}
              aria-label={`${SERVICE_POINT_CATEGORY_LABELS[option.id]}: ${option.description}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 truncate text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                {SERVICE_POINT_CATEGORY_LABELS[option.id]}
              </span>
            </button>
          );
        })}
      </div>

      <form
        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70"
        onSubmit={submitCustom}
      >
        <label
          htmlFor="v2-custom-category"
          className="mb-2 block px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
        >
          Custom category
        </label>
        <div className="flex gap-2">
          <input
            id="v2-custom-category"
            value={customQuery}
            onChange={(event) => setCustomQuery(event.target.value)}
            placeholder="Try pharmacies, parks, daycare..."
            className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-emerald-900"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!customReady}
            className="h-11 shrink-0 rounded-xl"
            aria-label="Search custom places"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </div>
      </form>
    </div>
  );
}

function ResultsContent({
  activeExtensions,
  boostedPointIds,
  category,
  categoryLabel,
  heatmapMessage,
  heatmapMode,
  isGeneratingIsochrones,
  isSearchStale,
  mapCenter,
  onExport,
  onHeatmapChange,
  onTogglePointBoost,
  onToggleResultExtension,
  onWalkReachChange,
  onOpenCategories,
  onRefreshSearch,
  onSelectPoint,
  onSetDrawerMode,
  onShare,
  points,
  requestError,
  requestStatus,
  showList,
  sources,
  extensions,
  warnings,
  walkReachMinutes,
}: {
  activeExtensions: string[];
  boostedPointIds: Set<string>;
  category: ServicePointCategory | null;
  categoryLabel?: string;
  heatmapMessage?: string;
  heatmapMode: HeatmapMode;
  isGeneratingIsochrones: boolean;
  isSearchStale: boolean;
  mapCenter?: { lat: number; lng: number };
  onExport: (scope: "selected" | "all") => void;
  onHeatmapChange: (mode: HeatmapMode) => void;
  onTogglePointBoost: (pointId: string) => void;
  onToggleResultExtension: (extensionId: string) => void;
  onWalkReachChange: (minutes: WalkReachMinutes) => void;
  onOpenCategories: () => void;
  onRefreshSearch: () => void;
  onSelectPoint: (point: ServicePoint) => void;
  onSetDrawerMode: (mode: DrawerMode) => void;
  onShare: () => void;
  points: ServicePoint[];
  requestError?: string;
  requestStatus: AsyncStatus;
  showList: boolean;
  sources: ServicePointSource[];
  extensions: ServicePointExtension[];
  warnings: string[];
  walkReachMinutes: WalkReachMinutes;
}) {
  const messages = [requestError, heatmapMessage, ...warnings].filter(
    (message): message is string => Boolean(message),
  );
  const visibleMessages = messages.slice(0, 2);
  const compactMessage = getCompactDrawerMessage(visibleMessages, messages.length);
  const orderedPoints = useMemo(
    () =>
      [...points].sort(
        (left, right) =>
          Number(boostedPointIds.has(right.id)) - Number(boostedPointIds.has(left.id)),
      ),
    [boostedPointIds, points],
  );
  const extendedCount = points.filter((point) => Boolean(point.match?.extensionId)).length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={requestStatus === "failed" ? "danger" : "outline"} className="gap-1">
            {requestStatus === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {requestStatus === "loading"
              ? `Finding ${(categoryLabel || (category ? SERVICE_POINT_CATEGORY_LABELS[category] : "places")).toLowerCase()}...`
              : `${points.length} ${points.length === 1 ? "place" : "places"}`}
          </Badge>
          {sources.map((source) => (
            <Badge key={source} variant="success">
              {SERVICE_POINT_SOURCE_LABELS[source]}
            </Badge>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Heatmap
          </span>
          <HeatmapButton mode="off" activeMode={heatmapMode} onHeatmapChange={onHeatmapChange} />
          <HeatmapButton
            mode="walk"
            activeMode={heatmapMode}
            disabled={requestStatus !== "success" || points.length === 0}
            loading={isGeneratingIsochrones && heatmapMode === "walk"}
            onHeatmapChange={onHeatmapChange}
          />
          <HeatmapButton
            mode="drive"
            activeMode={heatmapMode}
            disabled={requestStatus !== "success" || points.length === 0}
            loading={isGeneratingIsochrones && heatmapMode === "drive"}
            onHeatmapChange={onHeatmapChange}
          />
        </div>

        {heatmapMode === "walk" && (
          <WalkReachControl
            className="mt-3"
            disabled={isGeneratingIsochrones}
            value={walkReachMinutes}
            onChange={onWalkReachChange}
          />
        )}

        {compactMessage && (
          <p
            className="mt-3 flex items-center gap-1.5 truncate rounded-xl border border-amber-200/80 bg-amber-50/70 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
            title={messages.join(" ")}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span className="truncate">{compactMessage}</span>
          </p>
        )}
      </div>

      {extensions.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Broaden results
            </span>
            {extensions.map((extension) => {
              const active = activeExtensions.includes(extension.id);

              return (
                <button
                  key={extension.id}
                  type="button"
                  className={cn(
                    "min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    active
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900",
                  )}
                  disabled={requestStatus === "loading"}
                  onClick={() => onToggleResultExtension(extension.id)}
                  aria-pressed={active}
                  title={extension.description}
                >
                  {extension.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Start with the strongest matches. Add related subclasses only when they help your
            decision; each added place explains why it qualified.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isSearchStale && (
          <Button type="button" variant="primary" size="sm" onClick={onRefreshSearch}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Search this area
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={onOpenCategories}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Categories
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={points.length === 0}
          onClick={() => onSetDrawerMode("resultsHalf")}
        >
          <List className="h-4 w-4" aria-hidden="true" />
          Nearby entries
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={requestStatus !== "success"}
          onClick={onShare}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={points.length === 0}
          onClick={() => onExport("all")}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </Button>
      </div>

      {extendedCount > 0 && (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          Primary matches remain first. {extendedCount}{" "}
          {extendedCount === 1 ? "related place is" : "related places are"} included through your
          selected result extensions.
        </p>
      )}

      {showList && points.length > 0 && (
        <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {orderedPoints.map((point) => (
            <PointRow
              key={point.id}
              boosted={boostedPointIds.has(point.id)}
              mapCenter={mapCenter}
              onSelectPoint={onSelectPoint}
              onToggleBoost={() => onTogglePointBoost(point.id)}
              point={point}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getCompactDrawerMessage(messages: string[], totalCount: number) {
  const first = messages[0];

  if (!first) {
    return undefined;
  }

  if (first.toLowerCase().includes("open data")) {
    return totalCount > 1
      ? `Data note: Google Places backup shown. ${totalCount} notes.`
      : "Data note: Google Places backup shown.";
  }

  return totalCount > 1 ? `${first} + ${totalCount - 1} more` : first;
}

function PointRow({
  boosted,
  mapCenter,
  onSelectPoint,
  onToggleBoost,
  point,
}: {
  boosted: boolean;
  mapCenter?: { lat: number; lng: number };
  onSelectPoint: (point: ServicePoint) => void;
  onToggleBoost: () => void;
  point: ServicePoint;
}) {
  const distance = formatDistanceMiles(getDistanceMiles(mapCenter, point.location));

  return (
    <div className="flex items-start transition hover:bg-neutral-50 dark:hover:bg-neutral-900">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
        onClick={() => onSelectPoint(point)}
      >
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-950 dark:text-neutral-50">
            {point.name}
          </span>
          <span className="mt-1 block text-sm text-neutral-500 dark:text-neutral-400">
            {[distance, point.address].filter(Boolean).join(" · ")}
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">
              {point.provenance?.label || SERVICE_POINT_SOURCE_LABELS[point.source]}
            </Badge>
            {point.match?.extensionId && (
              <Badge variant="warning">{point.match.subclassification || "Related"}</Badge>
            )}
            {boosted && <Badge variant="success">Boosted for you</Badge>}
          </span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mr-2 mt-2 shrink-0 rounded-full"
        onClick={onToggleBoost}
        aria-label={`${boosted ? "Remove boost from" : "Boost"} ${point.name}`}
        aria-pressed={boosted}
        title="Keep useful places at the top on this device"
      >
        <ThumbsUp className={cn("h-4 w-4", boosted && "fill-current text-emerald-700")} aria-hidden="true" />
      </Button>
    </div>
  );
}

function PointDetail({
  boosted,
  heatmapMode,
  isGeneratingIsochrones,
  mapCenter,
  onExport,
  onHeatmapChange,
  onTogglePointBoost,
  onWalkReachChange,
  onSelectNextPoint,
  onSetDrawerMode,
  onShare,
  point,
  walkReachMinutes,
}: {
  boosted: boolean;
  heatmapMode: HeatmapMode;
  isGeneratingIsochrones: boolean;
  mapCenter?: { lat: number; lng: number };
  onExport: (scope: "selected" | "all") => void;
  onHeatmapChange: (mode: HeatmapMode) => void;
  onTogglePointBoost: () => void;
  onWalkReachChange: (minutes: WalkReachMinutes) => void;
  onSelectNextPoint: () => void;
  onSetDrawerMode: (mode: DrawerMode) => void;
  onShare: () => void;
  point: ServicePoint;
  walkReachMinutes: WalkReachMinutes;
}) {
  const distance = formatDistanceMiles(getDistanceMiles(mapCenter, point.location));

  return (
    <div className="space-y-4 pb-2">
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {point.categoryLabel || SERVICE_POINT_CATEGORY_LABELS[point.category]}
          </Badge>
          <Badge variant="success">
            {point.provenance?.label || SERVICE_POINT_SOURCE_LABELS[point.source]}
          </Badge>
          {point.match?.subclassification && (
            <Badge variant={point.match.extensionId ? "warning" : "default"}>
              {point.match.subclassification}
            </Badge>
          )}
          {distance && <Badge variant="outline">{distance}</Badge>}
        </div>
        {point.address && (
          <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {point.address}
          </p>
        )}
        {point.match && (
          <div className="mt-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">Why included</p>
            <p className="mt-1 leading-5 text-neutral-600 dark:text-neutral-300">
              {point.match.reason}
            </p>
            {point.match.conditions && point.match.conditions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {point.match.conditions.map((condition) => (
                  <Badge key={condition} variant="warning">
                    {condition}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Access</h2>
        <div className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
          <p className="flex items-start gap-2">
            <Route className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              {heatmapMode === "off"
                ? "Show a walk or drive access area to test practical reach."
                : heatmapMode === "walk"
                  ? `${walkReachMinutes}-minute walk access heat is active for this result set.`
                  : `${formatHeatmapMode(heatmapMode)} access heat is active for this result set.`}
            </span>
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Routing uses the configured MapGap Valhalla or ORS service. Provider coverage may vary.
          </p>
        </div>
        {heatmapMode === "walk" && (
          <WalkReachControl
            className="mt-4"
            disabled={isGeneratingIsochrones}
            value={walkReachMinutes}
            onChange={onWalkReachChange}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={boosted ? "primary" : "secondary"}
          onClick={onTogglePointBoost}
          aria-pressed={boosted}
        >
          <ThumbsUp className={cn("h-4 w-4", boosted && "fill-current")} aria-hidden="true" />
          {boosted ? "Boosted for me" : "Boost for me"}
        </Button>
        <Button type="button" variant="secondary" onClick={onSelectNextPoint}>
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Next nearby
        </Button>
        <Button type="button" variant="secondary" onClick={() => onSetDrawerMode("resultsHalf")}>
          <List className="h-4 w-4" aria-hidden="true" />
          Nearby entries
        </Button>
        <Button type="button" variant="primary" onClick={() => onHeatmapChange("walk")}>
          <Route className="h-4 w-4" aria-hidden="true" />
          Show access area
        </Button>
        <Button type="button" variant="secondary" onClick={() => onExport("selected")}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </Button>
        <Button type="button" variant="secondary" onClick={onShare}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </Button>
      </div>
    </div>
  );
}

function WalkReachControl({
  className,
  disabled,
  onChange,
  value,
}: {
  className?: string;
  disabled?: boolean;
  onChange: (minutes: WalkReachMinutes) => void;
  value: WalkReachMinutes;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Walk reach
      </span>
      <div
        className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950"
        role="group"
        aria-label="Walking time"
      >
        {WALK_REACH_OPTIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={cn(
              "min-h-9 min-w-12 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              value === minutes
                ? "bg-emerald-700 text-white"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
            )}
            disabled={disabled}
            onClick={() => onChange(minutes)}
            aria-pressed={value === minutes}
            aria-label={`${minutes} minute walk reach`}
          >
            {minutes} min
          </button>
        ))}
      </div>
    </div>
  );
}

function HeatmapButton({
  activeMode,
  disabled,
  loading,
  mode,
  onHeatmapChange,
}: {
  activeMode: HeatmapMode;
  disabled?: boolean;
  loading?: boolean;
  mode: HeatmapMode;
  onHeatmapChange: (mode: HeatmapMode) => void;
}) {
  const active = activeMode === mode;

  return (
    <Button
      type="button"
      variant={active ? "primary" : "secondary"}
      size="sm"
      disabled={disabled || loading}
      onClick={() => onHeatmapChange(mode)}
      aria-pressed={active}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : mode === "walk" ? (
        <Route className="h-4 w-4" aria-hidden="true" />
      ) : mode === "drive" ? (
        <Car className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {formatHeatmapMode(mode)}
    </Button>
  );
}

function getDrawerStageClass(mode: DrawerMode) {
  switch (mode) {
    case "categoryPicker":
      return "min-h-[230px] max-h-[46dvh]";
    case "resultsPeek":
      return "min-h-[260px] max-h-[42dvh]";
    case "resultsHalf":
      return "h-[66dvh] max-h-[720px]";
    case "poiDetail":
      return "min-h-[390px] max-h-[64dvh]";
    case "evidenceFull":
      return "h-[84dvh]";
    case "closed":
    default:
      return "";
  }
}

function getDrawerSubtitle(count: number, status: AsyncStatus, sources: ServicePointSource[]) {
  if (status === "loading") {
    return "Finding places in the current view.";
  }

  if (status === "failed") {
    return "Search is unavailable right now.";
  }

  if (count === 0) {
    return "Move the map or zoom out to broaden the search.";
  }

  const sourceLabel = sources
    .map((source) => SERVICE_POINT_SOURCE_LABELS[source])
    .filter(Boolean)
    .join(" + ");

  return `${count} ${count === 1 ? "place" : "places"}${sourceLabel ? ` · ${sourceLabel}` : ""}`;
}

function formatHeatmapMode(mode: HeatmapMode) {
  if (mode === "walk") {
    return "Walk";
  }

  if (mode === "drive") {
    return "Drive";
  }

  return "Off";
}
