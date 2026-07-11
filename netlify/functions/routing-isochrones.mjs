import { getConfiguredSecret } from "./_secrets.mjs";
import { timingSafeEqual } from "crypto";
import {
  cacheHeaders,
  getCached,
  getTtlMs,
  makeCacheKey,
  setCached,
  withCacheMetadata,
} from "./_cache.mjs";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const ORS_ISOCHRONE_SMOOTHING = 85;
const VALHALLA_MAX_CONTOURS_PER_REQUEST = 4;
const VALHALLA_SECRET_HEADER = "X-Valhalla-Shared-Secret";
const DEFAULT_VALHALLA_COVERAGE_REGION = "capital-region";
const DEFAULT_VALHALLA_COVERAGE_BBOX = "-74.50,42.35,-73.25,43.25";
const ROUTING_CACHE_TTL_MS = getTtlMs("MAPGAP_ROUTING_CACHE_TTL_SECONDS", 1800);
const routingCache = new Map();
const BUILTIN_VALHALLA_COVERAGE = {
  "capital-region": {
    label: "Capital Region Valhalla graph",
    bboxes: [{ west: -74.5, south: 42.35, east: -73.25, north: 43.25 }],
  },
  "ny-nj": {
    label: "New York + New Jersey Valhalla graph",
    bboxes: [
      { west: -75.62, south: 38.88, east: -73.85, north: 41.42 },
      { west: -74.35, south: 40.45, east: -71.75, north: 41.35 },
      { west: -74.9, south: 40.9, east: -73.15, north: 42.45 },
      { west: -75.15, south: 42.1, east: -73.0, north: 43.75 },
      { west: -76.25, south: 43.0, east: -73.0, north: 45.15 },
      { west: -79.85, south: 42.0, east: -75.0, north: 43.75 },
      { west: -79.85, south: 41.75, east: -74.0, north: 42.6 },
    ],
  },
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ORS_PROFILES = new Set(["driving-car", "cycling-regular", "foot-walking"]);

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function logRoutingEvent(event, details) {
  console.info(
    JSON.stringify({
      event: `mapgap.routing.${event}`,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

function decodeBody(event) {
  const raw = event.body || "{}";
  return event.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;
}

function parsePayload(event) {
  try {
    return JSON.parse(decodeBody(event));
  } catch {
    return undefined;
  }
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizePoint(point) {
  const lat = normalizeNumber(point?.lat);
  const lng = normalizeNumber(point?.lng);

  if (lat === undefined || lng === undefined || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined;
  }

  return { lat, lng };
}

function parseBbox(value) {
  if (!value) {
    return undefined;
  }

  const [west, south, east, north] = value.split(",").map(normalizeNumber);

  if (
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined ||
    west >= east ||
    south >= north
  ) {
    return undefined;
  }

  return { west, south, east, north };
}

function parseBboxes(value) {
  if (!value) {
    return [];
  }

  return value
    .split(";")
    .map((entry) => parseBbox(entry.trim()))
    .filter(Boolean);
}

function getCoverageProfile() {
  const region =
    process.env.VALHALLA_COVERAGE_REGION?.trim().toLowerCase() ||
    DEFAULT_VALHALLA_COVERAGE_REGION;

  return BUILTIN_VALHALLA_COVERAGE[region] || BUILTIN_VALHALLA_COVERAGE[DEFAULT_VALHALLA_COVERAGE_REGION];
}

function getValhallaCoverageBboxes() {
  const explicitBboxes = parseBboxes(process.env.VALHALLA_COVERAGE_BBOXES);

  if (explicitBboxes.length > 0) {
    return explicitBboxes;
  }

  const legacyBbox = parseBbox(process.env.VALHALLA_COVERAGE_BBOX);

  if (legacyBbox) {
    return [legacyBbox];
  }

  return getCoverageProfile().bboxes || [parseBbox(DEFAULT_VALHALLA_COVERAGE_BBOX)].filter(Boolean);
}

function getCoverageLabel() {
  return process.env.VALHALLA_COVERAGE_LABEL?.trim() || getCoverageProfile().label;
}

function pointInBbox(point, bbox) {
  return (
    point.lng >= bbox.west &&
    point.lng <= bbox.east &&
    point.lat >= bbox.south &&
    point.lat <= bbox.north
  );
}

function validateValhallaCoverage(point) {
  const bboxes = getValhallaCoverageBboxes();

  if (bboxes.length === 0 || bboxes.some((bbox) => pointInBbox(point, bbox))) {
    return undefined;
  }

  return json(422, {
    message: `${getCoverageLabel()} does not cover this location. Heatmap routing is disabled here until ORS is configured or a wider Valhalla graph is deployed.`,
    code: "VALHALLA_OUT_OF_COVERAGE",
    coverage: {
      provider: "valhalla",
      label: getCoverageLabel(),
      bbox: bboxes[0],
      bboxes,
    },
  });
}

function normalizeRanges(ranges) {
  if (!Array.isArray(ranges)) {
    return [];
  }

  return ranges
    .map(normalizeNumber)
    .filter((value) => value !== undefined && value > 0 && value <= 14400)
    .sort((a, b) => a - b);
}

function forwardHeaders(response) {
  const headers = {
    ...corsHeaders,
    "Content-Type": response.headers.get("content-type") || "application/json",
    "Cache-Control": "no-store",
  };
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    headers["Retry-After"] = retryAfter;
  }

  return headers;
}

async function proxyOpenRouteService(payload, point, ranges, event) {
  const apiKey = getConfiguredSecret("OPENROUTE_SERVICE_API_KEY");
  const profile = payload.transportMode;

  if (!apiKey) {
    return json(503, {
      message: "OPENROUTE_SERVICE_API_KEY is not configured in Netlify.",
    });
  }

  if (!ORS_PROFILES.has(profile)) {
    return json(400, { message: "Unsupported OpenRouteService transport mode." });
  }

  const response = await fetch(`${ORS_BASE_URL}/v2/isochrones/${profile}`, {
    method: "POST",
    headers: {
      Accept: event.headers.accept || "application/json, application/geo+json",
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locations: [[point.lng, point.lat]],
      range: ranges,
      range_type: "time",
      location_type: "start",
      attributes: ["area", "reachfactor"],
      smoothing: ORS_ISOCHRONE_SMOOTHING,
    }),
  });

  return {
    statusCode: response.status,
    headers: forwardHeaders(response),
    body: await response.text(),
  };
}

function getValhallaCosting(payload) {
  const mobilityMode = payload.mobilityMode;

  if (payload.transportMode === "driving-car") {
    return {
      costing: "auto",
      costing_options: {},
    };
  }

  if (payload.transportMode === "cycling-regular" || mobilityMode === "bike") {
    return {
      costing: "bicycle",
      costing_options: {
        bicycle: {
          use_hills: 0.55,
        },
      },
    };
  }

  if (mobilityMode === "senior") {
    return {
      costing: "pedestrian",
      costing_options: {
        pedestrian: {
          walking_speed: 3.4,
          use_hills: 0.1,
        },
      },
    };
  }

  if (mobilityMode === "stroller") {
    return {
      costing: "pedestrian",
      costing_options: {
        pedestrian: {
          walking_speed: 3.8,
          use_hills: 0.05,
        },
      },
    };
  }

  return {
    costing: "pedestrian",
    costing_options: {
      pedestrian: {
        walking_speed: 5.1,
        use_hills: 0.45,
      },
    },
  };
}

function buildRoutingCacheKey(payload, point, ranges) {
  return makeCacheKey("routing-isochrones", {
    provider: payload.provider,
    point: {
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
    },
    ranges,
    transportMode: payload.transportMode,
    mobilityMode: payload.mobilityMode,
    valhallaBaseUrl: payload.provider === "valhalla" ? normalizeValhallaBaseUrl() : undefined,
    valhallaCoverage: payload.provider === "valhalla" ? getCoverageLabel() : undefined,
    orsSmoothing: payload.provider === "ors" ? ORS_ISOCHRONE_SMOOTHING : undefined,
  });
}

function normalizeValhallaBaseUrl() {
  return process.env.VALHALLA_BASE_URL?.trim().replace(/\/+$/, "");
}

function getPayloadValhallaSecret(payload) {
  return typeof payload.valhallaSharedSecret === "string"
    ? payload.valhallaSharedSecret.trim()
    : "";
}

function secretsMatch(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function requiresClientValhallaSecret() {
  return (
    Boolean(getConfiguredSecret("VALHALLA_SHARED_SECRET")) &&
    process.env.VALHALLA_REQUIRE_CLIENT_SECRET?.trim().toLowerCase() === "true"
  );
}

function authorizeValhalla(payload) {
  const expectedSecret = getConfiguredSecret("VALHALLA_SHARED_SECRET");

  if (!expectedSecret || !requiresClientValhallaSecret()) {
    return undefined;
  }

  const actualSecret = getPayloadValhallaSecret(payload);

  if (!actualSecret) {
    return json(401, {
      message: "Enter Valhalla access secret.",
    });
  }

  if (!secretsMatch(expectedSecret, actualSecret)) {
    return json(403, {
      message: "Valhalla access secret is incorrect.",
    });
  }

  return undefined;
}

function getValhallaProxyHeaders(event) {
  const sharedSecret = getConfiguredSecret("VALHALLA_SHARED_SECRET");
  const headers = {
    Accept: event.headers.accept || "application/json, application/geo+json",
    "Content-Type": "application/json",
  };

  if (sharedSecret) {
    headers[VALHALLA_SECRET_HEADER] = sharedSecret;
  }

  return headers;
}

function chunkArray(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function fetchValhallaIsochroneChunk(baseUrl, event, point, costing, costing_options, contours) {
  return fetch(`${baseUrl}/isochrone`, {
    method: "POST",
    headers: getValhallaProxyHeaders(event),
    body: JSON.stringify({
      locations: [
        {
          lat: point.lat,
          lon: point.lng,
          radius: 1200,
          minimum_reachability: 20,
        },
      ],
      costing,
      costing_options,
      contours,
      polygons: true,
      denoise: 0.2,
      generalize: 12,
      show_locations: false,
    }),
  });
}

async function proxyValhalla(payload, point, ranges, event) {
  const authResponse = authorizeValhalla(payload);

  if (authResponse) {
    return authResponse;
  }

  const coverageResponse = validateValhallaCoverage(point);

  if (coverageResponse) {
    return coverageResponse;
  }

  const baseUrl = normalizeValhallaBaseUrl();

  if (!baseUrl) {
    return json(503, {
      message: "VALHALLA_BASE_URL is not configured. Start local Valhalla or switch to ORS.",
    });
  }

  const { costing, costing_options } = getValhallaCosting(payload);
  const contours = ranges.map((seconds) => ({
    time: Math.max(1, Math.round(seconds / 60)),
  }));
  const contourChunks = chunkArray(contours, VALHALLA_MAX_CONTOURS_PER_REQUEST);
  const featureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  let responseHeaders;

  for (const contourChunk of contourChunks) {
    const response = await fetchValhallaIsochroneChunk(
      baseUrl,
      event,
      point,
      costing,
      costing_options,
      contourChunk,
    );

    responseHeaders = forwardHeaders(response);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: await response.text(),
      };
    }

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return json(502, {
        message: "Valhalla returned a non-JSON isochrone response.",
      });
    }

    if (Array.isArray(data.features)) {
      featureCollection.features.push(...data.features);
    }
  }

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      ...(responseHeaders || {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(featureCollection),
  };
}

export async function handler(event) {
  const requestStartedAt = Date.now();

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "Routing proxy only accepts POST requests." });
  }

  const payload = parsePayload(event);

  if (!payload) {
    return json(400, { message: "Routing request body must be valid JSON." });
  }

  const provider = payload.provider;
  const point = normalizePoint(payload.point);
  const ranges = normalizeRanges(payload.ranges);

  if (provider !== "ors" && provider !== "valhalla") {
    return json(400, { message: "Routing request requires provider 'ors' or 'valhalla'." });
  }

  if (!point) {
    return json(400, { message: "Routing request requires a valid point with lat/lng." });
  }

  if (ranges.length === 0) {
    return json(400, { message: "Routing request requires at least one positive time range." });
  }

  try {
    const cacheKey = buildRoutingCacheKey(payload, point, ranges);
    const cached = getCached(routingCache, cacheKey);

    if (cached) {
      logRoutingEvent("completed", {
        provider,
        cacheHit: true,
        contourCount: ranges.length,
        featureCount: cached.value.features?.length || 0,
        durationMs: Date.now() - requestStartedAt,
        statusCode: 200,
      });
      return json(
        200,
        withCacheMetadata(cached.value, cached.meta),
        cacheHeaders(cached.meta),
      );
    }

    const response = provider === "valhalla"
      ? await proxyValhalla(payload, point, ranges, event)
      : await proxyOpenRouteService(payload, point, ranges, event);

    if (response.statusCode !== 200) {
      logRoutingEvent("failed", {
        provider,
        cacheHit: false,
        contourCount: ranges.length,
        durationMs: Date.now() - requestStartedAt,
        statusCode: response.statusCode,
      });
      return response;
    }

    let payloadJson;

    try {
      payloadJson = JSON.parse(response.body);
    } catch {
      return response;
    }

    const stored = setCached(routingCache, cacheKey, payloadJson, ROUTING_CACHE_TTL_MS);

    logRoutingEvent("completed", {
      provider,
      cacheHit: false,
      contourCount: ranges.length,
      featureCount: payloadJson.features?.length || 0,
      durationMs: Date.now() - requestStartedAt,
      statusCode: 200,
    });

    return {
      ...response,
      headers: {
        ...response.headers,
        ...cacheHeaders(stored.meta),
      },
      body: JSON.stringify(withCacheMetadata(stored.value, stored.meta)),
    };
  } catch (error) {
    console.error("Routing provider request failed", error);
    logRoutingEvent("failed", {
      provider,
      cacheHit: false,
      contourCount: ranges.length,
      failureCategory: error instanceof Error ? error.name : "unknown_error",
      durationMs: Date.now() - requestStartedAt,
      statusCode: 502,
    });
    return json(502, {
      message: "Routing provider request failed. Try again in a moment.",
    });
  }
}
