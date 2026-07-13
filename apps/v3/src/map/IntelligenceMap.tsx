import {useEffect, useRef, useState} from "react";
import type {Layer} from "@deck.gl/core";
import {MapboxOverlay} from "@deck.gl/mapbox";
import maplibregl, {type ErrorEvent as MapLibreErrorEvent, type Map as MapLibreMap} from "maplibre-gl";
import type {CanonicalSelection} from "../adapters/analysis-to-datasets";
import {
  createIntelligenceLayer,
  createSelectionLayer,
  type IntelligenceLayerState,
  type IntelligenceSource,
} from "./intelligence-layers";
import {TOKEN_FREE_MAP_STYLE_URL} from "./token-free-style";
import {MAXIMUM_INTELLIGENCE_TILE_CACHE_SIZE} from "../scale";

export type IntelligenceViewport = {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
};

export type IntelligenceMapProps = {
  sources: IntelligenceSource[];
  layers: IntelligenceLayerState[];
  selection: CanonicalSelection;
  onSelect: (selection: CanonicalSelection) => void;
  linkedBbox: [number, number, number, number] | null;
  presetId: "civic" | "relocation";
  viewport: IntelligenceViewport;
  onViewportChange?: (viewport: IntelligenceViewport) => void;
};

type MapFailure = {
  kind: "initialization" | "basemap" | "webgl" | "overlay";
  message: string;
};

type LayerFailure = {id: string; message: string};

/**
 * Owns only the right-hand renderer. Every retry tears down this MapLibre/deck
 * instance; it cannot navigate or remount the sibling V2 iframe.
 */
export function IntelligenceMap({
  sources,
  layers,
  selection,
  onSelect,
  linkedBbox,
  presetId,
  viewport,
  onViewportChange,
}: IntelligenceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<MapFailure | null>(null);
  const [layerFailures, setLayerFailures] = useState<LayerFailure[]>([]);
  const [retryRevision, setRetryRevision] = useState(0);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap | null = null;
    let overlay: MapboxOverlay | null = null;
    let disposed = false;

    setReady(false);
    setFailure(null);

    const fail = (next: MapFailure) => {
      if (!disposed) setFailure(next);
    };

    try {
      // A constructor that previously failed before returning a Map instance
      // may have left partial DOM behind. The container belongs exclusively to
      // this renderer, so retries start from a clean surface.
      container.replaceChildren();
      map = new maplibregl.Map({
        container,
        style: TOKEN_FREE_MAP_STYLE_URL,
        center: [viewport.longitude, viewport.latitude],
        zoom: viewport.zoom,
        bearing: viewport.bearing,
        pitch: viewport.pitch,
        attributionControl: false,
        maxPitch: 0,
        dragRotate: false,
        maxTileCacheSize: MAXIMUM_INTELLIGENCE_TILE_CACHE_SIZE,
      });

      overlay = new MapboxOverlay({
        interleaved: true,
        layers: [],
        onError: (error, layer) => {
          if (disposed) return;
          const id = layer?.id ?? "deck-overlay";
          setLayerFailures((current) => mergeLayerFailure(current, {id, message: errorMessage(error)}));
        },
      });
      map.addControl(overlay);
      map.addControl(new maplibregl.NavigationControl({showCompass: false}), "bottom-right");

      const handleLoad = () => {
        if (disposed) return;
        setReady(true);
        setFailure(null);
      };
      const handleError = (event: MapLibreErrorEvent) => {
        // Individual missing tiles do not invalidate a loaded renderer. A
        // style/bootstrap error does, and can be retried in this pane.
        if (map && !map.isStyleLoaded()) {
          fail({kind: "basemap", message: errorMessage(event.error)});
        }
      };
      const handleMoveEnd = () => {
        if (!map) return;
        const center = map.getCenter();
        onViewportChangeRef.current?.({
          longitude: center.lng,
          latitude: center.lat,
          zoom: map.getZoom(),
          bearing: normalizeBearing(map.getBearing()),
          pitch: map.getPitch(),
        });
      };
      const canvas = map.getCanvas();
      const handleContextLost: EventListener = (event) => {
        event.preventDefault();
        fail({kind: "webgl", message: "The graphics context was lost."});
      };
      const handleContextRestored = () => {
        // Recreate the right-hand renderer after browser restoration rather
        // than trusting partially initialized MapLibre/deck resources.
        if (!disposed) setRetryRevision((revision) => revision + 1);
      };

      map.on("load", handleLoad);
      map.on("error", handleError);
      map.on("moveend", handleMoveEnd);
      canvas.addEventListener("webglcontextlost", handleContextLost);
      canvas.addEventListener("webglcontextrestored", handleContextRestored);
      mapRef.current = map;
      overlayRef.current = overlay;

      return () => {
        disposed = true;
        canvas.removeEventListener("webglcontextlost", handleContextLost);
        canvas.removeEventListener("webglcontextrestored", handleContextRestored);
        map?.off("load", handleLoad);
        map?.off("error", handleError);
        map?.off("moveend", handleMoveEnd);
        overlayRef.current = null;
        mapRef.current = null;
        try {
          map?.remove();
        } catch (error) {
          console.warn("MapGap intelligence renderer cleanup failed", error);
        }
      };
    } catch (error) {
      disposed = true;
      overlayRef.current = null;
      mapRef.current = null;
      try {
        map?.remove();
      } catch {
        // The constructor/setup error is the actionable failure.
      }
      container.replaceChildren();
      setFailure({kind: "initialization", message: errorMessage(error)});
    }
  // Viewport changes are persisted by the host, but must not reconstruct the
  // renderer on every pan. Preset changes and explicit retries do remount it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, retryRevision]);

  useEffect(() => {
    const failures: LayerFailure[] = [];
    const deckLayers: Layer[] = [];

    for (const layer of layers) {
      const source = sources.find((entry) => entry.id === layer.sourceId);
      if (!source) continue;
      try {
        const result = createIntelligenceLayer({layer, source, onSelect});
        if (result) deckLayers.push(result);
      } catch (error) {
        failures.push({id: layer.id, message: errorMessage(error)});
      }
    }

    try {
      const selectionLayer = createSelectionLayer(selection);
      if (selectionLayer) deckLayers.unshift(selectionLayer);
    } catch (error) {
      failures.push({id: "shared-selection", message: errorMessage(error)});
    }

    try {
      overlayRef.current?.setProps({layers: deckLayers.reverse()});
    } catch (error) {
      setFailure({kind: "overlay", message: errorMessage(error)});
    }
    setLayerFailures((current) => sameLayerFailures(current, failures) ? current : failures);
  }, [layers, onSelect, selection, sources, retryRevision]);

  useEffect(() => {
    if (!linkedBbox || !mapRef.current) return;
    try {
      mapRef.current.fitBounds(
        [[linkedBbox[0], linkedBbox[1]], [linkedBbox[2], linkedBbox[3]]],
        {
          padding: 42,
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 360,
          maxZoom: 14,
        },
      );
    } catch (error) {
      setFailure({kind: "overlay", message: errorMessage(error)});
    }
  }, [linkedBbox, presetId, retryRevision]);

  const retry = () => setRetryRevision((revision) => revision + 1);

  return <div className="map-stage" data-testid="intelligence-map">
    <div ref={containerRef} className="map-canvas" />
    {!ready && !failure && <div className="map-loading"><i/><span>Loading intelligence map…</span></div>}
    {failure && <div className="map-error" data-testid="basemap-error" data-failure-kind={failure.kind} role="alert">
      <strong>{failure.kind === "webgl" ? "Graphics context interrupted" : "Intelligence map unavailable"}</strong>
      <span>Sources and evidence remain unchanged. MapGap V2 is still live.</span>
      <small className="sr-only">{failure.message}</small>
      <button type="button" onClick={retry}>Retry intelligence map</button>
    </div>}
    {!failure && layerFailures.length > 0 && <div className="layer-failure" role="status" data-testid="layer-failure">
      {layerFailures.length} {layerFailures.length === 1 ? "overlay" : "overlays"} unavailable; remaining layers are still active.
    </div>}
    <p className="map-attribution" data-testid="map-attribution"><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></p>
    <span className="sr-only" data-testid="intelligence-mounted">{ready ? "MapLibre intelligence workbench mounted" : "Mounting intelligence workbench"}</span>
  </div>;
}

function mergeLayerFailure(failures: LayerFailure[], next: LayerFailure): LayerFailure[] {
  const withoutPrevious = failures.filter((failure) => failure.id !== next.id);
  return [...withoutPrevious, next];
}

function sameLayerFailures(left: LayerFailure[], right: LayerFailure[]) {
  return left.length === right.length
    && left.every((failure, index) => failure.id === right[index]?.id && failure.message === right[index]?.message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown renderer failure";
}

function normalizeBearing(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}
