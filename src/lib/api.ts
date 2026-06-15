import { MOBILITY_MODES } from "../constants";
import type { Feature, MultiPolygon, Polygon } from "geojson";
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

type OpenRouteIsochroneFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

type OpenRouteIsochroneResponse = {
  features?: OpenRouteIsochroneFeature[];
  error?: {
    code?: number;
    message?: string;
  };
};

type IsochroneBucketRequest = {
  bucketMinutes: number;
  adjustedMinutes: number;
  adjustedSeconds: number;
  effortScore: number;
  slopeBurden: number;
};

const ORS_ISOCHRONE_SMOOTHING = 85;
const ORS_REQUEST_SPACING_MS = 650;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getOpenRouteServiceIsochroneUrl(profile: string) {
  return `/api/openrouteservice/v2/isochrones/${profile}`;
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

function getFeatureValue(feature: OpenRouteIsochroneFeature) {
  const value = feature.properties?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBucketForFeature(
  feature: OpenRouteIsochroneFeature,
  buckets: IsochroneBucketRequest[],
  index: number,
) {
  const value = getFeatureValue(feature);

  if (value !== undefined) {
    const exactMatch = buckets.find((bucket) => bucket.adjustedSeconds === value);

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
  const buckets = (settings.timeBuckets.length > 0 ? settings.timeBuckets : [settings.timeMinutes])
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .map((bucketMinutes) => {
      const { adjustedMinutes, effortScore, slopeBurden } = getEffortAdjustedMinutes(
        point,
        bucketMinutes,
        settings.mobilityMode,
      );

      return {
        bucketMinutes,
        adjustedMinutes,
        adjustedSeconds: adjustedMinutes * 60,
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
  });

  let response: Response;

  try {
    response = await fetch(getOpenRouteServiceIsochroneUrl(settings.transportMode), {
      method: "POST",
      headers: {
        Accept: "application/json, application/geo+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locations: [[point.lng, point.lat]],
        range: buckets.map((bucket) => bucket.adjustedSeconds),
        range_type: "time",
        location_type: "start",
        attributes: ["area", "reachfactor"],
        smoothing: ORS_ISOCHRONE_SMOOTHING,
      }),
    });
  } catch (error) {
    throw buildNetworkError("OpenRouteService", error);
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    const retryAfterSeconds = getRetryAfterSeconds(response);

    if (response.status === 429) {
      throw new Error(
        `OpenRouteService rate limit hit. Wait${
          retryAfterSeconds ? ` about ${retryAfterSeconds} seconds` : " a minute"
        } and try again, or reduce the number of points/time buckets for this run. ${message}`,
      );
    }

    throw new Error(`OpenRouteService ${response.status}: ${message}`);
  }

  const data = (await response.json()) as OpenRouteIsochroneResponse;

  if (data.error?.message) {
    throw new Error(`OpenRouteService: ${data.error.message}`);
  }

  const features = data.features || [];

  if (features.length === 0) {
    throw new Error("OpenRouteService returned no isochrone geometry.");
  }

  return features.map((feature, index) => {
    const bucket = getBucketForFeature(feature, buckets, index);

    return {
      ...feature,
      properties: {
        ...feature.properties,
        id: `${point.id}-${bucket.bucketMinutes}-${settings.mobilityMode}-${settings.transportMode}`,
        pointId: point.id,
        pointName: point.name,
        color: mode.color,
        timeMinutes: settings.timeMinutes,
        bucketMinutes: bucket.bucketMinutes,
        adjustedMinutes: bucket.adjustedMinutes,
        effortScore: bucket.effortScore,
        mobilityMode: settings.mobilityMode,
        transportMode: settings.transportMode,
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
        await sleep(ORS_REQUEST_SPACING_MS);
      }

      features.push(await fetchPointIsochrones(point, settings));
    }

    return features.flat();
  } catch (error) {
    debugError("Isochrone generation failed", error);
    throw error;
  }
}
