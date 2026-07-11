import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { FormEvent, useId, useState } from "react";
import toast from "react-hot-toast";
import { MOBILITY_MODES } from "../../constants";
import {
  buildTimeBucketsForIntent,
  parseAskMapGapPrompt,
  type AskMapGapEnrichmentStep,
  type AskMapGapIntent,
} from "../../domain/askMapGap";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { fetchPoiPlacesInBounds, searchPlaces } from "../../lib/api";
import { poiToMapPoint } from "../../lib/poi";
import { cn } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { MapBounds } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const MAX_ASK_GENERATE_POINTS = 24;

type AskRunState = {
  intent: AskMapGapIntent;
  placeName?: string;
  pointCount?: number;
  generated: boolean;
};

type AskMapGapPanelProps = {
  compact?: boolean;
  inline?: boolean;
  className?: string;
};

export function AskMapGapPanel({
  compact = false,
  inline = false,
  className,
}: AskMapGapPanelProps) {
  const inputId = useId();
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<AskRunState>();
  const mapBounds = useMapIsoStore((state) => state.mapBounds);
  const settings = useMapIsoStore((state) => state.settings);
  const addPoiLayer = useMapIsoStore((state) => state.addPoiLayer);
  const setSelectedPlace = useMapIsoStore((state) => state.setSelectedPlace);
  const setMapJumpTarget = useMapIsoStore((state) => state.setMapJumpTarget);
  const setMobilityMode = useMapIsoStore((state) => state.setMobilityMode);
  const setTimeBuckets = useMapIsoStore((state) => state.setTimeBuckets);
  const setTimeMinutes = useMapIsoStore((state) => state.setTimeMinutes);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();

  const runAsk = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = prompt.trim();

    if (trimmed.length < 4) {
      toast.error("Ask for a place, POI category, or access heatmap.");
      return;
    }

    const intent = parseAskMapGapPrompt(trimmed);

    if (intent.confidence === "low") {
      setLastRun({ intent, generated: false });
      toast.error("I could not map that yet. Try naming a place type like laundry, grocery, or coffee.");
      return;
    }

    setIsRunning(true);

    try {
      const bounds = await resolveBounds(intent, mapBounds);

      if (!bounds) {
        toast.error("Search a place or wait for the map view to finish loading.");
        return;
      }

      const buckets = buildTimeBucketsForIntent(intent.maxMinutes);
      const transportMode = MOBILITY_MODES[intent.mobilityMode].transportMode;

      setMobilityMode(intent.mobilityMode);

      if (intent.maxMinutes) {
        setTimeMinutes(intent.maxMinutes);
      }

      if (buckets) {
        setTimeBuckets(buckets);
      }

      const poiResult = await fetchPoiPlacesInBounds({
        bounds,
        category: intent.category,
        query: intent.poiQuery,
        sort: intent.sort,
      });

      if (poiResult.points.length === 0) {
        setLastRun({ intent, generated: false, pointCount: 0 });
        toast(`No matching places found for ${intent.summary.toLowerCase()}`);
        return;
      }

      const layerId = addPoiLayer({
        category: poiResult.category,
        query: poiResult.query,
        label: poiResult.label,
        source: poiResult.source,
        points: poiResult.points,
        message: poiResult.message,
        truncated: poiResult.truncated,
      });

      let generated = false;

      if (intent.shouldGenerate) {
        const points = poiResult.points
          .slice(0, MAX_ASK_GENERATE_POINTS)
          .map((point, index) => poiToMapPoint(point, index, `ask-${layerId}`));

        if (poiResult.points.length > points.length) {
          toast(
            `Generating from the first ${points.length} places for demo speed. Zoom in to narrow the request.`,
          );
        }

        await generateIsochrones({
          points,
          settings: {
            ...settings,
            mobilityMode: intent.mobilityMode,
            transportMode,
            timeMinutes: intent.maxMinutes || settings.timeMinutes,
            timeBuckets: buckets || settings.timeBuckets,
          },
        });
        generated = true;
      }

      setLastRun({
        intent,
        pointCount: poiResult.points.length,
        generated,
      });
      toast.success(
        `${poiResult.points.length} place${poiResult.points.length === 1 ? "" : "s"} mapped${
          generated ? " with access heat" : ""
        }.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ask MapGap failed.");
    } finally {
      setIsRunning(false);
    }
  };

  const resolveBounds = async (intent: AskMapGapIntent, fallbackBounds?: MapBounds) => {
    if (!intent.placeQuery) {
      return fallbackBounds;
    }

    const places = await searchPlaces(intent.placeQuery, fallbackBounds);
    const place = places[0];

    if (!place) {
      return fallbackBounds;
    }

    setSelectedPlace(place);
    setMapJumpTarget({
      id: place.id,
      label: place.name,
      lat: place.lat,
      lng: place.lng,
      bounds: place.viewport,
      zoom: place.viewport ? 14 : 13,
    });

    return place.viewport || fallbackBounds;
  };

  if (inline) {
    return (
      <section className={cn("min-w-0", className)} aria-label="Ask MapGap">
        <form className="flex min-w-0 items-center gap-2" onSubmit={runAsk}>
          <label className="sr-only" htmlFor={inputId}>
            Ask MapGap quick prompt
          </label>
          <div className="relative min-w-0 flex-1">
            <Sparkles
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600"
              aria-hidden="true"
            />
            <Input
              id={inputId}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask: laundromats in this view"
              className="h-9 bg-white/90 pl-9 dark:bg-neutral-950/90"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isRunning || isGeneratingIsochrones}
            aria-label="Run quick Ask MapGap"
            title="Run Ask MapGap"
            className="h-9 shrink-0 px-3"
          >
            {isRunning || isGeneratingIsochrones ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden 2xl:inline">Ask</span>
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/30",
        compact ? "space-y-3" : "space-y-3",
        className,
      )}
      aria-label="Ask MapGap"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="truncate">Ask MapGap</span>
        </h2>
        {lastRun && (
          <Badge variant={lastRun.generated ? "success" : "outline"} className="shrink-0">
            {lastRun.generated ? "heatmap" : "layer"}
          </Badge>
        )}
      </div>

      <form className={compact ? "grid gap-2" : "flex min-w-0 items-center gap-2"} onSubmit={runAsk}>
        <label className="sr-only" htmlFor={inputId}>
          Ask MapGap prompt
        </label>
        <Input
          id={inputId}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Try: laundromats in Jersey City within 10 min walk"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={isRunning || isGeneratingIsochrones}
          aria-label="Run Ask MapGap"
        >
          {isRunning || isGeneratingIsochrones ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Wand2 className="h-4 w-4" aria-hidden="true" />
          )}
          Ask
        </Button>
      </form>

      {lastRun && (
        <div className="space-y-2">
          <p className="text-xs font-medium leading-4 text-emerald-900 dark:text-emerald-100">
            {lastRun.intent.summary}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lastRun.intent.steps.map((step) => (
              <Badge key={step} variant="outline" className="bg-white/70 dark:bg-neutral-950/40">
                {step}
              </Badge>
            ))}
            {typeof lastRun.pointCount === "number" && (
              <Badge variant="outline" className="bg-white/70 dark:bg-neutral-950/40">
                {lastRun.pointCount} places
              </Badge>
            )}
          </div>
          <div className="border-t border-emerald-200 pt-2 dark:border-emerald-900/70">
            <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">
              Grounded plan
            </div>
            <div className="mt-2 grid gap-1.5">
              {lastRun.intent.enrichmentPlan.map((step) => (
                <div
                  key={step.id}
                  className="grid min-w-0 gap-1 rounded-md border border-white/70 bg-white/60 px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950/40"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate font-medium text-neutral-800 dark:text-neutral-100">
                      {step.label}
                    </span>
                    <Badge variant={enrichmentVariant(step)} className="shrink-0">
                      {enrichmentSourceLabel(step)}
                    </Badge>
                  </div>
                  <p className="leading-4 text-neutral-600 dark:text-neutral-300">{step.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function enrichmentVariant(step: AskMapGapEnrichmentStep) {
  return step.status === "needs-review" ? "warning" : "outline";
}

function enrichmentSourceLabel(step: AskMapGapEnrichmentStep) {
  switch (step.source) {
    case "deterministic-parser":
      return "parser";
    case "provider-data":
      return "provider";
    case "routing-provider":
      return "routing";
    case "future-llm":
      return "review";
    default:
      return step.source;
  }
}
