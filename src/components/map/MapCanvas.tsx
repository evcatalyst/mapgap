import { useEffect, type ReactNode } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L, { type LeafletMouseEvent } from "leaflet";
import toast from "react-hot-toast";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "../../constants";
import { reverseGeocode } from "../../lib/api";
import { debugError, debugLog } from "../../lib/debug";
import { cn } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { CandidateMarkers } from "./CandidateMarkers";
import { IsochroneLayer } from "./IsochroneLayer";
import { LayerLegend } from "./LayerLegend";
import { PointMarkers } from "./PointMarkers";
import { PoiMarkers } from "./PoiMarkers";
import { RasterIsochroneLayer } from "./RasterIsochroneLayer";
import { TimeRingLegend } from "./TimeRingLegend";
import type { MapBounds, MapPoint } from "../../types";

const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

type MapCanvasProps = {
  allowPointCreate?: boolean;
  children?: ReactNode;
  className?: string;
  fitStoredPoints?: boolean;
  heatmapBuckets?: number[];
  publicMode?: boolean;
  showLegacyData?: boolean;
  showIsochroneLayers?: boolean;
  showLegends?: boolean;
  showRegionLabel?: boolean;
};

function MapEvents({ enabled }: { enabled: boolean }) {
  const addPoint = useMapIsoStore((state) => state.addPoint);
  const updatePoint = useMapIsoStore((state) => state.updatePoint);
  const setGeocodeStatus = useMapIsoStore((state) => state.setGeocodeStatus);
  const canReverseGeocode = useMapIsoStore(
    (state) => state.status.apiCapabilities.openCage,
  );

  useMapEvents({
    async click(event: LeafletMouseEvent) {
      if (!enabled) {
        return;
      }

      const id = addPoint(event.latlng);

      if (!canReverseGeocode) {
        setGeocodeStatus(id, "failed");
        return;
      }

      setGeocodeStatus(id, "loading");

      try {
        const address = await reverseGeocode(event.latlng.lat, event.latlng.lng);

        if (address) {
          updatePoint(id, { address });
          setGeocodeStatus(id, "success");
        } else {
          setGeocodeStatus(id, "failed");
        }
      } catch (error) {
        setGeocodeStatus(id, "failed");
        debugError("Reverse geocode after click failed", error);
        toast.error("Point added, but geocoding failed.");
      }
    },
  });

  return null;
}

function ResizeOnChange({ sidebarOpen, layoutMode }: { sidebarOpen: boolean; layoutMode: string }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize({ animate: true });
    }, 260);

    return () => window.clearTimeout(timer);
  }, [map, sidebarOpen, layoutMode]);

  return null;
}

function getMapBounds(map: L.Map): MapBounds {
  const bounds = map.getBounds();
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();

  return {
    south: southWest.lat,
    west: southWest.lng,
    north: northEast.lat,
    east: northEast.lng,
  };
}

function ViewportBoundsSync() {
  const map = useMap();
  const setMapBounds = useMapIsoStore((state) => state.setMapBounds);

  useEffect(() => {
    setMapBounds(getMapBounds(map));
  }, [map, setMapBounds]);

  useMapEvents({
    moveend() {
      setMapBounds(getMapBounds(map));
    },
    zoomend() {
      setMapBounds(getMapBounds(map));
    },
  });

  return null;
}

function FitBoundsOnPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), DEFAULT_ZOOM), {
          animate: true,
        });
        return;
      }

      const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
      map.fitBounds(bounds, {
        animate: true,
        maxZoom: 14,
        padding: [32, 32],
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [map, points]);

  return null;
}

function MapJumpController() {
  const map = useMap();
  const mapJumpTarget = useMapIsoStore((state) => state.mapJumpTarget);
  const setMapJumpTarget = useMapIsoStore((state) => state.setMapJumpTarget);

  useEffect(() => {
    if (!mapJumpTarget) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (mapJumpTarget.bounds) {
        map.fitBounds(
          [
            [mapJumpTarget.bounds.south, mapJumpTarget.bounds.west],
            [mapJumpTarget.bounds.north, mapJumpTarget.bounds.east],
          ],
          {
            animate: true,
            maxZoom: mapJumpTarget.zoom || 14,
            padding: [28, 28],
          },
        );
      } else {
        map.setView([mapJumpTarget.lat, mapJumpTarget.lng], mapJumpTarget.zoom || 13, {
          animate: true,
        });
      }

      setMapJumpTarget(undefined);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [map, mapJumpTarget, setMapJumpTarget]);

  return null;
}

export function MapCanvas({
  allowPointCreate = true,
  children,
  className,
  fitStoredPoints = true,
  heatmapBuckets,
  publicMode = false,
  showLegacyData = true,
  showIsochroneLayers = true,
  showLegends = true,
  showRegionLabel = true,
}: MapCanvasProps = {}) {
  const points = useMapIsoStore((state) => state.points);
  const poiLayers = useMapIsoStore((state) => state.poiLayers);
  const candidateHomes = useMapIsoStore((state) => state.candidateHomes);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const regionLabel = useMapIsoStore((state) => state.decisionProfile.regionLabel);
  const theme = useMapIsoStore((state) => state.theme);
  const sidebarOpen = useMapIsoStore((state) => state.sidebarOpen);

  const showPoints = settings.viewMode === "all" || settings.viewMode === "points";
  const showIsochrones = settings.viewMode === "all" || settings.viewMode === "isochrones";
  const showIsochroneData = showIsochroneLayers && showIsochrones;
  const tileUrl = theme === "dark" ? DARK_TILE_URL : LIGHT_TILE_URL;
  const attribution =
    theme === "dark"
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  debugLog("Map render", {
    points: points.length,
    isochrones: isochrones.length,
    viewMode: settings.viewMode,
    mobilityMode: settings.mobilityMode,
    heatmapBuckets: settings.timeBuckets,
  });

  return (
    <section
      id="mapiso-capture"
      className={cn(
        "relative min-w-0 overflow-hidden bg-neutral-100 dark:bg-neutral-950",
        publicMode
          ? "h-dvh min-h-screen flex-1"
          : "h-[58vh] min-h-[360px] max-h-[520px] flex-none lg:h-full lg:min-h-[420px] lg:max-h-none lg:flex-auto",
        className,
      )}
      aria-label={
        allowPointCreate
          ? "Interactive MapGap access map. Click or tap the map to add a point."
          : "Interactive MapGap access map."
      }
    >
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        aria-label={`Map centered on ${regionLabel}`}
      >
        <TileLayer key={theme} attribution={attribution} url={tileUrl} />
        <MapEvents enabled={allowPointCreate} />
        <ViewportBoundsSync />
        <ResizeOnChange sidebarOpen={sidebarOpen} layoutMode={settings.layoutMode} />
        <MapJumpController />
        {fitStoredPoints && <FitBoundsOnPoints points={points} />}
        {showIsochroneData && <RasterIsochroneLayer features={isochrones} />}
        {showIsochroneData && <IsochroneLayer features={isochrones} />}
        {showLegacyData && <PoiMarkers layers={poiLayers} />}
        {showLegacyData && <CandidateMarkers candidates={candidateHomes} />}
        {showLegacyData && showPoints && <PointMarkers points={points} />}
        {children}
      </MapContainer>

      {showRegionLabel && (
        <div className="pointer-events-none absolute left-20 top-4 z-[500] hidden rounded-lg border border-white/70 bg-white/95 px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-950/90 dark:text-neutral-200 sm:block">
          {regionLabel}
        </div>
      )}
      {showLegends && showIsochroneData && isochrones.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-3 z-[500] hidden space-y-2 md:block">
          <LayerLegend compact />
          <TimeRingLegend buckets={heatmapBuckets} compact />
        </div>
      )}
    </section>
  );
}
