import type { Feature, MultiPolygon, Polygon } from "geojson";
import { MOBILITY_MODES, ROUTING_PROVIDER_LABELS } from "../constants";
import type {
  AppSettings,
  IsochroneFeature,
  MapPoint,
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
  features?: RoutingIsochroneFeature[];
  error?: {
    code?: number;
    message?: string;
  };
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

const PROVIDER_REQUEST_SPACING_MS = 650;

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
      `${provider} request failed before MapGap could read the response. Run Netlify Dev locally so the API proxy is active, then try again.`,
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
) {
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
          settings.routingProvider === "valhalla" ? bucketMinutes * 60 : adjustedSeconds,
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

  if (data.error?.message) {
    throw new Error(`${providerLabel}: ${data.error.message}`);
  }

  const features = data.features || [];

  if (features.length === 0) {
    throw new Error(`${providerLabel} returned no isochrone geometry.`);
  }

  return features.map((feature, index) => {
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
        adjustedMinutes: bucket.adjustedMinutes,
        effortScore: bucket.effortScore,
        mobilityMode: settings.mobilityMode,
        transportMode: settings.transportMode,
        routingProvider: settings.routingProvider,
        isochroneMode: settings.isochroneMode,
      },
    } satisfies IsochroneFeature;
  });
}

export async function fetchIsochrones(
  points: MapPoint[],
  settings: AppSettings,
) {
  try {
    const features: IsochroneFeature[][] = [];

    for (const [index, point] of points.entries()) {
      if (index > 0) {
        await sleep(PROVIDER_REQUEST_SPACING_MS);
      }

      features.push(await fetchPointIsochrones(point, settings));
    }

    return features.flat();
  } catch (error) {
    debugError("Isochrone generation failed", error);
    throw error;
  }
}
