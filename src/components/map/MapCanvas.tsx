import { useEffect } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MOBILITY_MODES } from "../../constants";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { reverseGeocode } from "../../lib/api";
import { debugError, debugLog } from "../../lib/debug";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { Button } from "../ui/button";
import { LoadingSpinner } from "../LoadingSpinner";
import { IsochroneLayer } from "./IsochroneLayer";
import { LayerLegend } from "./LayerLegend";
import { PointMarkers } from "./PointMarkers";
import { RasterIsochroneLayer } from "./RasterIsochroneLayer";
import { TimeRingLegend } from "./TimeRingLegend";

const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function MapEvents() {
  const addPoint = useMapIsoStore((state) => state.addPoint);
  const updatePoint = useMapIsoStore((state) => state.updatePoint);
  const setGeocodeStatus = useMapIsoStore((state) => state.setGeocodeStatus);
  const canReverseGeocode = useMapIsoStore(
    (state) => state.status.apiCapabilities.openCage,
  );

  useMapEvents({
    async click(event: LeafletMouseEvent) {
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

function FloatingGenerateButton() {
  const points = useMapIsoStore((state) => state.points);
  const settings = useMapIsoStore((state) => state.settings);
  const status = useMapIsoStore((state) => state.status);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();
  const selectedMode = MOBILITY_MODES[settings.mobilityMode];
  const disabled =
    isGeneratingIsochrones || points.length === 0 || !status.apiCapabilities.openRouteService;

  return (
    <Button
      type="button"
      variant={disabled ? "secondary" : "primary"}
      className="absolute bottom-4 right-4 z-[500] min-h-12 shadow-soft"
      style={disabled ? undefined : { backgroundColor: selectedMode.color }}
      onClick={generateIsochrones}
      disabled={disabled}
      aria-label="Generate effort-adjusted isochrones"
    >
      {isGeneratingIsochrones ? (
        <LoadingSpinner label="Finding gaps" />
      ) : (
        <>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {status.apiCapabilities.openRouteService ? "Generate" : "Routing API required"}
        </>
      )}
    </Button>
  );
}

export function MapCanvas() {
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const theme = useMapIsoStore((state) => state.theme);
  const sidebarOpen = useMapIsoStore((state) => state.sidebarOpen);

  const showPoints = settings.viewMode === "all" || settings.viewMode === "points";
  const showIsochrones = settings.viewMode === "all" || settings.viewMode === "isochrones";
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
      className="relative h-full min-h-[420px] overflow-hidden bg-neutral-100 dark:bg-neutral-950"
      aria-label="Interactive MapGap access map. Click or tap the map to add a point."
    >
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        aria-label="Map centered on Niskayuna, New York"
      >
        <TileLayer key={theme} attribution={attribution} url={tileUrl} />
        <MapEvents />
        <ResizeOnChange sidebarOpen={sidebarOpen} layoutMode={settings.layoutMode} />
        {showIsochrones && <RasterIsochroneLayer features={isochrones} />}
        {showIsochrones && <IsochroneLayer features={isochrones} />}
        {showPoints && <PointMarkers points={points} />}
      </MapContainer>

      <div className="pointer-events-none absolute left-20 top-4 z-[500] hidden rounded-lg border border-white/70 bg-white/95 px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-950/90 dark:text-neutral-200 sm:block">
        Niskayuna, NY
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-[500] hidden w-60 space-y-3 md:block">
        <LayerLegend />
        <TimeRingLegend />
      </div>
      <FloatingGenerateButton />
    </section>
  );
}
