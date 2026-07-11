import { getConfiguredSecret } from "./_secrets.mjs";
import {
  cacheHeaders,
  getCached,
  getTtlMs,
  makeCacheKey,
  setCached,
  withCacheMetadata,
} from "./_cache.mjs";

const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.viewport,places.types";
const GOOGLE_TIMEOUT_MS = 10000;
const MAX_RESULTS = 8;
const CACHE_TTL_MS = getTtlMs("MAPGAP_PLACE_CACHE_TTL_SECONDS", 900);
const placeCache = new Map();

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function json(statusCode, payload, cacheControl = "no-store", extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
    },
    body: JSON.stringify(payload),
  };
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseBbox(raw) {
  if (typeof raw !== "string") {
    return undefined;
  }

  const [south, west, north, east] = raw.split(",").map(normalizeNumber);

  if (
    south === undefined ||
    west === undefined ||
    north === undefined ||
    east === undefined ||
    south < -90 ||
    north > 90 ||
    west < -180 ||
    east > 180 ||
    south >= north ||
    west >= east
  ) {
    return undefined;
  }

  return { south, west, north, east };
}

function normalizeViewport(viewport) {
  const low = viewport?.low;
  const high = viewport?.high;
  const south = normalizeNumber(low?.latitude);
  const west = normalizeNumber(low?.longitude);
  const north = normalizeNumber(high?.latitude);
  const east = normalizeNumber(high?.longitude);

  if (
    south === undefined ||
    west === undefined ||
    north === undefined ||
    east === undefined
  ) {
    return undefined;
  }

  return { south, west, north, east };
}

function normalizePlace(place) {
  const lat = normalizeNumber(place.location?.latitude);
  const lng = normalizeNumber(place.location?.longitude);

  if (!place.id || lat === undefined || lng === undefined) {
    return undefined;
  }

  return {
    id: `google-${place.id}`,
    source: "google",
    sourceId: `google-${place.id}`,
    name: place.displayName?.text || place.formattedAddress || "Map location",
    address: place.formattedAddress,
    lat,
    lng,
    viewport: normalizeViewport(place.viewport),
    types: Array.isArray(place.types) ? place.types : [],
  };
}

function locationBiasFromBounds(bounds) {
  if (!bounds) {
    return undefined;
  }

  return {
    rectangle: {
      low: {
        latitude: bounds.south,
        longitude: bounds.west,
      },
      high: {
        latitude: bounds.north,
        longitude: bounds.east,
      },
    },
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { message: "Use GET for place search." });
  }

  const apiKey = getConfiguredSecret("GOOGLE_PLACES_API_KEY");

  if (!apiKey) {
    return json(503, {
      message: "GOOGLE_PLACES_API_KEY is not configured for place search.",
    });
  }

  const params = event.queryStringParameters || {};
  const query = String(params.q || "").trim();

  if (query.length < 2) {
    return json(400, { message: "Enter at least two characters to search places." });
  }

  const bounds = parseBbox(params.bbox);
  const cacheKey = makeCacheKey("place-search", {
    query: query.toLowerCase(),
    bounds,
    maxResults: MAX_RESULTS,
  });
  const cached = getCached(placeCache, cacheKey);

  if (cached) {
    return json(
      200,
      withCacheMetadata(cached.value, cached.meta),
      "public, max-age=300",
      cacheHeaders(cached.meta),
    );
  }

  const body = {
    textQuery: query,
    maxResultCount: MAX_RESULTS,
    ...(bounds ? { locationBias: locationBiasFromBounds(bounds) } : {}),
  };

  try {
    const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
      method: "POST",
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return json(response.status, {
        message: `Google place search failed with status ${response.status}.`,
      });
    }

    const data = await response.json();
    const results = (Array.isArray(data.places) ? data.places : [])
      .map(normalizePlace)
      .filter(Boolean);

    const payload = {
      source: "google",
      query,
      results,
      total: results.length,
    };
    const stored = setCached(placeCache, cacheKey, payload, CACHE_TTL_MS);

    return json(
      200,
      withCacheMetadata(stored.value, stored.meta),
      "public, max-age=300",
      cacheHeaders(stored.meta),
    );
  } catch (error) {
    return json(502, {
      message:
        error instanceof Error
          ? `Place search request failed: ${error.message}`
          : "Place search request failed.",
    });
  }
}
