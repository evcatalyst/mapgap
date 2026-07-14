export type HousingTenure = "rent" | "sale";

export type HousingListingSource =
  | "rentcast"
  | "zillow_group"
  | "trulia"
  | "craigslist"
  | "mls_reso"
  | "user_import"
  | "illustrative";

export type HousingListingAccess =
  | "live-api"
  | "licensed-feed"
  | "user-provided"
  | "illustrative";

export type HousingListing = {
  id: string;
  title: string;
  address?: string;
  location: {
    lat: number;
    lng: number;
  };
  tenure: HousingTenure;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  propertyType?: string;
  status?: string;
  listedAt?: string;
  lastSeenAt?: string;
  source: HousingListingSource;
  sourceLabel: string;
  sourceUrl?: string;
  providerListingId?: string;
  confidence?: "high" | "medium" | "low";
  provenance: {
    access: HousingListingAccess;
    label: string;
    note?: string;
    observedAt?: string;
  };
};

export type HousingSearchFilters = {
  tenure: HousingTenure;
  maxPrice?: number;
  minBedrooms?: number;
};

export type HousingListingResponse = {
  count: number;
  listings: HousingListing[];
  mode: "live" | "illustrative";
  sources: HousingListingSource[];
  warnings?: string[];
  liveProviderConfigured: boolean;
  query: HousingSearchFilters & {
    bbox: [number, number, number, number];
  };
  cache?: {
    hit: boolean;
    generatedAt: string;
    expiresAt: string;
    ttlSeconds: number;
  };
};

export const HOUSING_SOURCE_LABELS: Record<HousingListingSource, string> = {
  rentcast: "RentCast",
  zillow_group: "Zillow Group / Bridge",
  trulia: "Trulia licensed feed",
  craigslist: "Craigslist import",
  mls_reso: "Licensed MLS / RESO",
  user_import: "User import",
  illustrative: "Illustrative example",
};

export function formatHousingPrice(listing: Pick<HousingListing, "price" | "tenure">) {
  const price = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "USD",
  }).format(listing.price);

  return listing.tenure === "rent" ? `${price}/mo` : price;
}

export function formatCompactHousingPrice(price: number) {
  if (price >= 1_000_000) {
    return `$${(price / 1_000_000).toFixed(price >= 10_000_000 ? 0 : 1)}m`;
  }

  if (price >= 10_000) {
    return `$${Math.round(price / 1_000)}k`;
  }

  if (price >= 1_000) {
    const roundedThousands = Math.round(price / 100) / 10;
    return `$${roundedThousands.toFixed(1)}k`;
  }

  return `$${Math.round(price)}`;
}

export type ParsedHousingCsv = {
  listings: HousingListing[];
  skippedRows: number;
  warnings: string[];
};

export function parseHousingListingsCsv(csv: string): ParsedHousingCsv {
  const rows = parseCsvRows(csv).filter((row) => row.some((cell) => cell.trim()));

  if (rows.length < 2) {
    return {
      listings: [],
      skippedRows: Math.max(0, rows.length - 1),
      warnings: ["Listing CSV needs a header and at least one data row."],
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const index = (aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const columns = {
    title: index(["title", "name", "listing", "property"]),
    address: index(["address", "formatted_address", "full_address"]),
    lat: index(["lat", "latitude"]),
    lng: index(["lng", "lon", "long", "longitude"]),
    price: index(["price", "rent", "monthly_rent", "list_price"]),
    tenure: index(["tenure", "listing_type", "transaction_type"]),
    bedrooms: index(["bedrooms", "beds", "br"]),
    bathrooms: index(["bathrooms", "baths", "ba"]),
    squareFeet: index(["square_feet", "squarefootage", "sqft", "area"]),
    propertyType: index(["property_type", "home_type", "type"]),
    source: index(["source", "provider", "site"]),
    sourceUrl: index(["source_url", "url", "listing_url"]),
  };

  if (columns.lat < 0 || columns.lng < 0 || columns.price < 0) {
    return {
      listings: [],
      skippedRows: rows.length - 1,
      warnings: ["Listing CSV requires latitude, longitude, and price columns."],
    };
  }

  const listings: HousingListing[] = [];
  let skippedRows = 0;

  rows.slice(1).forEach((row, rowIndex) => {
    const lat = numberCell(row, columns.lat);
    const lng = numberCell(row, columns.lng);
    const price = currencyCell(row, columns.price);

    if (
      lat === undefined ||
      lng === undefined ||
      price === undefined ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      price <= 0
    ) {
      skippedRows += 1;
      return;
    }

    const sourceText = stringCell(row, columns.source);
    const source = importedSource(sourceText);
    const address = stringCell(row, columns.address);
    const title = stringCell(row, columns.title) || address || `Imported home ${rowIndex + 1}`;
    const tenureText = stringCell(row, columns.tenure)?.toLowerCase();
    const tenure: HousingTenure = tenureText?.includes("sale") ? "sale" : "rent";
    const sourceLabel = sourceText?.trim()
      ? `Imported ${canonicalImportedSourceLabel(source, sourceText)}`
      : HOUSING_SOURCE_LABELS[source];

    listings.push({
      id: `housing-import-${rowIndex + 1}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
      title,
      address,
      location: { lat, lng },
      tenure,
      price,
      bedrooms: numberCell(row, columns.bedrooms),
      bathrooms: numberCell(row, columns.bathrooms),
      squareFeet: numberCell(row, columns.squareFeet),
      propertyType: stringCell(row, columns.propertyType),
      source,
      sourceLabel,
      sourceUrl: safeHttpUrl(stringCell(row, columns.sourceUrl)),
      confidence: "medium",
      provenance: {
        access: "user-provided",
        label: "User-provided CSV",
        note: "MapGap did not retrieve or verify this listing.",
        observedAt: new Date().toISOString(),
      },
    });
  });

  return {
    listings,
    skippedRows,
    warnings:
      skippedRows > 0
        ? [`${skippedRows} row${skippedRows === 1 ? " was" : "s were"} skipped because required values were invalid.`]
        : [],
  };
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function stringCell(row: string[], index: number) {
  if (index < 0) return undefined;
  const value = row[index]?.trim();
  return value || undefined;
}

function numberCell(row: string[], index: number) {
  const value = stringCell(row, index);
  if (!value) return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function currencyCell(row: string[], index: number) {
  const value = stringCell(row, index);
  if (!value) return undefined;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function importedSource(value?: string): HousingListingSource {
  const normalized = value?.toLowerCase() || "";

  if (normalized.includes("zillow")) return "zillow_group";
  if (normalized.includes("trulia")) return "trulia";
  if (normalized.includes("craigslist")) return "craigslist";
  if (normalized.includes("mls") || normalized.includes("reso")) return "mls_reso";
  return "user_import";
}

function canonicalImportedSourceLabel(source: HousingListingSource, fallback: string) {
  switch (source) {
    case "zillow_group":
      return "Zillow";
    case "trulia":
      return "Trulia";
    case "craigslist":
      return "Craigslist";
    case "mls_reso":
      return "MLS / RESO";
    default:
      return fallback.trim();
  }
}

function safeHttpUrl(value?: string) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
