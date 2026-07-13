import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Layers3,
  Plus,
  Route,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { SERVICE_POINT_SOURCE_LABELS } from "../../lib/servicePoints";
import { cn } from "../../lib/utils";
import type { HeatmapMode, IsochroneFeature, ServicePoint } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export type V2MapLayer = {
  id: string;
  name: string;
  points: ServicePoint[];
  isochrones: IsochroneFeature[];
  heatmapMode: HeatmapMode;
  walkReachMinutes: number;
  visible: boolean;
  heatVisible: boolean;
  expanded: boolean;
};

type V2LayerDrawerProps = {
  activeSearch?: {
    count: number;
    label: string;
    saved: boolean;
  };
  layers: V2MapLayer[];
  open: boolean;
  onAddCurrentResults: () => void;
  onClose: () => void;
  onDeleteLayer: (layerId: string) => void;
  onDeletePoint: (layerId: string, pointId: string) => void;
  onMoveLayer: (layerId: string, direction: -1 | 1) => void;
  onOpenCurrentResults: () => void;
  onSelectPoint: (point: ServicePoint) => void;
  onToggleExpanded: (layerId: string) => void;
  onToggleHeat: (layerId: string) => void;
  onToggleVisible: (layerId: string) => void;
};

export function V2LayerDrawer({
  activeSearch,
  layers,
  open,
  onAddCurrentResults,
  onClose,
  onDeleteLayer,
  onDeletePoint,
  onMoveLayer,
  onOpenCurrentResults,
  onSelectPoint,
  onToggleExpanded,
  onToggleHeat,
  onToggleVisible,
}: V2LayerDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[1190] bg-neutral-950/20 backdrop-blur-[1px] md:hidden"
        onClick={onClose}
        aria-label="Close layers panel"
      />
      <aside
        className="mapgap-v2-layer-drawer fixed inset-y-0 left-0 z-[1200] flex w-[min(88vw,360px)] flex-col border-r border-neutral-200 bg-white shadow-2xl shadow-neutral-950/20 dark:border-neutral-800 dark:bg-neutral-950"
        aria-label="Map layers"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 pb-3 pt-4 dark:border-neutral-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <Layers3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
                Map layers
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {layers.length} {layers.length === 1 ? "layer" : "layers"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={onClose}
            aria-label="Close layers panel"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeSearch && !activeSearch.saved && (
            <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-200">
                Current results
              </p>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                  {activeSearch.label}
                </p>
                <span className="shrink-0 text-xs text-neutral-600 dark:text-neutral-300">
                  {activeSearch.count} {activeSearch.count === 1 ? "place" : "places"}
                </span>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="mt-3 w-full justify-center"
                onClick={onAddCurrentResults}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add as layer
              </Button>
              <button
                type="button"
                className="mt-2 min-h-11 w-full rounded-xl text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-200 dark:hover:bg-emerald-950"
                onClick={onOpenCurrentResults}
              >
                Review and refine results
              </button>
            </div>
          )}

          {layers.length === 0 ? (
            !activeSearch || activeSearch.saved ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                <p>Search nearby, refine the places, then save the result here.</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full justify-center"
                  onClick={onOpenCurrentResults}
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Explore nearby
                </Button>
              </div>
            ) : null
          ) : (
            <div className="space-y-2">
              {layers.map((layer, index) => (
                <section
                  key={layer.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/70"
                  aria-label={`Map layer ${layer.name}`}
                >
                  <div className="flex items-center gap-1 p-2">
                    <button
                      type="button"
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-neutral-950"
                      onClick={() => onToggleExpanded(layer.id)}
                      aria-expanded={layer.expanded}
                    >
                      {layer.expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                          {layer.name}
                        </span>
                        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                          {layer.points.length} {layer.points.length === 1 ? "place" : "places"}
                        </span>
                      </span>
                    </button>
                    <LayerIconButton
                      label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                      onClick={() => onToggleVisible(layer.id)}
                    >
                      {layer.visible ? (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      )}
                    </LayerIconButton>
                    <LayerIconButton
                      label={`Delete ${layer.name}`}
                      onClick={() => onDeleteLayer(layer.id)}
                      destructive
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </LayerIconButton>
                  </div>

                  {layer.expanded && (
                    <div className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                      {(layer.isochrones.length > 0 || layers.length > 1) && (
                        <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200 p-2 dark:border-neutral-800">
                          {layer.isochrones.length > 0 && (
                            <button
                              type="button"
                              className={cn(
                                "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold",
                                layer.heatVisible
                                  ? "border-emerald-700 bg-emerald-700 text-white"
                                  : "border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200",
                              )}
                              onClick={() => onToggleHeat(layer.id)}
                              aria-pressed={layer.heatVisible}
                            >
                              <Route className="h-3.5 w-3.5" aria-hidden="true" />
                              {layer.heatmapMode === "walk"
                                ? `${layer.walkReachMinutes} min walk`
                                : "Drive heat"}
                            </button>
                          )}
                          <div className="ml-auto flex gap-1">
                            <LayerIconButton
                              label={`Move ${layer.name} up`}
                              disabled={index === 0}
                              onClick={() => onMoveLayer(layer.id, -1)}
                            >
                              <ArrowUp className="h-4 w-4" aria-hidden="true" />
                            </LayerIconButton>
                            <LayerIconButton
                              label={`Move ${layer.name} down`}
                              disabled={index === layers.length - 1}
                              onClick={() => onMoveLayer(layer.id, 1)}
                            >
                              <ArrowDown className="h-4 w-4" aria-hidden="true" />
                            </LayerIconButton>
                          </div>
                        </div>
                      )}

                      <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
                        {layer.points.map((point) => (
                          <div key={point.id} className="flex items-start gap-2 px-2 py-2">
                            <button
                              type="button"
                              className="min-h-11 min-w-0 flex-1 rounded-lg px-2 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-neutral-900"
                              onClick={() => onSelectPoint(point)}
                            >
                              <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {point.name}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-1">
                                <Badge variant="outline">
                                  {point.match?.subclassification ||
                                    point.provenance?.label ||
                                    SERVICE_POINT_SOURCE_LABELS[point.source]}
                                </Badge>
                              </span>
                            </button>
                            <LayerIconButton
                              label={`Delete ${point.name} from ${layer.name}`}
                              onClick={() => onDeletePoint(layer.id, point.id)}
                              destructive
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </LayerIconButton>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function LayerIconButton({
  children,
  destructive,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-900",
        destructive && "text-rose-600 dark:text-rose-300",
      )}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
