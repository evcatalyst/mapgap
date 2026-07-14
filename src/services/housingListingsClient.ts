import type {
  HousingListingResponse,
  HousingSearchFilters,
} from "../domain/housing";
import type { MapBounds } from "../types";

function bboxParam(bounds: MapBounds) {
  return [bounds.west, bounds.south, bounds.east, bounds.north].join(",");
}

async function parseApiError(response: Response) {
  const raw = await response.text();

  try {
    const data = JSON.parse(raw) as { message?: string };
    return data.message || raw || response.statusText;
  } catch {
    return raw || response.statusText;
  }
}

export async function fetchHousingListings({
  bounds,
  filters,
  source = "auto",
}: {
  bounds: MapBounds;
  filters: HousingSearchFilters;
  source?: "auto" | "demo" | "rentcast";
}) {
  const params = new URLSearchParams({
    bbox: bboxParam(bounds),
    tenure: filters.tenure,
    source,
    limit: "24",
  });

  if (filters.maxPrice !== undefined) {
    params.set("maxPrice", String(filters.maxPrice));
  }

  if (filters.minBedrooms !== undefined) {
    params.set("minBedrooms", String(filters.minBedrooms));
  }

  let response: Response;

  try {
    response = await fetch(`/api/housing/listings?${params}`, {
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Housing search needs the MapGap API proxy. Run Netlify Dev or use the configured API proxy.",
      );
    }
    throw error;
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(`Housing search ${response.status}: ${message}`);
  }

  const data = (await response.json()) as HousingListingResponse;
  if (!Array.isArray(data.listings)) {
    throw new Error("Housing search returned no listing data.");
  }

  return data;
}
