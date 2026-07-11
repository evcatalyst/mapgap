import { getConfiguredSecret } from "./_secrets.mjs";
import {
  cacheHeaders,
  getCached,
  getTtlMs,
  makeCacheKey,
  setCached,
  withCacheMetadata,
} from "./_cache.mjs";

const GOOGLE_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const GOOGLE_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount";
const OVERPASS_URL =
  process.env.OVERPASS_API_URL?.trim() || "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 15000;
const OVERPASS_ATTEMPTS = 2;
const GOOGLE_PLACES_TIMEOUT_MS = 10000;
const MAX_LATITUDE_SPAN = 1.5;
const MAX_LONGITUDE_SPAN = 1.5;
const MAX_RESULTS = 80;
const CACHE_TTL_MS = getTtlMs("MAPGAP_POI_CACHE_TTL_SECONDS", 900);
const poiCache = new Map();

const SUPPORTED_CATEGORIES = new Set([
  "grocery",
  "bookstore",
  "laundry",
  "coffee",
  "restaurant",
  "farmers-market",
  "butcher",
  "fresh-produce",
  "hospital",
  "school",
  "library",
  "pharmacy",
  "park",
  "transit",
  "custom",
]);

const CATEGORY_LABELS = {
  grocery: "Grocery stores",
  bookstore: "Bookstores",
  laundry: "Laundromats",
  coffee: "Coffee",
  restaurant: "Restaurants",
  "farmers-market": "Farmers markets",
  butcher: "Butchers",
  "fresh-produce": "Fresh produce",
  hospital: "Hospitals",
  school: "Schools",
  library: "Libraries",
  pharmacy: "Pharmacies",
  park: "Parks",
  transit: "Transit stops",
  custom: "Custom places",
};

const GOOGLE_NEARBY_TYPES = {
  grocery: ["grocery_store", "supermarket"],
  bookstore: ["book_store"],
  laundry: ["laundry"],
  coffee: ["cafe", "coffee_shop"],
  restaurant: ["restaurant"],
  hospital: ["hospital"],
  school: ["school"],
  library: ["library"],
  pharmacy: ["pharmacy"],
  park: ["park"],
  transit: ["transit_station"],
};

const CATEGORY_TEXT_QUERY = {
  grocery: "grocery stores",
  bookstore: "bookstores",
  laundry: "self-service laundromats",
  coffee: "coffee shops",
  restaurant: "restaurants",
  "farmers-market": "farmers markets",
  butcher: "butchers meat markets",
  "fresh-produce": "specialty produce markets organic grocery",
  hospital: "hospitals",
  school: "schools",
  library: "libraries",
  pharmacy: "pharmacies",
  park: "parks",
  transit: "transit stations",
  custom: "places",
};

const OVERPASS_CLAUSES = {
  grocery: [
    'node["shop"~"^(supermarket|grocery|convenience)$"]',
    'way["shop"~"^(supermarket|grocery|convenience)$"]',
    'relation["shop"~"^(supermarket|grocery|convenience)$"]',
  ],
  bookstore: ['node["shop"="books"]', 'way["shop"="books"]', 'relation["shop"="books"]'],
  laundry: [
    'node["shop"~"^(laundry|laundrette)$"]',
    'way["shop"~"^(laundry|laundrette)$"]',
    'relation["shop"~"^(laundry|laundrette)$"]',
  ],
  coffee: ['node["amenity"="cafe"]', 'way["amenity"="cafe"]', 'relation["amenity"="cafe"]'],
  restaurant: [
    'node["amenity"~"^(restaurant|fast_food|bar|pub)$"]',
    'way["amenity"~"^(restaurant|fast_food|bar|pub)$"]',
    'relation["amenity"~"^(restaurant|fast_food|bar|pub)$"]',
  ],
  "farmers-market": [
    'node["amenity"="marketplace"]',
    'way["amenity"="marketplace"]',
    'relation["amenity"="marketplace"]',
  ],
  butcher: ['node["shop"="butcher"]', 'way["shop"="butcher"]', 'relation["shop"="butcher"]'],
  "fresh-produce": [
    'node["shop"~"^(greengrocer|farm|health_food)$"]',
    'way["shop"~"^(greengrocer|farm|health_food)$"]',
    'relation["shop"~"^(greengrocer|farm|health_food)$"]',
  ],
  hospital: [
    'node["amenity"="hospital"]',
    'way["amenity"="hospital"]',
    'relation["amenity"="hospital"]',
    'node["healthcare"="hospital"]',
    'way["healthcare"="hospital"]',
    'relation["healthcare"="hospital"]',
  ],
  school: ['node["amenity"="school"]', 'way["amenity"="school"]', 'relation["amenity"="school"]'],
  library: [
    'node["amenity"="library"]',
    'way["amenity"="library"]',
    'relation["amenity"="library"]',
  ],
  pharmacy: [
    'node["amenity"="pharmacy"]',
    'way["amenity"="pharmacy"]',
    'relation["amenity"="pharmacy"]',
  ],
  park: ['node["leisure"="park"]', 'way["leisure"="park"]', 'relation["leisure"="park"]'],
  transit: [
    'node["public_transport"~"^(station|stop_position|platform)$"]',
    'node["highway"="bus_stop"]',
    'node["railway"~"^(station|halt|tram_stop)$"]',
  ],
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const LAUNDROMAT_INCLUDE_PATTERN =
  /\b(laundromat|laundrette|laundry|wash\s*(?:and|&)?\s*fold|washateria|coin\s*(?:op|operated)?|self[-\s]?service)\b/i;
const LAUNDROMAT_FALSE_POSITIVE_PATTERN =
  /\b(carpet|maid|maids|construction|contractor|restoration|janitorial|housekeeping|home\s+cleaning|office\s+cleaning)\b/i;

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

  const latitudeSpan = north - south;
  const longitudeSpan = east - west;

  if (latitudeSpan > MAX_LATITUDE_SPAN || longitudeSpan > MAX_LONGITUDE_SPAN) {
    return {
      error:
        "Map view is too large for a live POI search. Zoom to a town or neighborhood and try again.",
    };
  }

  return { south, west, north, east };
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceMeters(left, right) {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(right.lat - left.lat);
  const deltaLng = toRadians(right.lng - left.lng);
  const leftLat = toRadians(left.lat);
  const rightLat = toRadians(right.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBoundsCircle(bounds) {
  const center = {
    lat: (bounds.south + bounds.north) / 2,
    lng: (bounds.west + bounds.east) / 2,
  };
  const corners = [
    { lat: bounds.south, lng: bounds.west },
    { lat: bounds.south, lng: bounds.east },
    { lat: bounds.north, lng: bounds.west },
    { lat: bounds.north, lng: bounds.east },
  ];
  const radius = Math.max(...corners.map((corner) => distanceMeters(center, corner)));

  return { center, radius };
}

function locationBiasFromBounds(bounds) {
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

function isInsideBounds(point, bounds) {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

function buildOverpassQuery(category, { south, west, north, east }) {
  const clauses = OVERPASS_CLAUSES[category];

  if (!clauses) {
    return undefined;
  }

  const bbox = `${south},${west},${north},${east}`;
  const body = clauses.map((clause) => `  ${clause}(${bbox});`).join("\n");

  return `[out:json][timeout:12];
(
${body}
);
out center tags;
`;
}

function getLatLng(element) {
  const lat = normalizeNumber(element.lat ?? element.center?.lat);
  const lng = normalizeNumber(element.lon ?? element.center?.lon);

  if (lat === undefined || lng === undefined) {
    return undefined;
  }

  return { lat, lng };
}

function joinAddress(parts) {
  return parts.filter(Boolean).join(", ") || undefined;
}

function getAddress(tags = {}) {
  const streetAddress = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const locality = joinAddress([
    tags["addr:city"] || tags["addr:place"],
    tags["addr:state"],
    tags["addr:postcode"],
  ]);

  return joinAddress([streetAddress, locality]);
}

function getOsmName(tags = {}, category) {
  return (
    tags.name ||
    tags.brand ||
    tags.operator ||
    CATEGORY_LABELS[category]?.replace(/s$/, "") ||
    "Place"
  );
}

function normalizeElement(element, category) {
  const location = getLatLng(element);

  if (!location || !element.id || !element.type) {
    return undefined;
  }

  const tags = element.tags || {};
  const sourceId = `osm-${element.type}-${element.id}`;

  return {
    id: sourceId,
    source: "osm",
    sourceId,
    category,
    name: getOsmName(tags, category),
    address: getAddress(tags),
    lat: location.lat,
    lng: location.lng,
    tags: Object.entries(tags)
      .slice(0, 12)
      .map(([key, value]) => `${key}:${value}`),
  };
}

function normalizeGooglePlace(place, bounds, category) {
  const lat = normalizeNumber(place.location?.latitude);
  const lng = normalizeNumber(place.location?.longitude);

  if (!place.id || lat === undefined || lng === undefined) {
    return undefined;
  }

  const point = {
    id: `google-${place.id}`,
    source: "google",
    sourceId: `google-${place.id}`,
    category,
    name: place.displayName?.text || CATEGORY_LABELS[category] || "Place",
    address: place.formattedAddress,
    lat,
    lng,
    rating: normalizeNumber(place.rating),
    userRatingCount: normalizeNumber(place.userRatingCount),
    tags: Array.isArray(place.types) ? place.types : [],
  };

  return isInsideBounds(point, bounds) ? point : undefined;
}

function isRelevantGooglePlace(point, category) {
  if (!point) {
    return false;
  }

  if (category !== "laundry") {
    return true;
  }

  const name = point.name || "";
  const searchable = `${name} ${point.address || ""} ${(point.tags || []).join(" ")}`;

  if (LAUNDROMAT_FALSE_POSITIVE_PATTERN.test(searchable)) {
    return LAUNDROMAT_INCLUDE_PATTERN.test(name);
  }

  return LAUNDROMAT_INCLUDE_PATTERN.test(searchable);
}

function dedupeAndSort(points, sort = "name") {
  const seen = new Set();
  const deduped = [];

  for (const point of points) {
    if (!point || seen.has(point.sourceId)) {
      continue;
    }

    seen.add(point.sourceId);
    deduped.push(point);
  }

  if (sort === "rating") {
    return deduped.sort(
      (left, right) =>
        (right.rating || 0) - (left.rating || 0) ||
        (right.userRatingCount || 0) - (left.userRatingCount || 0) ||
        left.name.localeCompare(right.name),
    );
  }

  return deduped.sort((left, right) => left.name.localeCompare(right.name));
}

async function fetchOverpassData(query) {
  let lastStatus;

  for (let attempt = 0; attempt < OVERPASS_ATTEMPTS; attempt += 1) {
    try {
      const url = new URL(OVERPASS_URL);
      url.searchParams.set("data", query);

      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
        headers: {
          Accept: "application/json",
          "User-Agent": "MapGap/1.0 (https://mapgap-access.netlify.app)",
        },
      });

      if (response.ok) {
        return {
          data: await response.json(),
        };
      }

      lastStatus = response.status;

      if (response.status < 500 && response.status !== 429) {
        return { status: response.status };
      }
    } catch {
      lastStatus = 502;
    }
  }

  return { status: lastStatus || 502 };
}

function getSearchText(category, query) {
  const trimmed = typeof query === "string" ? query.trim() : "";
  return trimmed || CATEGORY_TEXT_QUERY[category] || CATEGORY_LABELS[category] || "places";
}

function shouldUseTextSearch(category, query) {
  return category === "laundry" || Boolean(query?.trim()) || !GOOGLE_NEARBY_TYPES[category];
}

async function fetchGooglePlaces({ bounds, category, query, sort }) {
  const apiKey = getConfiguredSecret("GOOGLE_PLACES_API_KEY");

  if (!apiKey) {
    return { points: [] };
  }

  if (shouldUseTextSearch(category, query)) {
    const response = await fetch(GOOGLE_TEXT_URL, {
      method: "POST",
      signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: getSearchText(category, query),
        maxResultCount: 20,
        locationBias: locationBiasFromBounds(bounds),
      }),
    });

    if (!response.ok) {
      return { points: [], status: response.status };
    }

    const data = await response.json();
    const points = (Array.isArray(data.places) ? data.places : [])
      .map((place) => normalizeGooglePlace(place, bounds, category))
      .filter((point) => isRelevantGooglePlace(point, category));

    return {
      points: dedupeAndSort(points, sort),
      total: Array.isArray(data.places) ? data.places.length : 0,
    };
  }

  const { center, radius } = getBoundsCircle(bounds);

  if (radius > 50000) {
    return { points: [] };
  }

  const response = await fetch(GOOGLE_NEARBY_URL, {
    method: "POST",
    signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: GOOGLE_NEARBY_TYPES[category],
      maxResultCount: 20,
      rankPreference: sort === "rating" ? "POPULARITY" : "DISTANCE",
      locationRestriction: {
        circle: {
          center: {
            latitude: center.lat,
            longitude: center.lng,
          },
          radius: Math.max(1, radius),
        },
      },
    }),
  });

  if (!response.ok) {
    return {
      points: [],
      status: response.status,
    };
  }

  const data = await response.json();
  const points = (Array.isArray(data.places) ? data.places : [])
    .map((place) => normalizeGooglePlace(place, bounds, category))
    .filter((point) => isRelevantGooglePlace(point, category));

  return {
    points: dedupeAndSort(points, sort),
    total: Array.isArray(data.places) ? data.places.length : 0,
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { message: "Use GET for POI search." });
  }

  const params = event.queryStringParameters || {};
  const category = params.category || "laundry";
  const query = String(params.q || "").trim();
  const sort =
    params.sort === "rating" || query.toLowerCase().includes("top rated") ? "rating" : "name";

  if (!SUPPORTED_CATEGORIES.has(category)) {
    return json(400, { message: "Unsupported POI category." });
  }

  const bbox = parseBbox(params.bbox);

  if (!bbox) {
    return json(400, {
      message: "Provide bbox as south,west,north,east inside valid latitude/longitude ranges.",
    });
  }

  if (bbox.error) {
    return json(400, { message: bbox.error });
  }

  const cacheKey = makeCacheKey("poi-search", {
    version: 2,
    category,
    query: query.toLowerCase(),
    sort,
    bbox,
    maxResults: MAX_RESULTS,
  });
  const cached = getCached(poiCache, cacheKey);

  if (cached) {
    return json(
      200,
      withCacheMetadata(cached.value, cached.meta),
      "public, max-age=300",
      cacheHeaders(cached.meta),
    );
  }

  try {
    const google = await fetchGooglePlaces({ bounds: bbox, category, query, sort });

    if (google.points.length > 0) {
      const payload = {
        source: "google",
        category,
        query,
        label: query || CATEGORY_LABELS[category],
        bbox,
        points: google.points,
        total: google.total ?? google.points.length,
        truncated: false,
      };
      const stored = setCached(poiCache, cacheKey, payload, CACHE_TTL_MS);

      return json(
        200,
        withCacheMetadata(stored.value, stored.meta),
        "public, max-age=300",
        cacheHeaders(stored.meta),
      );
    }
  } catch {
    // Fall back to OpenStreetMap when a structured category is available.
  }

  const overpassQuery = buildOverpassQuery(category, bbox);

  if (!overpassQuery) {
    return json(503, {
      message:
        "Custom POI search needs GOOGLE_PLACES_API_KEY. Try a supported category or configure Google Places.",
    });
  }

  const overpass = await fetchOverpassData(overpassQuery);

  if (!overpass.data && !overpass.status) {
    return json(502, { message: "OpenStreetMap POI search is temporarily unavailable." });
  }

  if (!overpass.data) {
    return json(overpass.status, {
      message: `OpenStreetMap POI search failed with status ${overpass.status}.`,
    });
  }

  const points = dedupeAndSort(
    (overpass.data.elements || []).map((element) => normalizeElement(element, category)),
    sort,
  );
  const truncated = points.length > MAX_RESULTS;
  const returnedPoints = truncated ? points.slice(0, MAX_RESULTS) : points;
  const payload = {
    source: "osm",
    category,
    query,
    label: query || CATEGORY_LABELS[category],
    bbox,
    points: returnedPoints,
    total: points.length,
    truncated,
    message: truncated
      ? `Showing the first ${MAX_RESULTS} ${CATEGORY_LABELS[category].toLowerCase()}. Zoom in for a complete local run.`
      : undefined,
  };
  const stored = setCached(poiCache, cacheKey, payload, CACHE_TTL_MS);

  return json(
    200,
    withCacheMetadata(stored.value, stored.meta),
    "public, max-age=300",
    cacheHeaders(stored.meta),
  );
}
