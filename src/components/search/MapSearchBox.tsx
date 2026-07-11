import { Loader2, LocateFixed, MapPinPlus, Search } from "lucide-react";
import { FormEvent, useId, useState } from "react";
import toast from "react-hot-toast";
import { searchPlaces } from "../../lib/api";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { PlaceSearchResult } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type MapSearchBoxProps = {
  compact?: boolean;
  dense?: boolean;
  label?: string;
};

export function MapSearchBox({
  compact = false,
  dense = false,
  label = "Search place or address",
}: MapSearchBoxProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const mapBounds = useMapIsoStore((state) => state.mapBounds);
  const selectedPlace = useMapIsoStore((state) => state.selectedPlace);
  const setSelectedPlace = useMapIsoStore((state) => state.setSelectedPlace);
  const setMapJumpTarget = useMapIsoStore((state) => state.setMapJumpTarget);
  const addPoint = useMapIsoStore((state) => state.addPoint);

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      toast.error("Enter a place or address to search.");
      return;
    }

    setIsSearching(true);

    try {
      const nextResults = await searchPlaces(trimmed, mapBounds);
      setResults(nextResults);

      if (nextResults.length === 0) {
        toast("No places found. Try a more specific search.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Place search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (result: PlaceSearchResult) => {
    setSelectedPlace(result);
    setMapJumpTarget({
      id: result.id,
      label: result.name,
      lat: result.lat,
      lng: result.lng,
      bounds: result.viewport,
      zoom: result.viewport ? 14 : 13,
    });
    setQuery(result.name);
    setResults([]);
    toast.success(`Jumped to ${result.name}.`);
  };

  const addSelectedPlace = () => {
    if (!selectedPlace) {
      toast.error("Search and select a place first.");
      return;
    }

    addPoint(selectedPlace, {
      name: selectedPlace.name,
      address: selectedPlace.address,
    });
    toast.success(`${selectedPlace.name} added as a location.`);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <form
        className={compact ? "grid gap-2" : "flex min-w-0 items-center gap-2"}
        onSubmit={runSearch}
      >
        <label className="sr-only" htmlFor={inputId}>
          {label}
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <Input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search town, address, or anchor"
            className={dense ? "h-9 bg-white/90 pl-9 dark:bg-neutral-950/90" : "pl-9"}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          size={dense ? "sm" : "md"}
          className={dense ? "h-9 shrink-0 px-3" : undefined}
          disabled={isSearching}
          title="Search place or address"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
          )}
          <span className={dense ? "hidden 2xl:inline" : undefined}>Search</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size={dense ? "sm" : "md"}
          className={dense ? "h-9 shrink-0 px-3" : undefined}
          onClick={addSelectedPlace}
          disabled={!selectedPlace}
          title="Add selected place as an anchor"
        >
          <MapPinPlus className="h-4 w-4" aria-hidden="true" />
          <span className={dense ? "hidden 2xl:inline" : undefined}>Anchor</span>
        </Button>
      </form>

      {selectedPlace && results.length === 0 && !dense && (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="success" className="h-auto max-w-full whitespace-normal py-1">
            Viewing {selectedPlace.name}
          </Badge>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Add POIs to search this map view.
          </span>
        </div>
      )}

      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[800] max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none dark:hover:bg-neutral-900 dark:focus:bg-neutral-900"
              onClick={() => selectResult(result)}
            >
              <span className="block font-medium text-neutral-950 dark:text-white">
                {result.name}
              </span>
              {result.address && (
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {result.address}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
