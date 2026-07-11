import { FileText, Grid2X2, MapPinned, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { generateCandidateHomes } from "../../domain/candidateScoring";
import { exportDecisionMemoMarkdown } from "../../lib/exports";
import { cn } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type CandidateZonesPanelProps = {
  compact?: boolean;
  className?: string;
};

export function CandidateZonesPanel({ compact = false, className }: CandidateZonesPanelProps) {
  const mapBounds = useMapIsoStore((state) => state.mapBounds);
  const decisionProfile = useMapIsoStore((state) => state.decisionProfile);
  const poiLayers = useMapIsoStore((state) => state.poiLayers);
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const candidateHomes = useMapIsoStore((state) => state.candidateHomes);
  const setCandidateHomes = useMapIsoStore((state) => state.setCandidateHomes);
  const clearCandidateHomes = useMapIsoStore((state) => state.clearCandidateHomes);
  const setLastExported = useMapIsoStore((state) => state.setLastExported);

  const generateCandidates = () => {
    if (!mapBounds) {
      toast.error("Map view is still loading. Wait a moment and try again.");
      return;
    }

    const candidates = generateCandidateHomes({
      bounds: mapBounds,
      profile: decisionProfile,
      poiLayers,
      points,
      isochrones,
      limit: compact ? 6 : 8,
    });

    setCandidateHomes(candidates);
    toast.success(`${candidates.length} candidate zones scored.`);
  };

  const exportMemo = () => {
    exportDecisionMemoMarkdown({
      profile: decisionProfile,
      candidates: candidateHomes,
      poiLayers,
      points,
      isochrones,
      settings,
    });
    setLastExported("memo");
    toast.success("Decision memo exported.");
  };

  const topCandidate = candidateHomes[0];

  return (
    <section
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950",
        compact ? "space-y-3" : "space-y-4",
        className,
      )}
      aria-label="Candidate zones"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
            <Grid2X2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            Candidate zones
          </h2>
          <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
            Current viewport, profile anchors, and visible POI layers.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {candidateHomes.length} scored
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" onClick={generateCandidates}>
          <MapPinned className="h-4 w-4" aria-hidden="true" />
          Generate candidate zones
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={clearCandidateHomes}
          disabled={candidateHomes.length === 0}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear zones
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={exportMemo}
          disabled={candidateHomes.length === 0 && poiLayers.length === 0 && points.length === 0}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Export memo
        </Button>
      </div>

      {topCandidate && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-300">
                Top candidate
              </div>
              <div className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                {topCandidate.label}
              </div>
            </div>
            <Badge variant="success" className="shrink-0">
              {topCandidate.score?.total ?? 0}/100
            </Badge>
          </div>
          <div className="mt-2 grid gap-1.5">
            {topCandidate.score?.components.slice(0, 3).map((component) => (
              <div key={component.key} className="text-xs text-neutral-600 dark:text-neutral-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{component.label}</span>
                  <span className="font-semibold">{component.value}</span>
                </div>
                <p className="mt-0.5 leading-4 text-neutral-500 dark:text-neutral-400">
                  {component.explanation}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-emerald-200 pt-3 dark:border-emerald-900/70">
            <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">
              Required constraints
            </div>
            {topCandidate.score?.failedConstraints.length ? (
              <div className="mt-2 grid gap-1.5">
                {topCandidate.score.failedConstraints.slice(0, 3).map((constraint) => (
                  <div
                    key={`${constraint.constraintType}-${constraint.label}`}
                    className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
                  >
                    <div className="font-medium">{constraint.label}</div>
                    <div className="mt-0.5 leading-4">{constraint.explanation}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
                No required constraints failed in this proxy score.
              </p>
            )}
          </div>

          {topCandidate.score?.assumptions.length ? (
            <div className="mt-3 border-t border-emerald-200 pt-3 dark:border-emerald-900/70">
              <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">
                Assumptions
              </div>
              <div className="mt-2 grid gap-1.5">
                {topCandidate.score.assumptions.slice(0, 6).map((assumption) => (
                  <div
                    key={assumption.id}
                    className="rounded-md border border-white/80 bg-white/70 px-2 py-1.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-neutral-800 dark:text-neutral-100">
                        {assumption.label}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {assumption.source}
                      </Badge>
                    </div>
                    <div className="mt-0.5 leading-4">{assumption.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {candidateHomes.length > 1 && (
        <div className="grid gap-2">
          {candidateHomes.slice(1, compact ? 3 : 5).map((candidate) => (
            <div
              key={candidate.id}
              className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/60"
            >
              <span className="truncate font-medium text-neutral-800 dark:text-neutral-100">
                {candidate.label}
              </span>
              <Badge variant="outline" className="shrink-0">
                {candidate.score?.total ?? 0}/100
              </Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
