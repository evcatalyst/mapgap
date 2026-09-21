import type { Feature, MultiPolygon, Polygon } from "geojson";
import { MOBILITY_MODES, ROUTING_PROVIDER_LABELS } from "../constants";
import type {
  AppSettings,
  IsochroneFeature,
  MapBounds,
  MapPoint,
  PlaceSearchResult,
  PoiCategory,
  PointOfInterest,
} from "../types";
import { debugError, debugLog } from "./debug";
import { getEffortAdjustedMinutes } from "./terrain";

type OpenCageResponse = {
  results?: Array<{
    formatted?: string;
  }>;
};

type RoutingIsochroneFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

type RoutingIsochroneResponse = {
  mapgap?: { provider: string; requestedCount: number; completedCount: number; failures: Array<{ seconds: number; message: string }> };
  features?: RoutingIsochroneFeature[];
  error?: {
    code?: number;
    message?: string;
  };
  message?: string;
};

type PoiSearchResponse = {
  points?: PointOfInterest[];
  source?: "google" | "osm";
  category?: PoiCategory;
  label?: string;
  query?: string;
  total?: number;
  truncated?: boolean;
  message?: string;
};

type PlaceSearchResponse = {
  results?: PlaceSearchResult[];
  message?: string;
};

type IsochroneBucketRequest = {
  bucketMinutes: number;
  adjustedMinutes: number;
  adjustedSeconds: number;
  requestSeconds: number;
  effortScore: number;
  slopeBurden: number;
};

const ORS_REQUEST_SPACING_MS = 650;
const VALHALLA_MAX_PARALLEL_REQUESTS = 4;

export type IsochroneRunResult = {
  features: IsochroneFeature[];
  warnings: string[];
  requestCount: number;
  completedCount: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function parseApiError(response: Response) {
  const raw = await response.text();

  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || raw || response.statusText;
  } catch {
    return raw || response.statusText;
  }
}

function getRetryAfterSeconds(response: Response) {
  const retryAfter = response.headers.get("retry-after");

  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);

  return Number.isFinite(seconds) ? seconds : undefined;
}

function buildNetworkError(provider: string, error: unknown) {
  if (error instanceof TypeError) {
    return new Error(
      `${provider} request failed before MapGap could read the response. Check that the MapGap API is running, then try again.`,
    );
  }

  return error;
}

export async function reverseGeocode(lat: number, lng: number) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });

  debugLog("Reverse geocode request", { lat, lng });

  const response = await fetch(`/api/opencage/reverse?${params}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(`OpenCage proxy ${response.status}: ${message}`);
  }

  const data = (await response.json()) as OpenCageResponse & { formatted?: string };
  return data.formatted || data.results?.[0]?.formatted;
}

function bboxParam(bounds?: MapBounds) {
  return bounds ? [bounds.south, bounds.west, bounds.north, bounds.east].join(",") : undefined;
}

export async function searchPlaces(query: string, bounds?: MapBounds) {
  const params = new URLSearchParams({
    q: query,
  });

  const bbox = bboxParam(bounds);

  if (bbox) {
    params.set("bbox", bbox);
  }

  debugLog("Place search request", { query, bounds });

  let response: Response;

  try {
    response = await fetch(`/api/place/search?${params}`, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw buildNetworkError("Place search", error);
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(`Place search ${response.status}: ${message}`);
  }

  const data = (await response.json()) as PlaceSearchResponse;

  if (!Array.isArray(data.results)) {
    throw new Error(data.message || "Place search returned no results.");
  }

  return data.results;
}

export async function fetchPoiPlacesInBounds({
  bounds,
  category,
  query,
  sort,
}: {
  bounds: MapBounds;
  category: PoiCategory;
  query?: string;
  sort?: "name" | "rating";
}) {
  const params = new URLSearchParams({
    category,
    bbox: bboxParam(bounds) || "",
  });

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (sort) {
    params.set("sort", sort);
  }

  debugLog("POI search request", { category, query, bounds });

  let response: Response;

  try {
    response = await fetch(`/api/poi/search?${params}`, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw buildNetworkError("POI search", error);
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(`POI search ${response.status}: ${message}`);
  }

  const data = (await response.json()) as PoiSearchResponse;

  if (!Array.isArray(data.points)) {
    throw new Error(data.message || "POI search returned no point data.");
  }

  const responseCategory = data.category || category;
  const normalizedPoints = data.points.map((point) => ({
    ...point,
    category: point.category || responseCategory,
  }));

  return {
    points: normalizedPoints,
    source: data.source || "osm",
    category: responseCategory,
    label: data.label || query || category,
    query: data.query || query || "",
    total: data.total ?? normalizedPoints.length,
    truncated: Boolean(data.truncated),
    message: data.message,
  };
}

export async function fetchLaundryPlacesInBounds(bounds: MapBounds) {
  return fetchPoiPlacesInBounds({ bounds, category: "laundry" });
}

function getFeatureSeconds(feature: RoutingIsochroneFeature) {
  const value = feature.properties?.value;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const contour = feature.properties?.contour;

  if (typeof contour === "number" && Number.isFinite(contour)) {
    return contour * 60;
  }

  const time = feature.properties?.time;

  if (typeof time === "number" && Number.isFinite(time)) {
    return time * 60;
  }

  return undefined;
}

function getBucketForFeature(
  feature: RoutingIsochroneFeature,
  buckets: IsochroneBucketRequest[],
  index: number,
) {
  const value = getFeatureSeconds(feature);

  if (value !== undefined) {
    const exactMatch = buckets.find(
      (bucket) => Math.abs(bucket.requestSeconds - value) <= 1,
    );

    if (exactMatch) {
      return exactMatch;
    }
  }

  return buckets[index] || buckets[buckets.length - 1];
}

export async function fetchPointIsochrones(
  point: MapPoint,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<IsochroneRunResult> {
  const mode = MOBILITY_MODES[settings.mobilityMode];
  const providerLabel = ROUTING_PROVIDER_LABELS[settings.routingProvider];
  const buckets = (settings.timeBuckets.length > 0 ? settings.timeBuckets : [settings.timeMinutes])
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .map((bucketMinutes) => {
      const { adjustedMinutes, effortScore, slopeBurden } = getEffortAdjustedMinutes(
        point,
        bucketMinutes,
        settings.mobilityMode,
      );
      const adjustedSeconds = adjustedMinutes * 60;

      return {
        bucketMinutes,
        adjustedMinutes,
        adjustedSeconds,
        requestSeconds:
          settings.routingProvider !== "ors" ? bucketMinutes * 60 : adjustedSeconds,
        effortScore,
        slopeBurden,
      };
    });

  debugLog("Isochrone request", {
    pointId: point.id,
    timeMinutes: settings.timeMinutes,
    buckets,
    mobilityMode: settings.mobilityMode,
    transportMode: settings.transportMode,
    isochroneMode: settings.isochroneMode,
    routingProvider: settings.routingProvider,
  });

  let response: Response;

  try {
    response = await fetch("/api/routing/isochrones", {
      method: "POST",
      signal,
      headers: {
        Accept: "application/json, application/geo+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: settings.routingProvider,
        ...(settings.routingProvider === "valhalla" && settings.valhallaAccessSecret.trim()
          ? { valhallaSharedSecret: settings.valhallaAccessSecret.trim() }
          : {}),
        point: {
          id: point.id,
          name: point.name,
          lat: point.lat,
          lng: point.lng,
        },
        transportMode: settings.transportMode,
        mobilityMode: settings.mobilityMode,
        ranges: buckets.map((bucket) => bucket.requestSeconds),
        buckets,
      }),
    });
  } catch (error) {
    throw buildNetworkError(providerLabel, error);
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    const retryAfterSeconds = getRetryAfterSeconds(response);

    if (response.status === 429) {
      throw new Error(
        `${providerLabel} rate limit hit. Wait${
          retryAfterSeconds ? ` about ${retryAfterSeconds} seconds` : " a minute"
        } and try again, or reduce the number of points/time buckets for this run. ${message}`,
      );
    }

    if (response.status === 403) {
      throw new Error(
        `${providerLabel} denied this isochrone request. ${message} Check the provider account/key permissions, or switch to Valhalla beta if a local graph is running.`,
      );
    }

    throw new Error(`${providerLabel} ${response.status}: ${message}`);
  }

  const data = (await response.json()) as RoutingIsochroneResponse;

  if (data.mapgap && data.mapgap.provider !== settings.routingProvider) {
    throw new Error("The API returned a different routing provider. Results were discarded.");
  }

  if (data.error?.message) {
    throw new Error(`${providerLabel}: ${data.error.message}`);
  }

  const features = data.features || [];

  if (features.length === 0) {
    throw new Error(`${providerLabel} returned no isochrone geometry.`);
  }

  const normalized = features.map((feature, index) => {
    const bucket = getBucketForFeature(feature, buckets, index);

    return {
      ...feature,
      properties: {
        ...feature.properties,
        id: `${point.id}-${bucket.bucketMinutes}-${settings.mobilityMode}-${settings.transportMode}-${settings.routingProvider}`,
        pointId: point.id,
        pointName: point.name,
        color: mode.color,
        timeMinutes: settings.timeMinutes,
        bucketMinutes: bucket.bucketMinutes,
        adjustedMinutes: settings.routingProvider === "ors" ? bucket.adjustedMinutes : bucket.bucketMinutes,
        effortScore: settings.routingProvider === "ors" ? bucket.effortScore : 0,
        mobilityMode: settings.mobilityMode,
        transportMode: settings.transportMode,
        routingProvider: settings.routingProvider,
        mock: settings.routingProvider === "synthetic" || feature.properties?.mock === true,
        ...(settings.routingProvider === "synthetic" ? { notice: "Mock isochrones — schematic reach, not network travel time." } : {}),
        isochroneMode: settings.isochroneMode,
      },
    } satisfies IsochroneFeature;
  });
  return {
    features: normalized,
    warnings: data.mapgap?.failures.map((failure) => `${point.name}: ${failure.seconds / 60} min contour unavailable. ${failure.message}`) ?? [],
    requestCount: data.mapgap?.requestedCount ?? 1,
    completedCount: data.mapgap?.completedCount ?? normalized.length,
  };
}

export async function fetchIsochrones(
  points: MapPoint[],
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<IsochroneRunResult> {
  try {
    const results = await mapWithConcurrency(
      points,
      settings.routingProvider === "ors" ? 1 : Math.min(VALHALLA_MAX_PARALLEL_REQUESTS, Math.max(1, points.length)),
      async (point, index) => {
        signal?.throwIfAborted();
        if (settings.routingProvider === "ors" && index > 0) await sleep(ORS_REQUEST_SPACING_MS);
        signal?.throwIfAborted();
        try {
          return { result: await fetchPointIsochrones(point, settings, signal) };
        } catch (error) {
          if (signal?.aborted) throw error;
          return { error: `${point.name}: ${error instanceof Error ? error.message : "Request failed."}` };
        }
      },
    );
    signal?.throwIfAborted();
    const successes = results.flatMap((result) => result.result ? [result.result] : []);
    const errors = results.flatMap((result) => result.error ? [result.error] : []);
    if (!successes.length) throw new Error(errors[0] || "No isochrone results.");
    return {
      features: successes.flatMap((result) => result.features),
      warnings: [...errors, ...successes.flatMap((result) => result.warnings)],
      requestCount: successes.reduce((sum, result) => sum + result.requestCount, 0) + errors.length * (settings.routingProvider === "synthetic" || settings.routingProvider === "google" ? Math.max(1, settings.timeBuckets.length) : 1),
      completedCount: successes.reduce((sum, result) => sum + result.completedCount, 0),
    };
  } catch (error) {
    debugError("Isochrone generation failed", error);
    throw error;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );

  return results;
}
