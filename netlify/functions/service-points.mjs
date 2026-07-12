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
  "places.id,places.displayName,places.formattedAddress,places.location,places.types";
const OVERPASS_URLS = Array.from(
  new Set(
    [
      process.env.OVERPASS_API_URL?.trim(),
      "https://lz4.overpass-api.de/api/interpreter",
      "https://overpass-api.de/api/interpreter",
    ].filter(Boolean),
  ),
);
const NISKAYUNA_DOG_PARK_OSM_ID = "way/485187501";
const COLONIE_DOG_PARK_OSM_ID = "way/1107096494";
const NISKAYUNA_DOG_PARK_SOURCE_URL =
  "https://cms2.revize.com/revize/Niskayuna/bus-directory/Document%20Center/Department/Town%20Clerk/Dog%20park/dog_park_information_1.pdf";
const ARCGIS_ITEM_URL = "https://www.arcgis.com/sharing/rest/content/items";
const NY_LIBRARY_URL =
  process.env.NY_LIBRARY_ARCGIS_URL?.trim() ||
  process.env.NY_LIBRARIES_ARCGIS_URL?.trim() ||
  "https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Schools/FeatureServer/15";
const NY_LIBRARY_DATASET_ID =
  process.env.NY_LIBRARY_DATASET_ID?.trim() ||
  process.env.NY_LIBRARY_ARCGIS_ITEM_ID?.trim() ||
  "b6c624c740e4476689aa60fdc4aacb8f";
const NJ_LIBRARY_ITEM_ID =
  process.env.NJ_LIBRARY_ARCGIS_ITEM_ID?.trim() ||
  "9341dca37cdf4f258f2df6ae439f5be4";
const GOOGLE_TIMEOUT_MS = 10000;
const OVERPASS_TIMEOUT_MS = 10000;
const LIBRARY_TIMEOUT_MS = 12000;
const MAX_RESULTS = 40;
const MAX_LATITUDE_SPAN = 1.5;
const MAX_LONGITUDE_SPAN = 1.5;
const CACHE_TTL_MS = getTtlMs("MAPGAP_SERVICE_POINTS_CACHE_TTL_SECONDS", 900);
const servicePointCache = new Map();
const arcgisItemUrlCache = new Map();
const arcgisLayerUrlCache = new Map();

const CATEGORIES = new Set(["laundry", "coffee", "grocery", "library", "custom"]);

const CATEGORY_LABELS = {
  laundry: "Laundry",
  coffee: "Coffee",
  grocery: "Groceries",
  library: "Libraries",
  custom: "Custom",
};

const GOOGLE_TYPES = {
  coffee: ["cafe", "coffee_shop"],
  grocery: ["grocery_store", "supermarket"],
  library: ["library"],
};

const GOOGLE_TEXT_QUERIES = {
  laundry: "self-service laundromats",
  coffee: "coffee shops",
  grocery: "grocery stores",
  library: "public libraries",
  custom: "places",
};

const SOURCE_LABELS = {
  google_places: "Google Places",
  ny_libraries: "NY Open Data",
  nj_libraries: "NJ Open Data",
  hybrid: "NY/NJ Open Data",
  openstreetmap: "OpenStreetMap",
  official_local: "Town verified",
};

const STATE_REGIONS = {
  NY: [
    { minLng: -79.9, minLat: 41.0, maxLng: -71.75, maxLat: 45.05 },
    { minLng: -74.3, minLat: 40.47, maxLng: -73.92, maxLat: 40.65 },
    { minLng: -73.99, minLat: 40.55, maxLng: -71.75, maxLat: 41.35 },
  ],
  NJ: [
    { minLng: -75.65, minLat: 38.85, maxLng: -73.85, maxLat: 41.4 },
  ],
};

const LAUNDROMAT_INCLUDE_PATTERN =
  /\b(laundromat|laundrette|laundry|wash\s*(?:and|&)?\s*fold|washateria|coin\s*(?:op|operated)?|self[-\s]?service)\b/i;
const LAUNDROMAT_FALSE_POSITIVE_PATTERN =
  /\b(carpet|dry\s*clean(?:er|ers|ing)?|maid|maids|construction|contractor|restoration|janitorial|housekeeping|home\s+cleaning|office\s+cleaning)\b/i;
const PUBLIC_LIBRARY_INCLUDE_PATTERN =
  /\b(public|free|community|county|city|town|village|district|state|memorial|association)\b.*\blibrar(?:y|ies)\b|\blibrar(?:y|ies)\b.*\b(public|free|community|county|city|town|village|district|state|memorial|association)\b/i;
const PUBLIC_LIBRARY_FALSE_POSITIVE_PATTERN =
  /\b(university|college|graduate|law\s+school|medical\s+school|campus|seminary|sculpture|museum|archive|archives|monographic)\b/i;
const DOG_PARK_QUERY_PATTERN =
  /\b(?:dog|canine)\s+(?:park|parks|run|runs)\b|\boff[-\s]?leash\s+(?:park|parks|area|areas)\b/i;
const DOG_PARK_RESULT_PATTERN =
  /\b(?:dog|canine)\s+(?:park|parks|run|runs)\b|\boff[-\s]?leash\b/i;

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

function logServicePointEvent(event, details) {
  console.info(
    JSON.stringify({
      event: `mapgap.service_points.${event}`,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseBbox(raw) {
  if (typeof raw !== "string") {
    return undefined;
  }

  const [minLng, minLat, maxLng, maxLat] = raw.split(",").map(normalizeNumber);

  if (
    minLng === undefined ||
    minLat === undefined ||
    maxLng === undefined ||
    maxLat === undefined ||
    minLat < -90 ||
    maxLat > 90 ||
    minLng < -180 ||
    maxLng > 180 ||
    minLat >= maxLat ||
    minLng >= maxLng
  ) {
    return undefined;
  }

  if (maxLat - minLat > MAX_LATITUDE_SPAN || maxLng - minLng > MAX_LONGITUDE_SPAN) {
    return {
      error:
        "Map view is too large for live service-point search. Zoom to a town or neighborhood and try again.",
    };
  }

  return { minLng, minLat, maxLng, maxLat };
}

function parseCustomQuery(raw) {
  const query = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";

  if (query.length < 2) {
    return {
      error: "Enter a custom category, like pharmacies, daycares, parks, or late dinner.",
    };
  }

  if (query.length > 80) {
    return {
      error: "Custom category is too long. Keep it under 80 characters.",
    };
  }

  return { query };
}

function isDogParkQuery(query) {
  return typeof query === "string" && DOG_PARK_QUERY_PATTERN.test(query);
}

function bboxToApi(bounds) {
  return [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat];
}

function boundsToSouthWest(bounds) {
  return {
    south: bounds.minLat,
    west: bounds.minLng,
    north: bounds.maxLat,
    east: bounds.maxLng,
  };
}

function centerOf(bounds) {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
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

function boundsCircle(bounds) {
  const center = centerOf(bounds);
  const corners = [
    { lat: bounds.minLat, lng: bounds.minLng },
    { lat: bounds.minLat, lng: bounds.maxLng },
    { lat: bounds.maxLat, lng: bounds.minLng },
    { lat: bounds.maxLat, lng: bounds.maxLng },
  ];
  const radius = Math.max(...corners.map((corner) => distanceMeters(center, corner)));

  return { center, radius };
}

function isInsideBounds(point, bounds) {
  return (
    point.location.lat >= bounds.minLat &&
    point.location.lat <= bounds.maxLat &&
    point.location.lng >= bounds.minLng &&
    point.location.lng <= bounds.maxLng
  );
}

function intersects(left, right) {
  return !(
    left.maxLng < right.minLng ||
    left.minLng > right.maxLng ||
    left.maxLat < right.minLat ||
    left.minLat > right.maxLat
  );
}

function statesForBounds(bounds) {
  return Object.entries(STATE_REGIONS)
    .filter(([, regions]) => regions.some((stateBounds) => intersects(bounds, stateBounds)))
    .map(([state]) => state);
}

function googleLocationBias(bounds) {
  return {
    rectangle: {
      low: {
        latitude: bounds.minLat,
        longitude: bounds.minLng,
      },
      high: {
        latitude: bounds.maxLat,
        longitude: bounds.maxLng,
      },
    },
  };
}

function normalizeGooglePlace(place, category, bounds, categoryLabel) {
  const lat = normalizeNumber(place.location?.latitude);
  const lng = normalizeNumber(place.location?.longitude);

  if (!place.id || lat === undefined || lng === undefined) {
    return undefined;
  }

  const point = {
    id: `google-${place.id}`,
    name: place.displayName?.text || CATEGORY_LABELS[category],
    category,
    categoryLabel,
    location: { lat, lng },
    source: "google_places",
    address: place.formattedAddress,
    confidence: "medium",
    provenance: {
      label: SOURCE_LABELS.google_places,
      note: "Provider place result.",
    },
    rawData: {
      id: place.id,
      types: Array.isArray(place.types) ? place.types : [],
    },
  };

  return isInsideBounds(point, bounds) ? point : undefined;
}

function isRelevantGooglePoint(point, category, query) {
  if (!point) {
    return false;
  }

  if (category === "library") {
    const types = Array.isArray(point.rawData?.types) ? point.rawData.types : [];

    if (!types.includes("library") || PUBLIC_LIBRARY_FALSE_POSITIVE_PATTERN.test(point.name)) {
      return false;
    }

    return PUBLIC_LIBRARY_INCLUDE_PATTERN.test(point.name);
  }

  if (category === "custom" && isDogParkQuery(query)) {
    const types = Array.isArray(point.rawData?.types) ? point.rawData.types : [];
    return types.includes("dog_park") || DOG_PARK_RESULT_PATTERN.test(point.name);
  }

  if (category !== "laundry") {
    return true;
  }

  const searchable = `${point.name} ${point.address || ""} ${point.rawData?.types?.join(" ") || ""}`;

  if (LAUNDROMAT_FALSE_POSITIVE_PATTERN.test(searchable)) {
    return LAUNDROMAT_INCLUDE_PATTERN.test(point.name);
  }

  return LAUNDROMAT_INCLUDE_PATTERN.test(searchable);
}

function textQueryFor(category, query) {
  if (category === "custom" && query) {
    return query;
  }

  return GOOGLE_TEXT_QUERIES[category] || CATEGORY_LABELS[category] || "places";
}

async function fetchGoogleServicePoints({ category, bounds, maxResults = MAX_RESULTS, query }) {
  const apiKey = getConfiguredSecret("GOOGLE_PLACES_API_KEY");

  if (!apiKey) {
    return {
      points: [],
      warnings: ["GOOGLE_PLACES_API_KEY is not configured."],
    };
  }

  const shouldUseTextSearch = category === "laundry" || category === "custom";

  if (shouldUseTextSearch) {
    return fetchGoogleTextServicePoints({ category, bounds, maxResults, query });
  }

  const { center, radius } = boundsCircle(bounds);

  if (radius > 50000) {
    return fetchGoogleTextServicePoints({ category, bounds, maxResults, query });
  }

  const response = await fetch(GOOGLE_NEARBY_URL, {
    method: "POST",
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: GOOGLE_TYPES[category],
      maxResultCount: Math.min(maxResults, 20),
      rankPreference: "DISTANCE",
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
      warnings: [`Google Places returned status ${response.status}.`],
    };
  }

  const data = await response.json();
  const points = (Array.isArray(data.places) ? data.places : [])
    .map((place) => normalizeGooglePlace(place, category, bounds))
    .filter((point) => isRelevantGooglePoint(point, category, query));

  return { points: dedupeServicePoints(points).slice(0, maxResults) };
}

async function fetchGoogleTextServicePoints({ category, bounds, maxResults, query }) {
  const apiKey = getConfiguredSecret("GOOGLE_PLACES_API_KEY");

  if (!apiKey) {
    return {
      points: [],
      warnings: ["GOOGLE_PLACES_API_KEY is not configured."],
    };
  }

  const response = await fetch(GOOGLE_TEXT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: textQueryFor(category, query),
      maxResultCount: Math.min(maxResults, 20),
      locationBias: googleLocationBias(bounds),
    }),
  });

  if (!response.ok) {
    return {
      points: [],
      warnings: [`Google Places returned status ${response.status}.`],
    };
  }

  const data = await response.json();
  const points = (Array.isArray(data.places) ? data.places : [])
    .map((place) => normalizeGooglePlace(place, category, bounds, query))
    .filter((point) => isRelevantGooglePoint(point, category, query));

  return {
    points: dedupeServicePoints(points).slice(0, maxResults),
    warnings:
      category === "custom"
        ? ["Custom categories use Google Places provider matching. Verify result relevance."]
        : [],
  };
}

function normalizeOsmDogPark(element, bounds) {
  const lat = normalizeNumber(element.lat ?? element.center?.lat);
  const lng = normalizeNumber(element.lon ?? element.center?.lon);

  if (!element.type || element.id === undefined || lat === undefined || lng === undefined) {
    return undefined;
  }

  const osmId = `${element.type}/${element.id}`;
  const tags = element.tags || {};

  if (tags.leisure !== "dog_park") {
    return undefined;
  }

  const street = [cleanText(tags["addr:housenumber"]), cleanText(tags["addr:street"])]
    .filter(Boolean)
    .join(" ");
  const address = buildAddress(
    street,
    cleanText(tags["addr:city"]),
    cleanText(tags["addr:state"]),
    cleanText(tags["addr:postcode"]),
  );
  const point = {
    id: `osm-${element.type}-${element.id}`,
    name: cleanText(tags.name) || "Mapped dog park",
    category: "custom",
    categoryLabel: "Dog parks",
    location: { lat, lng },
    source: "openstreetmap",
    address,
    sourceUrl: `https://www.openstreetmap.org/${osmId}`,
    sourceDatasetId: osmId,
    confidence: "high",
    provenance: {
      label: SOURCE_LABELS.openstreetmap,
      datasetId: osmId,
      sourceUrl: `https://www.openstreetmap.org/${osmId}`,
      note: "Mapped as leisure=dog_park in OpenStreetMap.",
    },
    rawData: {
      id: osmId,
      types: ["dog_park"],
      access: cleanText(tags.access),
      barrier: cleanText(tags.barrier),
      operator: cleanText(tags.operator),
    },
  };

  if (!isInsideBounds(point, bounds)) {
    return undefined;
  }

  if (osmId === NISKAYUNA_DOG_PARK_OSM_ID) {
    return {
      ...point,
      name: "Niskayuna Dog Park (Blatnick Park)",
      source: "official_local",
      address: "Jeff Blatnick Park, River Rd, Niskayuna, NY 12309",
      sourceUrl: NISKAYUNA_DOG_PARK_SOURCE_URL,
      provenance: {
        label: SOURCE_LABELS.official_local,
        datasetId: osmId,
        sourceUrl: NISKAYUNA_DOG_PARK_SOURCE_URL,
        note: "Town guidance locates the fenced dog park inside Blatnick Park behind the baseball fields.",
      },
    };
  }

  if (osmId === COLONIE_DOG_PARK_OSM_ID) {
    return {
      ...point,
      name: "Town of Colonie Dog Park",
      address: "71 Schermerhorn Rd, Cohoes, NY 12047",
      provenance: {
        ...point.provenance,
        note: "Mapped as leisure=dog_park inside Colonie Mohawk River Park.",
      },
    };
  }

  return point;
}

async function fetchOpenStreetMapDogParks(bounds) {
  const query = `[out:json][timeout:8];nwr["leisure"="dog_park"](${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng});out center tags;`;

  for (const endpoint of OVERPASS_URLS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", query);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
        headers: {
          Accept: "application/json",
          "User-Agent": "MapGap/2.0 service-point-search",
        },
      });

      if (!response.ok) {
        console.warn(`Overpass endpoint returned ${response.status}: ${url.origin}`);
        continue;
      }

      const data = await response.json();
      const points = (Array.isArray(data.elements) ? data.elements : [])
        .map((element) => normalizeOsmDogPark(element, bounds))
        .filter(Boolean)
        .sort((left, right) => {
          if (left.source === "official_local" && right.source !== "official_local") {
            return -1;
          }
          if (right.source === "official_local" && left.source !== "official_local") {
            return 1;
          }
          return left.name.localeCompare(right.name);
        });

      return {
        points: dedupeServicePoints(points),
        warnings: [],
      };
    } catch (error) {
      console.warn(
        `Overpass endpoint failed: ${new URL(endpoint).origin}`,
        error instanceof Error ? error.name : "unknown_error",
      );
    }
  }

  return {
    points: [],
    warnings: ["OpenStreetMap dog-park search is temporarily unavailable."],
  };
}

async function fetchDogParkServicePoints(bounds, query) {
  const osmResult = await fetchOpenStreetMapDogParks(bounds);

  if (osmResult.points.length > 0) {
    return osmResult;
  }

  const googleResult = await fetchGoogleTextServicePoints({
    category: "custom",
    bounds,
    maxResults: MAX_RESULTS,
    query,
  });

  return {
    points: googleResult.points,
    warnings: [
      ...osmResult.warnings,
      ...googleResult.warnings,
      "Showing explicit Google dog-park matches because mapped OpenStreetMap results were unavailable.",
    ],
  };
}

function cleanText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstText(attributes, names) {
  for (const name of names) {
    const value = cleanText(attributes?.[name]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function coordinateFromAttributes(attributes, names) {
  for (const name of names) {
    const value = normalizeNumber(attributes?.[name]);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function joinAddress(parts) {
  return parts.filter(Boolean).join(", ") || undefined;
}

function buildAddress(street, city, state, zip) {
  const searchable = (street || "").toLowerCase();
  const parts = [street];

  if (city && !searchable.includes(city.toLowerCase())) {
    parts.push(city);
  }

  if (state && !new RegExp(`\\b${escapeRegExp(state.toLowerCase())}\\b`).test(searchable)) {
    parts.push(state);
  }

  if (zip && !searchable.includes(zip.toLowerCase())) {
    parts.push(zip);
  }

  return joinAddress(parts);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeArcgisFeature(feature, { source, category, datasetId, sourceUrl, jurisdiction }) {
  const attributes = feature.attributes || {};
  const lat =
    normalizeNumber(feature.geometry?.y) ||
    coordinateFromAttributes(attributes, ["lat", "Lat", "LAT", "latitude", "Latitude", "LATITUDE"]);
  const lng =
    normalizeNumber(feature.geometry?.x) ||
    coordinateFromAttributes(attributes, ["lng", "Lng", "LNG", "lon", "Lon", "LON", "long", "Long", "LONG", "longitude", "Longitude", "LONGITUDE"]);

  if (lat === undefined || lng === undefined) {
    return undefined;
  }

  const name = firstText(attributes, [
    "name",
    "Name",
    "NAME",
    "library",
    "Library",
    "LIBRARY",
    "library_name",
    "LIBRARY_NAME",
    "LIB_NAME",
    "LEGAL_NAME",
    "BRANCH",
    "Branch",
    "FACILITY",
    "Facility",
  ]);

  if (!name) {
    return undefined;
  }

  const street = firstText(attributes, [
    "address",
    "Address",
    "ADDRESS",
    "street",
    "Street",
    "STREET",
    "ADDR",
    "ADDR1",
    "STREETADDR",
    "PHYSADDRLINE1",
  ]);
  const city = firstText(attributes, [
    "city",
    "City",
    "CITY",
    "town",
    "Town",
    "TOWN",
    "municipality",
    "MUNICIPALITY",
    "PHYSCITY",
  ]);
  const state =
    firstText(attributes, ["state", "State", "STATE", "PHYSICALSTATE"]) || jurisdiction;
  const zip = firstText(attributes, [
    "zip",
    "Zip",
    "ZIP",
    "zipcode",
    "ZIPCODE",
    "PHYSZIPCD5",
  ]);
  const phone = firstText(attributes, [
    "phone",
    "Phone",
    "PHONE",
    "TEL",
    "telephone",
    "CEO_PHONENUM",
  ]);
  const website = firstText(attributes, [
    "website",
    "Website",
    "WEBSITE",
    "url",
    "URL",
    "web",
    "WEB",
    "links",
    "Links",
    "LINKS",
  ]);
  const updatedAt = firstText(attributes, [
    "updated",
    "Updated",
    "UPDATED",
    "last_edited_date",
    "LAST_EDITED_DATE",
  ]);
  const objectId =
    attributes.OBJECTID ||
    attributes.ObjectId ||
    attributes.FID ||
    attributes.id ||
    `${name}-${lat.toFixed(5)}-${lng.toFixed(5)}`;

  return {
    id: `${source}-${objectId}`,
    name,
    category,
    location: { lat, lng },
    source,
    address: buildAddress(street, city, state, zip),
    phone,
    website,
    sourceUrl,
    sourceDatasetId: datasetId,
    sourceUpdatedAt: updatedAt,
    jurisdiction,
    confidence: "high",
    provenance: {
      label: SOURCE_LABELS[source],
      datasetId,
      sourceUrl,
      sourceUpdatedAt: updatedAt,
      note: "Official public library source.",
    },
    rawData: attributes,
  };
}

function normalizeArcgisUrl(url) {
  if (!url) {
    return undefined;
  }

  const trimmed = url.trim().replace(/\/+$/, "");

  return trimmed;
}

async function ensureArcgisLayerUrl(url) {
  const normalized = normalizeArcgisUrl(url);

  if (!normalized) {
    return undefined;
  }

  if (/\/(?:FeatureServer|MapServer)\/\d+$/i.test(normalized)) {
    return normalized;
  }

  if (!/\/(?:FeatureServer|MapServer)$/i.test(normalized)) {
    return normalized;
  }

  const cached = arcgisLayerUrlCache.get(normalized);

  if (cached) {
    return cached;
  }

  const metadataUrl = new URL(normalized);
  metadataUrl.searchParams.set("f", "json");

  const response = await fetch(metadataUrl, {
    signal: AbortSignal.timeout(LIBRARY_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "User-Agent": "MapGap/1.0 (https://mapgap-access.netlify.app)",
    },
  });

  if (!response.ok) {
    return `${normalized}/0`;
  }

  const data = await response.json();
  const layer =
    Array.isArray(data.layers) && data.layers.length > 0
      ? data.layers.find((candidate) => candidate.geometryType === "esriGeometryPoint") ||
        data.layers[0]
      : undefined;
  const layerId = Number.isFinite(Number(layer?.id)) ? Number(layer.id) : 0;
  const layerUrl = `${normalized}/${layerId}`;

  arcgisLayerUrlCache.set(normalized, layerUrl);

  return layerUrl;
}

async function resolveArcgisItemUrl(itemId) {
  if (!itemId) {
    return undefined;
  }

  const cached = arcgisItemUrlCache.get(itemId);

  if (cached) {
    return cached;
  }

  const url = new URL(`${ARCGIS_ITEM_URL}/${itemId}`);
  url.searchParams.set("f", "json");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(LIBRARY_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "User-Agent": "MapGap/1.0 (https://mapgap-access.netlify.app)",
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const data = await response.json();
  const serviceUrl = await ensureArcgisLayerUrl(data.url);

  if (serviceUrl) {
    arcgisItemUrlCache.set(itemId, serviceUrl);
  }

  return serviceUrl;
}

async function getLibraryServiceUrl(state) {
  if (state === "NY") {
    return ensureArcgisLayerUrl(NY_LIBRARY_URL);
  }

  const configuredUrl = process.env.NJ_LIBRARY_ARCGIS_URL || process.env.NJ_LIBRARIES_ARCGIS_URL;

  if (configuredUrl) {
    return ensureArcgisLayerUrl(configuredUrl);
  }

  return resolveArcgisItemUrl(NJ_LIBRARY_ITEM_ID);
}

async function fetchArcgisLibraries({ bounds, source, datasetId, jurisdiction }) {
  const serviceUrl = await getLibraryServiceUrl(jurisdiction);

  if (!serviceUrl) {
    return {
      points: [],
      warning: `${jurisdiction} library open-data endpoint is not configured.`,
    };
  }

  const url = new URL(`${serviceUrl}/query`);
  url.searchParams.set("f", "json");
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("geometry", bboxToApi(bounds).join(","));
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("resultRecordCount", String(MAX_RESULTS));

  const response = await fetch(url, {
    signal: AbortSignal.timeout(LIBRARY_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "User-Agent": "MapGap/1.0 (https://mapgap-access.netlify.app)",
    },
  });

  if (!response.ok) {
    return {
      points: [],
      warning: `${jurisdiction} library open-data source returned status ${response.status}.`,
    };
  }

  const data = await response.json();

  if (data.error) {
    return {
      points: [],
      warning: `${jurisdiction} library open-data source returned an error.`,
    };
  }

  const points = (Array.isArray(data.features) ? data.features : [])
    .map((feature) =>
      normalizeArcgisFeature(feature, {
        source,
        category: "library",
        datasetId,
        sourceUrl: serviceUrl,
        jurisdiction,
      }),
    )
    .filter((point) => point && isInsideBounds(point, bounds));

  return { points };
}

async function fetchLibraryServicePoints(bounds) {
  const states = statesForBounds(bounds);
  const warnings = [];
  const results = [];

  if (states.includes("NY")) {
    const ny = await fetchArcgisLibraries({
      bounds,
      source: "ny_libraries",
      datasetId: NY_LIBRARY_DATASET_ID,
      jurisdiction: "NY",
    });
    results.push(...ny.points);
    if (ny.warning) {
      warnings.push(ny.warning);
    }
  }

  if (states.includes("NJ")) {
    const nj = await fetchArcgisLibraries({
      bounds,
      source: "nj_libraries",
      datasetId: NJ_LIBRARY_ITEM_ID,
      jurisdiction: "NJ",
    });
    results.push(...nj.points);
    if (nj.warning) {
      warnings.push(nj.warning);
    }
  }

  const deduped = dedupeServicePoints(results);

  if (deduped.length > 0) {
    return {
      points: deduped,
      warnings,
    };
  }

  const fallback = await fetchGoogleServicePoints({
    category: "library",
    bounds,
    maxResults: MAX_RESULTS,
  });

  return {
    points: fallback.points,
    warnings: [
      ...warnings,
      "Official NY/NJ open data temporarily unavailable - showing Google Places backup.",
      ...(fallback.warnings || []),
    ],
  };
}

function dedupeKey(point) {
  const name = point.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${name}:${point.location.lat.toFixed(4)}:${point.location.lng.toFixed(4)}`;
}

function dedupeServicePoints(points) {
  const byKey = new Map();

  for (const point of points) {
    if (!point) {
      continue;
    }

    const key = dedupeKey(point);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, point);
      continue;
    }

    if (existing.source !== point.source) {
      byKey.set(key, {
        ...existing,
        source: "hybrid",
        provenance: {
          ...existing.provenance,
          label: SOURCE_LABELS.hybrid,
          note: "Duplicate record merged from NY/NJ library sources.",
        },
      });
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const sourcePriority = {
      official_local: 0,
      openstreetmap: 1,
    };
    const leftPriority = sourcePriority[left.source] ?? 2;
    const rightPriority = sourcePriority[right.source] ?? 2;

    return leftPriority - rightPriority || left.name.localeCompare(right.name);
  });
}

function responseSources(points) {
  return Array.from(new Set(points.map((point) => point.source))).sort();
}

export async function handler(event) {
  const requestStartedAt = Date.now();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { message: "Use GET for service point search." });
  }

  const params = event.queryStringParameters || {};
  const category = String(params.category || "").trim();
  const customQuery = parseCustomQuery(String(params.q || params.query || ""));

  if (!CATEGORIES.has(category)) {
    return json(400, { message: "Unsupported service point category." });
  }

  if (category === "custom" && customQuery.error) {
    return json(400, { message: customQuery.error });
  }

  const bounds = parseBbox(params.bbox);

  if (!bounds) {
    return json(400, {
      message: "Provide bbox as minLng,minLat,maxLng,maxLat inside valid ranges.",
    });
  }

  if (bounds.error) {
    return json(400, { message: bounds.error });
  }

  const cacheKey = makeCacheKey("service-points", {
    version: 3,
    category,
    query: category === "custom" ? customQuery.query : undefined,
    bounds,
    googleKeyConfigured: Boolean(getConfiguredSecret("GOOGLE_PLACES_API_KEY")),
    overpassUrls:
      category === "custom" && isDogParkQuery(customQuery.query) ? OVERPASS_URLS : undefined,
    nyUrl: NY_LIBRARY_URL,
    njUrl: process.env.NJ_LIBRARY_ARCGIS_URL || process.env.NJ_LIBRARIES_ARCGIS_URL || NJ_LIBRARY_ITEM_ID,
  });
  const cached = getCached(servicePointCache, cacheKey);

  if (cached) {
    logServicePointEvent("completed", {
      category,
      cacheHit: true,
      count: cached.value.count,
      sources: cached.value.sources,
      warningCount: cached.value.warnings?.length || 0,
      durationMs: Date.now() - requestStartedAt,
    });
    return json(
      200,
      withCacheMetadata(cached.value, cached.meta),
      "public, max-age=300",
      cacheHeaders(cached.meta),
    );
  }

  try {
    const result =
      category === "library"
        ? await fetchLibraryServicePoints(bounds)
        : category === "custom" && isDogParkQuery(customQuery.query)
          ? await fetchDogParkServicePoints(bounds, customQuery.query)
        : await fetchGoogleServicePoints({
            category,
            bounds,
            maxResults: MAX_RESULTS,
            query: category === "custom" ? customQuery.query : undefined,
          });

    const points = dedupeServicePoints(result.points).slice(0, MAX_RESULTS);
    const payload = {
      category,
      label: category === "custom" ? customQuery.query : CATEGORY_LABELS[category],
      query: category === "custom" ? customQuery.query : undefined,
      bbox: bboxToApi(bounds),
      center: centerOf(bounds),
      radiusMeters: Math.round(boundsCircle(bounds).radius),
      count: points.length,
      sources: responseSources(points),
      points,
      warnings: (result.warnings || []).filter(Boolean),
    };
    const stored = setCached(servicePointCache, cacheKey, payload, CACHE_TTL_MS);

    logServicePointEvent("completed", {
      category,
      cacheHit: false,
      count: payload.count,
      sources: payload.sources,
      warningCount: payload.warnings.length,
      durationMs: Date.now() - requestStartedAt,
    });

    return json(
      200,
      withCacheMetadata(stored.value, stored.meta),
      "public, max-age=300",
      cacheHeaders(stored.meta),
    );
  } catch (error) {
    console.error("Service point search failed", error);
    logServicePointEvent("failed", {
      category,
      cacheHit: false,
      failureCategory: error instanceof Error ? error.name : "unknown_error",
      durationMs: Date.now() - requestStartedAt,
    });

    return json(502, {
      message: "Service point search failed. Try again or move the map slightly.",
    });
  }
}
