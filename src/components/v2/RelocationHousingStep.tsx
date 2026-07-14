import {
  AlertTriangle,
  ExternalLink,
  FileUp,
  Home,
  Info,
  Search,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  formatHousingPrice,
  HOUSING_SOURCE_LABELS,
  parseHousingListingsCsv,
  type HousingListing,
  type HousingListingResponse,
  type HousingSearchFilters,
} from "../../domain/housing";
import { cn } from "../../lib/utils";
import { fetchHousingListings } from "../../services/housingListingsClient";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { MapBounds } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

function housingSearchSignature(
  bounds: MapBounds | undefined,
  filters: HousingSearchFilters,
) {
  if (!bounds) return undefined;

  return JSON.stringify({
    bbox: [bounds.west, bounds.south, bounds.east, bounds.north].map((value) =>
      Number(value.toFixed(4)),
    ),
    tenure: filters.tenure,
    maxPrice: filters.maxPrice,
    minBedrooms: filters.minBedrooms,
  });
}

export function useHousingJourney() {
  const mapBounds = useMapIsoStore((state) => state.mapBounds);
  const setMapJumpTarget = useMapIsoStore((state) => state.setMapJumpTarget);
  const clearCandidateHomes = useMapIsoStore((state) => state.clearCandidateHomes);
  const [providerListings, setProviderListings] = useState<HousingListing[]>([]);
  const [importedListings, setImportedListings] = useState<HousingListing[]>([]);
  const [filters, setFilters] = useState<HousingSearchFilters>({
    tenure: "rent",
    maxPrice: 2_400,
    minBedrooms: 1,
  });
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [responseMode, setResponseMode] = useState<HousingListingResponse["mode"]>();
  const [lastSearchSignature, setLastSearchSignature] = useState<string>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const currentSearchSignature = useMemo(
    () => housingSearchSignature(mapBounds, filters),
    [filters, mapBounds],
  );
  const listings = useMemo(
    () => [...importedListings, ...providerListings],
    [importedListings, providerListings],
  );
  const searchStale =
    providerListings.length > 0 && lastSearchSignature !== currentSearchSignature;

  async function searchCurrentView() {
    if (!mapBounds) {
      toast.error("Map view is still loading.");
      return;
    }

    setStatus("loading");
    setError(undefined);

    try {
      const response = await fetchHousingListings({ bounds: mapBounds, filters });
      setProviderListings(response.listings);
      clearCandidateHomes();
      setResponseMode(response.mode);
      setLastSearchSignature(currentSearchSignature);
      setWarnings(response.warnings || []);
      setStatus("success");
      setSelectedListingId(null);
      setShortlistedIds((current) => {
        const validIds = new Set([
          ...importedListings.map((listing) => listing.id),
          ...response.listings.map((listing) => listing.id),
        ]);
        return new Set(Array.from(current).filter((id) => validIds.has(id)));
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Housing search failed.";
      setError(
        providerListings.length > 0
          ? `${message} Previous provider results remain visible.`
          : message,
      );
      setStatus("error");
      toast.error(message);
    }
  }

  async function importCsv(file?: File) {
    if (!file) return;

    const parsed = parseHousingListingsCsv(await file.text());
    if (parsed.listings.length === 0) {
      toast.error(parsed.warnings[0] || "No valid listing rows were found.");
      return;
    }

    setImportedListings((current) => [...current, ...parsed.listings]);
    clearCandidateHomes();
    setWarnings((current) => [...current, ...parsed.warnings]);
    toast.success(
      `Imported ${parsed.listings.length} housing record${
        parsed.listings.length === 1 ? "" : "s"
      } for this session.`,
    );
  }

  function selectListing(listing: HousingListing) {
    setSelectedListingId(listing.id);
    setMapJumpTarget({
      id: `housing-${listing.id}`,
      label: listing.title,
      lat: listing.location.lat,
      lng: listing.location.lng,
      zoom: 13,
    });
  }

  function toggleShortlist(listingId: string) {
    clearCandidateHomes();
    setShortlistedIds((current) => {
      const next = new Set(current);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  }

  function clearHousing() {
    clearCandidateHomes();
    setProviderListings([]);
    setImportedListings([]);
    setSelectedListingId(null);
    setShortlistedIds(new Set());
    setResponseMode(undefined);
    setLastSearchSignature(undefined);
    setWarnings([]);
    setError(undefined);
    setStatus("idle");
  }

  return {
    listings,
    filters,
    setFilters,
    selectedListingId,
    shortlistedIds,
    status,
    responseMode,
    searchStale,
    warnings,
    error,
    searchCurrentView,
    importCsv,
    selectListing,
    toggleShortlist,
    clearHousing,
  };
}

export type HousingJourney = ReturnType<typeof useHousingJourney>;

export function RelocationHousingStep({ journey }: { journey: HousingJourney }) {
  const selectedListing = journey.listings.find(
    (listing) => listing.id === journey.selectedListingId,
  );

  return (
    <div className="space-y-3" aria-label="Housing candidates">
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Home className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Homes in this view
            </h2>
            <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
              Search only when you are ready. Panning does not spend a provider request.
            </p>
          </div>
          <Badge variant="outline">{journey.shortlistedIds.size} saved</Badge>
        </div>

        {journey.searchStale && (
          <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs leading-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Map or filters changed. Existing provider results remain visible until you refresh.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
            For
            <select
              value={journey.filters.tenure}
              onChange={(event) =>
                journey.setFilters((current) => ({
                  ...current,
                  tenure: event.target.value === "sale" ? "sale" : "rent",
                }))
              }
              className="mt-1 h-11 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              aria-label="Housing tenure"
            >
              <option value="rent">Rent</option>
              <option value="sale">Buy</option>
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {journey.filters.tenure === "rent" ? "Monthly budget" : "Purchase budget"}
            <input
              type="number"
              min={100}
              step={journey.filters.tenure === "rent" ? 100 : 5_000}
              value={journey.filters.maxPrice ?? ""}
              onChange={(event) =>
                journey.setFilters((current) => ({
                  ...current,
                  maxPrice: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
              className="mt-1 h-11 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              aria-label="Maximum housing price"
            />
          </label>
          <label className="col-span-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            Minimum bedrooms
            <select
              value={journey.filters.minBedrooms ?? ""}
              onChange={(event) =>
                journey.setFilters((current) => ({
                  ...current,
                  minBedrooms: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
              className="mt-1 h-11 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              aria-label="Minimum bedrooms"
            >
              <option value="">Any</option>
              <option value="0">Studio+</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </label>
        </div>

        <Button
          type="button"
          variant="primary"
          className="w-full justify-center"
          disabled={journey.status === "loading"}
          onClick={() => void journey.searchCurrentView()}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {journey.status === "loading"
            ? "Finding homes..."
            : journey.searchStale
              ? "Refresh homes in this view"
              : "Find homes in this view"}
        </Button>

        {journey.error && (
          <p role="alert" className="text-xs leading-4 text-rose-700 dark:text-rose-300">
            {journey.error}
          </p>
        )}
      </section>

      {journey.warnings.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{journey.warnings[0]}</span>
        </div>
      )}

      {journey.listings.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <div>
              <h2 className="text-sm font-semibold">
                {journey.listings.length} map candidate{journey.listings.length === 1 ? "" : "s"}
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Select a marker or save a home for comparison.
              </p>
            </div>
            {journey.responseMode && (
              <Badge variant={journey.responseMode === "live" ? "success" : "warning"}>
                {journey.responseMode === "live" ? "Live feed" : "Examples"}
              </Badge>
            )}
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {journey.listings.slice(0, 12).map((listing) => {
              const selected = selectedListing?.id === listing.id;
              const shortlisted = journey.shortlistedIds.has(listing.id);

              return (
                <article
                  key={listing.id}
                  className={cn(
                    "flex items-start gap-2 p-2",
                    selected && "bg-emerald-50 dark:bg-emerald-950/20",
                  )}
                >
                  <button
                    type="button"
                    className="min-h-11 min-w-0 flex-1 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    onClick={() => journey.selectListing(listing)}
                    aria-label={`Select ${listing.title}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{listing.title}</span>
                      <span className="shrink-0 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        {formatHousingPrice(listing)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {[
                        listing.bedrooms !== undefined ? `${listing.bedrooms} bd` : undefined,
                        listing.bathrooms !== undefined ? `${listing.bathrooms} ba` : undefined,
                        listing.squareFeet ? `${listing.squareFeet.toLocaleString()} sq ft` : undefined,
                        listing.propertyType,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Details not provided"}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      <Badge variant="outline">{listing.sourceLabel}</Badge>
                      {listing.provenance.access !== "illustrative" && (
                        <Badge variant="outline">{listing.provenance.access}</Badge>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                      shortlisted
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300",
                    )}
                    onClick={() => journey.toggleShortlist(listing.id)}
                    aria-label={`${shortlisted ? "Remove" : "Add"} ${listing.title} ${
                      shortlisted ? "from" : "to"
                    } shortlist`}
                    aria-pressed={shortlisted}
                  >
                    <Star className="h-4 w-4" fill={shortlisted ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
          {journey.listings.length > 12 && (
            <p className="border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              {journey.listings.length - 12} more candidate markers remain visible on the map.
            </p>
          )}
        </section>
      )}

      {selectedListing && (
        <section className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{selectedListing.title}</h2>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                {selectedListing.address || "Address not provided"}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold">
              {formatHousingPrice(selectedListing)}
            </span>
          </div>
          <p className="text-xs leading-4 text-neutral-600 dark:text-neutral-300">
            {selectedListing.provenance.note}
          </p>
          {selectedListing.sourceUrl && (
            <a
              href={selectedListing.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-emerald-800 underline dark:text-emerald-300"
            >
              Open user-provided source
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </section>
      )}

      <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold">
          <FileUp className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Import authorized listing CSV
        </summary>
        <div className="space-y-3 border-t border-neutral-200 p-3 text-xs leading-4 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
          <p>
            Use records you are authorized to use. Required columns: latitude, longitude, and
            price. Optional source values include Zillow, Trulia, Craigslist, MLS, or RESO.
          </p>
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 font-semibold text-neutral-800 hover:bg-neutral-50 focus-within:ring-2 focus-within:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900">
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                void journey.importCsv(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </details>

      <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold">
          <Info className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Listing sources and cost controls
        </summary>
        <div className="space-y-2 border-t border-neutral-200 p-3 text-xs leading-4 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
          <p>
            Live searches use one cached server request only when the RentCast connector is
            explicitly enabled. Repeated identical searches can be served from cache.
          </p>
          <p>
            Zillow and Trulia require an authorized Zillow Group, Bridge, or MLS feed.
            Craigslist automation is disabled; user-provided records remain labeled as imports.
          </p>
          <div className="flex flex-wrap gap-1">
            {(["rentcast", "zillow_group", "trulia", "craigslist", "mls_reso"] as const).map(
              (source) => (
                <Badge key={source} variant="outline">
                  {HOUSING_SOURCE_LABELS[source]}
                </Badge>
              ),
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
