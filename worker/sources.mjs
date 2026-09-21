import seed from "../config/source-catalog.seed.json" with { type: "json" };
import { ApiError } from "./http.mjs";

const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const readiness = new Map();
const sourceLabels = {
  "nys-public-libraries": ["ny_libraries", "library", "Libraries"],
  "nys-farmers-markets": ["nys_farmers_markets", "custom", "Farmers markets"],
  "nys-retail-food-stores": ["nys_retail_food_stores", "custom", "Registered food stores"],
};

export function catalog() {
  return {
    schemaVersion: "mapgap-layer-catalog/v1",
    layers: seed.sources.map((source) => ({
      id: source.id,
      title: source.title,
      connector: source.connector,
      sourceUrl: source.catalogUrl ?? source.url,
      attribution: source.sourceAttribution,
      interpretation: source.interpretation,
      licenseStatus: source.licenseStatus,
      access: "public",
      lookup: "bounded-viewport",
      maxRecords: PAGE_SIZE * MAX_PAGES,
      credentialRequired: false,
    })),
    imports: { enabled: false, reason: "Private saved imports follow the authenticated dataset registry." },
  };
}

export function sourceHealth() {
  return seed.sources.map((source) => ({
    id: source.id,
    configured: true,
    ...(readiness.get(source.id) ?? { status: "not_checked", checkedAt: null }),
  }));
}

export function parseBbox(value) {
  if (typeof value !== "string" || value.split(",").length !== 4 || value.split(",").some((part) => !part.trim())) {
    throw new ApiError(400, "INVALID_ARGUMENT", "bbox must be west,south,east,north.");
  }
  const bounds = value.split(",").map(Number);
  const [west, south, east, north] = bounds;
  if (bounds.some((number) => !Number.isFinite(number)) || west < -180 || east > 180 || south < -90 || north > 90 ||
      west >= east || south >= north || east - west > 1.5 || north - south > 1.5) {
    throw new ApiError(400, "INVALID_ARGUMENT", "Use a valid viewport no larger than 1.5 degrees in either direction.");
  }
  return bounds;
}

function point(source, row, bbox) {
  const arcgis = source.connector === "arcgis-feature-service";
  const fields = arcgis ? row.attributes : row;
  if (!fields) return null;
  const coordinate = arcgis ? [row.geometry?.x, row.geometry?.y] : fields[source.geometryField]?.coordinates;
  const lng = coordinate?.[0];
  const lat = coordinate?.[1];
  const name = fields[source.nameField] || fields[source.nameFallback];
  const rowId = arcgis ? fields.OBJECTID : fields.row_id ?? fields[":id"] ?? fields[source.stableIdCandidate];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
      lng < bbox[0] || lat < bbox[1] || lng > bbox[2] || lat > bbox[3] || typeof name !== "string" || !name.trim() || rowId == null) return null;
  const [kind, category, categoryLabel] = sourceLabels[source.id];
  const sourceUrl = source.catalogUrl ?? source.url;
  const address = arcgis
    ? [fields.PHYSADDRLINE1, fields.PHYSCITY, fields.PHYSICALSTATE, fields.PHYSZIPCD5]
    : [fields.address_line_1 ?? [fields.street_number, fields.street_name].filter(Boolean).join(" "), fields.city, fields.state, fields.zip ?? fields.zip_code];
  return {
    id: `${source.id}:${rowId}`,
    name: name.trim(),
    category,
    categoryLabel,
    location: { lat, lng },
    source: kind,
    address: address.filter(Boolean).join(", "),
    sourceUrl,
    sourceDatasetId: source.datasetId ?? source.id,
    jurisdiction: "NY",
    confidence: "high",
    provenance: { label: source.sourceAttribution, datasetId: source.datasetId ?? source.id, sourceUrl, note: source.interpretation ?? "Official public library source." },
  };
}

function queryUrl(source, bbox, offset) {
  const [west, south, east, north] = bbox;
  if (source.connector === "arcgis-feature-service") {
    const url = new URL(`${source.url}/query`);
    url.search = new URLSearchParams({
      f: "json", where: "1=1", outFields: "*", returnGeometry: "true",
      geometry: bbox.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326",
      spatialRel: "esriSpatialRelIntersects", resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE), orderByFields: "OBJECTID ASC",
    }).toString();
    return url;
  }
  const url = new URL(`https://${source.domain}/resource/${source.datasetId}.json`);
  url.search = new URLSearchParams({
    $select: "*, :id as row_id",
    $where: `within_box(${source.geometryField},${north},${west},${south},${east})`,
    $order: ":id", $limit: String(PAGE_SIZE), $offset: String(offset),
  }).toString();
  return url;
}

export async function lookupSource(id, bbox, env, { fetcher = fetch, signal } = {}) {
  const source = seed.sources.find((entry) => entry.id === id);
  if (!source) throw new ApiError(404, "NOT_FOUND", "Unknown public dataset.");
  const points = new Map();
  const warnings = [];
  let complete = false;
  let pagesFetched = 0;
  let recordsRead = 0;
  let discarded = 0;
  const checkedAt = new Date().toISOString();
  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const headers = { Accept: "application/json" };
      // Fixed catalog hosts only. No user URLs or browser-supplied credentials.
      if (source.connector === "socrata" && env.SODA_APP_TOKEN) headers["X-App-Token"] = env.SODA_APP_TOKEN;
      const timeout = AbortSignal.timeout(12_000);
      const response = await fetcher(queryUrl(source, bbox, recordsRead), {
        headers, redirect: "error", signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) throw new Error("Upstream unavailable");
      const data = await response.json();
      const rows = source.connector === "socrata" ? data : data.features;
      if (data.error || !Array.isArray(rows) || rows.length > PAGE_SIZE) throw new Error("Invalid upstream response");
      pagesFetched++;
      recordsRead += rows.length;
      for (const row of rows) {
        const normalized = point(source, row, bbox);
        if (normalized && !points.has(normalized.id)) points.set(normalized.id, normalized);
        else discarded++;
      }
      const more = source.connector === "socrata" ? rows.length === PAGE_SIZE : data.exceededTransferLimit === true;
      if (!more) { complete = true; break; }
    } catch {
      if (signal?.aborted) throw new ApiError(499, "CANCELLED", "Source request cancelled.");
      readiness.set(id, { status: "unavailable", checkedAt });
      if (!pagesFetched) throw new ApiError(502, "SOURCE_UNAVAILABLE", `${source.title} is unavailable. No replacement data was inserted.`);
      warnings.push("A later source page failed. Results are partial.");
      break;
    }
  }
  if (!complete && !warnings.length) warnings.push(`Results are capped at ${PAGE_SIZE * MAX_PAGES} source rows in this viewport.`);
  if (discarded) warnings.push(`${discarded} duplicate, unnamed or invalid/out-of-bounds records were excluded.`);
  const [kind, category, label] = sourceLabels[id];
  const result = {
    category, label, bbox,
    count: points.size, points: [...points.values()], sources: [kind], warnings,
    extensions: [], activeExtensions: [],
    completeness: { scope: "viewport", complete: complete && discarded === 0, truncated: !complete, pagesFetched, recordsRead, discarded },
    freshness: { fetchedAt: checkedAt, sourceUpdatedAt: null, note: "Retrieval time is not the source update date." },
  };
  readiness.set(id, { status: result.completeness.complete ? "ready" : "partial", checkedAt });
  return result;
}
