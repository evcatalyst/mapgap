import { FileText, Grid2X2, ListChecks, Star } from "lucide-react";
import toast from "react-hot-toast";
import { scoreCandidateHomes } from "../../domain/candidateScoring";
import { formatHousingPrice } from "../../domain/housing";
import { exportDecisionMemoMarkdown } from "../../lib/exports";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { CandidateZonesPanel } from "../candidates/CandidateZonesPanel";
import { ProfilePanel } from "../profile/ProfilePanel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { HousingJourney } from "./RelocationHousingStep";

export function RelocationCompareStep({
  journey,
  onBackToHomes,
}: {
  journey: HousingJourney;
  onBackToHomes: () => void;
}) {
  const profile = useMapIsoStore((state) => state.decisionProfile);
  const poiLayers = useMapIsoStore((state) => state.poiLayers);
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const candidateHomes = useMapIsoStore((state) => state.candidateHomes);
  const setCandidateHomes = useMapIsoStore((state) => state.setCandidateHomes);
  const setLastExported = useMapIsoStore((state) => state.setLastExported);
  const shortlisted = journey.listings.filter((listing) => journey.shortlistedIds.has(listing.id));
  const scoredListings = candidateHomes.filter((candidate) => candidate.source === "listing");

  function scoreShortlist() {
    if (shortlisted.length === 0) {
      toast.error("Save at least one home before comparing it.");
      return;
    }

    const candidates = scoreCandidateHomes({
      candidates: shortlisted.map((listing) => ({
        id: `candidate-${listing.id}`,
        label: listing.title,
        source: "listing" as const,
        lat: listing.location.lat,
        lng: listing.location.lng,
        address: listing.address,
        price: listing.price,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        squareFeet: listing.squareFeet,
        tenure: listing.tenure,
        listingSource: listing.source,
        listingSourceLabel: listing.sourceLabel,
        listingSourceUrl: listing.sourceUrl,
        listingAccess: listing.provenance.access,
      })),
      profile,
      poiLayers,
      points,
      isochrones,
      maxHousingPrice: journey.filters.maxPrice,
      limit: 12,
    });

    setCandidateHomes(candidates);
    toast.success(`${candidates.length} shortlisted home${candidates.length === 1 ? "" : "s"} scored.`);
  }

  function exportMemo() {
    exportDecisionMemoMarkdown({
      profile,
      candidates: scoredListings,
      poiLayers,
      points,
      isochrones,
      settings,
    });
    setLastExported("memo");
    toast.success("Relocation brief exported.");
  }

  return (
    <div className="space-y-3" aria-label="Housing comparison">
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Compare saved homes
            </h2>
            <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
              Price, anchors, access evidence, and visible daily-life layers use explicit weights.
            </p>
          </div>
          <Badge variant="outline">{shortlisted.length} saved</Badge>
        </div>

        {shortlisted.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-3 text-xs leading-4 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
            Save a few housing candidates first. The map will then rank those homes rather than
            anonymous grid cells.
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3 w-full justify-center"
              onClick={onBackToHomes}
            >
              <Star className="h-4 w-4" aria-hidden="true" />
              Return to homes
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" onClick={scoreShortlist}>
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Score shortlist
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={scoredListings.length === 0}
              onClick={exportMemo}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Export brief
            </Button>
          </div>
        )}
      </section>

      {scoredListings.length > 0 && (
        <section className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Ranked shortlist</h2>
            <Badge variant="success">Transparent score</Badge>
          </div>

          {scoredListings.map((candidate, index) => (
            <article
              key={candidate.id}
              className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    {index === 0 ? "Best current fit" : `Rank ${index + 1}`}
                  </div>
                  <h3 className="mt-0.5 truncate text-sm font-semibold">{candidate.label}</h3>
                  <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {candidate.address || candidate.listingSourceLabel}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant={candidate.score?.failedConstraints.length ? "warning" : "success"}>
                    {candidate.score?.total || 0}/100
                  </Badge>
                  {candidate.price !== undefined && candidate.tenure && (
                    <div className="mt-1 text-xs font-semibold">
                      {formatHousingPrice({ price: candidate.price, tenure: candidate.tenure })}
                    </div>
                  )}
                </div>
              </div>

              {index === 0 && (
                <div className="mt-3 grid gap-1.5 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  {candidate.score?.components.slice(0, 5).map((component) => (
                    <div key={component.key}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium">{component.label}</span>
                        <span className="font-semibold">{component.value}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
                        {component.explanation}
                      </p>
                    </div>
                  ))}
                  {candidate.score?.failedConstraints.map((failure) => (
                    <div
                      key={`${failure.constraintType}-${failure.label}`}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                    >
                      <span className="font-semibold">{failure.label}: </span>
                      {failure.explanation}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold">
          Profile weights and route evidence
        </summary>
        <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
          <ProfilePanel compact />
        </div>
      </details>

      <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold">
          <Grid2X2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Compare areas instead of listings
        </summary>
        <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
          <CandidateZonesPanel compact />
        </div>
      </details>
    </div>
  );
}
