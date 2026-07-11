import {
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  MapPinPlus,
  RefreshCw,
  Route,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { fetchPoiPlacesInBounds } from "../../lib/api";
import {
  labelForPoiSearch,
  layerToMapPoints,
  layersToMapPoints,
  POI_CATEGORY_LABELS,
  PRIMARY_POI_CATEGORIES,
} from "../../lib/poi";
import { cn } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { PoiCategory, PoiLayer } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

const MAX_LAYER_GENERATE_POINTS = 24;

type PoiLayerWorkbenchProps = {
  compact?: boolean;
};

export function PoiLayerWorkbench({ compact = false }: PoiLayerWorkbenchProps) {
  const [category, setCategory] = useState<PoiCategory>("grocery");
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const mapBounds = useMapIsoStore((state) => state.mapBounds);
  const poiLayers = useMapIsoStore((state) => state.poiLayers);
  const settings = useMapIsoStore((state) => state.settings);
  const addPoiLayer = useMapIsoStore((state) => state.addPoiLayer);
  const removePoiLayer = useMapIsoStore((state) => state.removePoiLayer);
  const clearPoiLayers = useMapIsoStore((state) => state.clearPoiLayers);
  const clearIsochrones = useMapIsoStore((state) => state.clearIsochrones);
  const clearPoints = useMapIsoStore((state) => state.clearPoints);
  const clearAll = useMapIsoStore((state) => state.clearAll);
  const setPoiLayerVisibility = useMapIsoStore((state) => state.setPoiLayerVisibility);
  const addImportedPoints = useMapIsoStore((state) => state.addImportedPoints);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();

  const runPoiSearch = async (overrideCategory?: PoiCategory, overrideQuery?: string) => {
    const nextCategory = overrideCategory || category;
    const nextQuery = overrideQuery ?? query;

    if (!mapBounds) {
      toast.error("Map view is still loading. Wait a moment and try again.");
      return;
    }

    if (nextCategory === "custom" && !nextQuery.trim()) {
      toast.error("Enter a custom POI search.");
      return;
    }

    setIsSearching(true);

    try {
      const result = await fetchPoiPlacesInBounds({
        bounds: mapBounds,
        category: nextCategory,
        query: nextQuery,
        sort: nextQuery.toLowerCase().includes("top rated") ? "rating" : "name",
      });

      if (result.points.length === 0) {
        toast(`No ${labelForPoiSearch(nextCategory, nextQuery).toLowerCase()} found here.`);
        return;
      }

      addPoiLayer({
        category: nextCategory,
        query: nextQuery,
        label: result.label || labelForPoiSearch(nextCategory, nextQuery),
        source: result.source,
        points: result.points,
        message: result.message,
        truncated: result.truncated,
      });
      toast.success(
        `Added ${result.points.length} ${labelForPoiSearch(
          nextCategory,
          nextQuery,
        ).toLowerCase()} to the map.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "POI search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const generateFromLayer = async (layer: PoiLayer) => {
    const points = layerToMapPoints(layer).slice(0, MAX_LAYER_GENERATE_POINTS);

    if (points.length === 0) {
      toast.error("This layer has no POIs to generate from.");
      return;
    }

    if (layer.points.length > points.length) {
      toast(
        `Generating from the first ${points.length} ${layer.label.toLowerCase()} for demo speed. Zoom in to reduce the layer.`,
      );
    }

    await generateIsochrones({ points, settings });
  };

  const generateFromVisibleLayers = async () => {
    const points = layersToMapPoints(poiLayers).slice(0, MAX_LAYER_GENERATE_POINTS);

    if (points.length === 0) {
      toast.error("Add or show at least one POI layer before generating.");
      return;
    }

    if (layersToMapPoints(poiLayers).length > points.length) {
      toast(
        `Generating from the first ${points.length} visible POIs for demo speed. Hide layers or zoom in for a smaller run.`,
      );
    }

    await generateIsochrones({ points, settings });
  };

  const convertLayerToLocations = (layer: PoiLayer) => {
    addImportedPoints(layer.points);
    toast.success(`${layer.label} added to the location table.`);
  };

  const layerList = poiLayers.length > 0 && (
    <div className="grid gap-2">
      {poiLayers.map((layer) => (
        <div
          key={layer.id}
          className="rounded-lg border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/60"
        >
          <div className="grid min-w-0 gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
                {layer.label}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <Badge variant="outline">{layer.points.length} places</Badge>
                <Badge variant="outline">{layer.source}</Badge>
                {layer.truncated && <Badge variant="warning">truncated</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setPoiLayerVisibility(layer.id, !layer.visible)}
                aria-label={layer.visible ? `Hide ${layer.label}` : `Show ${layer.label}`}
                title={layer.visible ? `Hide ${layer.label}` : `Show ${layer.label}`}
              >
                {layer.visible ? (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => runPoiSearch(layer.category, layer.query)}
                aria-label={`Regenerate ${layer.label}`}
                title={`Regenerate ${layer.label}`}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => convertLayerToLocations(layer)}
                aria-label={`Convert ${layer.label} to locations`}
                title={`Convert ${layer.label} to locations`}
              >
                <MapPinPlus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => generateFromLayer(layer)}
                disabled={isGeneratingIsochrones}
              >
                <Route className="h-4 w-4" aria-hidden="true" />
                Heatmap
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => removePoiLayer(layer.id)}
                aria-label={`Remove ${layer.label}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          {layer.message && (
            <p className="mt-2 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
              {layer.message}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/95",
        compact ? "space-y-3" : "space-y-4",
      )}
      aria-label="POI layers"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
            <Layers3 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            POI layers
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Add, remove, and generate access from independent place layers.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {poiLayers.length} layer{poiLayers.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {layerList}

      <div className="flex flex-wrap gap-2">
        {PRIMARY_POI_CATEGORIES.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={category === item ? "primary" : "secondary"}
            onClick={() => {
              setCategory(item);
              setQuery("");
              runPoiSearch(item, "");
            }}
            disabled={isSearching}
          >
            {POI_CATEGORY_LABELS[item]}
          </Button>
        ))}
      </div>

      <div className={compact ? "grid gap-2" : "grid gap-2 md:grid-cols-[180px_1fr_auto]"}>
        <Select value={category} onChange={(event) => setCategory(event.target.value as PoiCategory)}>
          {(Object.keys(POI_CATEGORY_LABELS) as PoiCategory[]).map((item) => (
            <option key={item} value={item}>
              {POI_CATEGORY_LABELS[item]}
            </option>
          ))}
        </Select>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Optional refinement: top rated butcher, premium produce, late dinner"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runPoiSearch();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={() => runPoiSearch()} disabled={isSearching}>
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          Add POIs
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={generateFromVisibleLayers}
          disabled={poiLayers.length === 0 || isGeneratingIsochrones}
        >
          <Route className="h-4 w-4" aria-hidden="true" />
          Generate visible
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={clearIsochrones}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Clear heatmap
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={clearPoiLayers}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear POIs
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={clearPoints}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear locations
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={clearAll}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear all
        </Button>
      </div>

    </section>
  );
}
