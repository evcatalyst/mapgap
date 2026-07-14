import {
  cacheHeaders,
  getCached,
  getTtlMs,
  makeCacheKey,
  setCached,
  withCacheMetadata,
} from "./_cache.mjs";
import { getConfiguredSecret } from "./_secrets.mjs";

const RENTCAST_BASE_URL = "https://api.rentcast.io/v1/listings";
const MAX_RESULTS = 40;
const REQUEST_TIMEOUT_MS = 9000;
const cache = new Map();
const ttlMs = getTtlMs("HOUSING_LISTINGS_CACHE_TTL_SECONDS", 900);

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function json(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      ...headers,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

function liveProviderEnabled() {
  return process.env.HOUSING_LIVE_PROVIDER_ENABLED?.trim().toLowerCase() === "true";
}

function parseBbox(value) {
  const values = String(value || "")
    .split(",")
    .map((item) => Number(item));

  if (values.length !== 4 || values.some((item) => !Number.isFinite(item))) {
    return undefined;
  }

  const [west, south, east, north] = values;

  if (
    west < -180 ||
    west > 180 ||
    east < -180 ||
    east > 180 ||
    south < -90 ||
    south > 90 ||
    north < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    return undefined;
  }

  return { west, south, east, north };
}

function parseOptionalNumber(value, { min, max }) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.min(max, Math.max(min, number));
}

function bboxArray(bounds) {
  return [bounds.west, bounds.south, bounds.east, bounds.north];
}

function queryFromParams(params, bounds) {
  const tenure = params.tenure === "sale" ? "sale" : "rent";
  const maxPrice = parseOptionalNumber(params.maxPrice, { min: 100, max: 100_000_000 });
  const minBedrooms = parseOptionalNumber(params.minBedrooms, { min: 0, max: 20 });
  const limit = Math.round(
    parseOptionalNumber(params.limit, { min: 1, max: MAX_RESULTS }) || 24,
  );
  const requestedSource = ["auto", "demo", "rentcast"].includes(params.source)
    ? params.source
    : "auto";

  return {
    bbox: bboxArray(bounds),
    tenure,
    maxPrice,
    minBedrooms,
    limit,
    requestedSource,
  };
}

function inBounds(latitude, longitude, bounds) {
  return (
    latitude >= bounds.south &&
    latitude <= bounds.north &&
    longitude >= bounds.west &&
    longitude <= bounds.east
  );
}

function normalizeRentCastListing(record, tenure, bounds) {
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  const price = Number(record.price);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !inBounds(lat, lng, bounds)
  ) {
    return undefined;
  }

  const address = text(record.formattedAddress);
  const propertyType = text(record.propertyType);
  const bedrooms = finiteNumber(record.bedrooms);
  const title =
    text(record.addressLine1) ||
    address ||
    [bedrooms !== undefined ? `${bedrooms} bedroom` : undefined, propertyType, "home"]
      .filter(Boolean)
      .join(" ");

  return {
    id: `rentcast-${String(record.id || `${lat}-${lng}`).replace(/[^a-zA-Z0-9_-]+/g, "-")}`,
    title,
    address,
    location: { lat, lng },
    tenure,
    price,
    bedrooms,
    bathrooms: finiteNumber(record.bathrooms),
    squareFeet: finiteNumber(record.squareFootage),
    propertyType,
    status: text(record.status),
    listedAt: validDate(record.listedDate),
    lastSeenAt: validDate(record.lastSeenDate),
    source: "rentcast",
    sourceLabel: "RentCast",
    providerListingId: text(record.id),
    confidence: "high",
    provenance: {
      access: "live-api",
      label: "Configured RentCast API",
      note: "Listing availability and terms must be verified with the listing contact.",
      observedAt: validDate(record.lastSeenDate) || new Date().toISOString(),
    },
  };
}

async function fetchRentCastListings(query, bounds, apiKey) {
  const center = {
    lat: (bounds.south + bounds.north) / 2,
    lng: (bounds.west + bounds.east) / 2,
  };
  const radius = Math.min(100, Math.max(1, farthestCornerMiles(center, bounds)));
  const path = query.tenure === "sale" ? "sale" : "rental/long-term";
  const url = new URL(`${RENTCAST_BASE_URL}/${path}`);

  url.searchParams.set("latitude", center.lat.toFixed(6));
  url.searchParams.set("longitude", center.lng.toFixed(6));
  url.searchParams.set("radius", radius.toFixed(2));
  url.searchParams.set("status", "Active");
  url.searchParams.set("limit", String(query.limit));

  if (query.maxPrice !== undefined) {
    url.searchParams.set("price", `*:${Math.round(query.maxPrice)}`);
  }

  if (query.minBedrooms !== undefined) {
    url.searchParams.set("bedrooms", `${Math.round(query.minBedrooms)}:*`);
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`RentCast ${response.status}: ${message.slice(0, 240)}`);
  }

  const records = await response.json();
  if (!Array.isArray(records)) {
    throw new Error("RentCast returned an unexpected listing payload.");
  }

  return records
    .map((record) => normalizeRentCastListing(record, query.tenure, bounds))
    .filter(Boolean)
    .slice(0, query.limit);
}

function makeIllustrativeListings(query, bounds) {
  const positions = [
    [0.24, 0.28],
    [0.35, 0.67],
    [0.47, 0.42],
    [0.57, 0.75],
    [0.66, 0.22],
    [0.76, 0.55],
    [0.3, 0.84],
    [0.82, 0.38],
  ];
  const propertyTypes = ["Apartment", "Multi-Family", "Condo", "Townhouse"];
  const fallbackPrice = query.tenure === "rent" ? 1_650 : 285_000;
  const targetPrice = query.maxPrice
    ? Math.max(query.tenure === "rent" ? 550 : 45_000, query.maxPrice * 0.72)
    : fallbackPrice;
  const minBedrooms = Math.round(query.minBedrooms || 0);

  return positions
    .slice(0, query.limit)
    .map(([latRatio, lngRatio], index) => {
      const bedrooms = Math.max(minBedrooms, index % 4);
      const priceStep = query.tenure === "rent" ? 105 : 12_500;
      const price = Math.round(targetPrice + index * priceStep);

      return {
        id: `illustrative-${query.tenure}-${index + 1}`,
        title: `Illustrative ${bedrooms === 0 ? "studio" : `${bedrooms}-bedroom`} ${
          query.tenure === "rent" ? "rental" : "home"
        }`,
        address: "Example location in the current map view",
        location: {
          lat: bounds.south + (bounds.north - bounds.south) * latRatio,
          lng: bounds.west + (bounds.east - bounds.west) * lngRatio,
        },
        tenure: query.tenure,
        price,
        bedrooms,
        bathrooms: bedrooms <= 1 ? 1 : Math.min(3, bedrooms - 0.5),
        squareFeet: 520 + bedrooms * 310 + index * 35,
        propertyType: propertyTypes[index % propertyTypes.length],
        status: "Illustrative only",
        source: "illustrative",
        sourceLabel: "Illustrative example",
        confidence: "low",
        provenance: {
          access: "illustrative",
          label: "MapGap example data",
          note: "Not a real or available property. Use only to evaluate the relocation workflow.",
          observedAt: new Date().toISOString(),
        },
      };
    })
    .filter((listing) => query.maxPrice === undefined || listing.price <= query.maxPrice);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function validDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function farthestCornerMiles(center, bounds) {
  return Math.max(
    haversineMiles(center.lat, center.lng, bounds.south, bounds.west),
    haversineMiles(center.lat, center.lng, bounds.south, bounds.east),
    haversineMiles(center.lat, center.lng, bounds.north, bounds.west),
    haversineMiles(center.lat, center.lng, bounds.north, bounds.east),
  );
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const radians = (value) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildPayload({ listings, mode, query, liveConfigured, warnings = [] }) {
  return {
    count: listings.length,
    listings,
    mode,
    sources: Array.from(new Set(listings.map((listing) => listing.source))),
    warnings,
    liveProviderConfigured: liveConfigured,
    query: {
      bbox: query.bbox,
      tenure: query.tenure,
      maxPrice: query.maxPrice,
      minBedrooms: query.minBedrooms,
    },
  };
}

function logEvent(event, details) {
  console.info(
    JSON.stringify({
      event: `mapgap.housing_listings.${event}`,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "GET") {
    return json(405, { message: "Method not allowed." });
  }

  const startedAt = Date.now();
  const params = event.queryStringParameters || {};
  const bounds = parseBbox(params.bbox);

  if (!bounds) {
    return json(400, {
      message: "Provide bbox as minLng,minLat,maxLng,maxLat inside valid ranges.",
    });
  }

  const query = queryFromParams(params, bounds);
  const apiKey = getConfiguredSecret("RENTCAST_API_KEY");
  const liveConfigured = Boolean(apiKey) && liveProviderEnabled();
  const cacheKey = makeCacheKey("housing-listings", {
    ...query,
    bbox: query.bbox.map((value) => Number(value.toFixed(4))),
    liveConfigured,
  });
  const cached = getCached(cache, cacheKey);

  if (cached) {
    logEvent("completed", {
      cacheHit: true,
      count: cached.value.count,
      mode: cached.value.mode,
      durationMs: Date.now() - startedAt,
    });
    return json(200, withCacheMetadata(cached.value, cached.meta), cacheHeaders(cached.meta));
  }

  if (query.requestedSource === "rentcast" && !liveConfigured) {
    return json(503, {
      message:
        "Live housing search is disabled. Configure RENTCAST_API_KEY and set HOUSING_LIVE_PROVIDER_ENABLED=true.",
    });
  }

  let payload;

  if (query.requestedSource === "demo" || !liveConfigured) {
    payload = buildPayload({
      listings: makeIllustrativeListings(query, bounds),
      mode: "illustrative",
      query,
      liveConfigured,
      warnings: [
        "No live housing feed is enabled. These are illustrative records, not available homes.",
      ],
    });
  } else {
    try {
      const listings = await fetchRentCastListings(query, bounds, apiKey);
      payload = buildPayload({
        listings,
        mode: "live",
        query,
        liveConfigured,
        warnings:
          listings.length === 0
            ? ["No active listings matched this map view and filter set."]
            : [],
      });
    } catch (error) {
      logEvent("provider_failed", {
        provider: "rentcast",
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message.slice(0, 240) : "Unknown provider error",
      });
      payload = buildPayload({
        listings: makeIllustrativeListings(query, bounds),
        mode: "illustrative",
        query,
        liveConfigured,
        warnings: [
          "Live housing search is temporarily unavailable. Showing clearly labeled examples instead.",
        ],
      });
    }
  }

  const stored = setCached(cache, cacheKey, payload, ttlMs);
  logEvent("completed", {
    cacheHit: false,
    count: payload.count,
    mode: payload.mode,
    durationMs: Date.now() - startedAt,
  });

  return json(200, withCacheMetadata(payload, stored.meta), cacheHeaders(stored.meta));
}
