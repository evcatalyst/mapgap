import type { MapPoint } from "../types";

function escapeCsv(value: string | number | undefined) {
  const normalized = String(value ?? "");
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function buildPointsCsv(points: MapPoint[]) {
  const headers = [
    "id",
    "name",
    "latitude",
    "longitude",
    "address",
    "asset_type",
    "capacity",
    "hours_open",
    "utilization",
    "staffing",
    "annual_cost",
    "funding_source",
    "created_at",
  ];
  const rows = points.map((point) => [
    point.id,
    point.name,
    point.lat.toFixed(6),
    point.lng.toFixed(6),
    point.address,
    point.assetType,
    point.capacity,
    point.hoursOpen,
    point.utilization,
    point.staffing,
    point.annualCost,
    point.fundingSource,
    point.createdAt,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}

export function exportPointsCsv(points: MapPoint[]) {
  const csv = buildPointsCsv(points);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  link.href = url;
  link.download = `mapgap-points-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parsePointsCsv(csv: string): Array<{
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  assetType?: string;
  capacity?: number;
  hoursOpen?: string;
  utilization?: string;
  staffing?: string;
  annualCost?: number;
  fundingSource?: string;
}> {
  return parsePointsCsvDetailed(csv).points;
}

export type ParsedPointsCsv = {
  points: Array<{
    lat: number;
    lng: number;
    name?: string;
    address?: string;
    assetType?: string;
    capacity?: number;
    hoursOpen?: string;
    utilization?: string;
    staffing?: string;
    annualCost?: number;
    fundingSource?: string;
  }>;
  skippedRows: number;
  detectedColumns: {
    lat?: string;
    lng?: string;
    name?: string;
    address?: string;
    type?: string;
    capacity?: string;
    hours?: string;
    utilization?: string;
    staffing?: string;
    annualCost?: string;
    fundingSource?: string;
  };
};

export function parsePointsCsvDetailed(csv: string): ParsedPointsCsv {
  const rows = parseCsvRows(csv).filter((row) => row.some((cell) => cell.trim()));

  if (rows.length === 0) {
    return {
      points: [],
      skippedRows: 0,
      detectedColumns: {},
    };
  }

  const headerInfo = detectHeader(rows[0]);
  const header = headerInfo.hasHeader ? rows[0] : undefined;
  const dataRows = headerInfo.hasHeader ? rows.slice(1) : rows;
  const mapping = header
    ? detectColumnMapping(header)
    : {
        latIndex: 0,
        lngIndex: 1,
        nameIndex: 2,
        addressIndex: 3,
      };
  const points: ParsedPointsCsv["points"] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    const lat = parseCoordinate(row[mapping.latIndex]);
    const lng = parseCoordinate(row[mapping.lngIndex]);

    if (lat === undefined || lng === undefined) {
      skippedRows += 1;
      continue;
    }

    const name = firstPresent([
      getCell(row, mapping.nameIndex),
      getCell(row, mapping.facilityIndex),
      getCell(row, mapping.siteIndex),
      getCell(row, mapping.organizationIndex),
    ]);
    const address = buildAddress(row, mapping);
    const assetType = getCell(row, mapping.typeIndex);
    const capacity = parseCapacity(getCell(row, mapping.capacityIndex));
    const hoursOpen = getCell(row, mapping.hoursIndex);
    const utilization = getCell(row, mapping.utilizationIndex);
    const staffing = getCell(row, mapping.staffingIndex);
    const annualCost = parseCurrency(getCell(row, mapping.annualCostIndex));
    const fundingSource = getCell(row, mapping.fundingSourceIndex);

    points.push({
      lat,
      lng,
      name: name || undefined,
      address: address || undefined,
      assetType,
      capacity,
      hoursOpen,
      utilization,
      staffing,
      annualCost,
      fundingSource,
    });
  }

  return {
    points,
    skippedRows,
    detectedColumns: {
      lat: labelForColumn(header, mapping.latIndex),
      lng: labelForColumn(header, mapping.lngIndex),
      name: labelForColumn(header, mapping.nameIndex),
      address: labelForColumn(header, mapping.addressIndex),
      type: labelForColumn(header, mapping.typeIndex),
      capacity: labelForColumn(header, mapping.capacityIndex),
      hours: labelForColumn(header, mapping.hoursIndex),
      utilization: labelForColumn(header, mapping.utilizationIndex),
      staffing: labelForColumn(header, mapping.staffingIndex),
      annualCost: labelForColumn(header, mapping.annualCostIndex),
      fundingSource: labelForColumn(header, mapping.fundingSourceIndex),
    },
  };
}

type ColumnMapping = {
  latIndex: number;
  lngIndex: number;
  nameIndex?: number;
  facilityIndex?: number;
  siteIndex?: number;
  organizationIndex?: number;
  addressIndex?: number;
  streetIndex?: number;
  cityIndex?: number;
  stateIndex?: number;
  zipIndex?: number;
  typeIndex?: number;
  capacityIndex?: number;
  hoursIndex?: number;
  utilizationIndex?: number;
  staffingIndex?: number;
  annualCostIndex?: number;
  fundingSourceIndex?: number;
};

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  latIndex: ["lat", "latitude", "y", "y_coord", "y_coordinate", "asset_latitude"],
  lngIndex: [
    "lng",
    "lon",
    "long",
    "longitude",
    "x",
    "x_coord",
    "x_coordinate",
    "asset_longitude",
  ],
  nameIndex: ["name", "asset_name", "location_name", "place_name"],
  facilityIndex: ["facility", "facility_name", "site_name", "center_name"],
  siteIndex: ["site", "site_label", "asset"],
  organizationIndex: ["organization", "agency", "operator", "provider"],
  addressIndex: ["address", "full_address", "formatted_address", "street_address"],
  streetIndex: ["street", "street_address", "addr", "address_1"],
  cityIndex: ["city", "municipality", "town"],
  stateIndex: ["state", "province", "region"],
  zipIndex: ["zip", "zipcode", "postal_code", "postcode"],
  typeIndex: ["type", "asset_type", "category", "facility_type", "use"],
  capacityIndex: ["capacity", "seats", "computers", "slots", "service_capacity"],
  hoursIndex: ["hours", "hours_open", "open_hours", "operating_hours", "schedule"],
  utilizationIndex: [
    "utilization",
    "usage",
    "attendance",
    "visits",
    "annual_visits",
    "participation",
    "occupancy",
  ],
  staffingIndex: ["staffing", "staff", "fte", "employees", "staff_count"],
  annualCostIndex: ["annual_cost", "cost", "operating_cost", "budget", "annual_budget"],
  fundingSourceIndex: ["funding", "funding_source", "fund_source", "grant", "grant_source"],
};

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current.trim());
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  rows.push(row);

  return rows;
}

function detectHeader(row: string[]) {
  const normalized = row.map(normalizeHeader);
  const hasHeader =
    normalized.some((cell) => COLUMN_ALIASES.latIndex.includes(cell)) &&
    normalized.some((cell) => COLUMN_ALIASES.lngIndex.includes(cell));

  return { hasHeader };
}

function detectColumnMapping(header: string[]): ColumnMapping {
  return {
    latIndex: findRequiredColumnIndex(header, COLUMN_ALIASES.latIndex, 0),
    lngIndex: findRequiredColumnIndex(header, COLUMN_ALIASES.lngIndex, 1),
    nameIndex: findColumnIndex(header, COLUMN_ALIASES.nameIndex),
    facilityIndex: findColumnIndex(header, COLUMN_ALIASES.facilityIndex),
    siteIndex: findColumnIndex(header, COLUMN_ALIASES.siteIndex),
    organizationIndex: findColumnIndex(header, COLUMN_ALIASES.organizationIndex),
    addressIndex: findColumnIndex(header, COLUMN_ALIASES.addressIndex),
    streetIndex: findColumnIndex(header, COLUMN_ALIASES.streetIndex),
    cityIndex: findColumnIndex(header, COLUMN_ALIASES.cityIndex),
    stateIndex: findColumnIndex(header, COLUMN_ALIASES.stateIndex),
    zipIndex: findColumnIndex(header, COLUMN_ALIASES.zipIndex),
    typeIndex: findColumnIndex(header, COLUMN_ALIASES.typeIndex),
    capacityIndex: findColumnIndex(header, COLUMN_ALIASES.capacityIndex),
    hoursIndex: findColumnIndex(header, COLUMN_ALIASES.hoursIndex),
    utilizationIndex: findColumnIndex(header, COLUMN_ALIASES.utilizationIndex),
    staffingIndex: findColumnIndex(header, COLUMN_ALIASES.staffingIndex),
    annualCostIndex: findColumnIndex(header, COLUMN_ALIASES.annualCostIndex),
    fundingSourceIndex: findColumnIndex(header, COLUMN_ALIASES.fundingSourceIndex),
  };
}

function findColumnIndex(header: string[], aliases: string[], fallback?: number) {
  const normalized = header.map(normalizeHeader);
  const index = normalized.findIndex((item) => aliases.includes(item));

  return index >= 0 ? index : fallback;
}

function findRequiredColumnIndex(header: string[], aliases: string[], fallback: number) {
  const index = findColumnIndex(header, aliases, fallback);

  return index ?? fallback;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseCoordinate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().replace(/[^\d.+-]/g, "");
  const coordinate = Number(normalized);

  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function parseCapacity(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/\d+(?:\.\d+)?/);

  if (!match) {
    return undefined;
  }

  const capacity = Number(match[0]);

  return Number.isFinite(capacity) ? capacity : undefined;
}

function parseCurrency(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/[$,]/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    return undefined;
  }

  const amount = Number(match[0]);

  return Number.isFinite(amount) ? amount : undefined;
}

function getCell(row: string[], index: number | undefined) {
  if (index === undefined) {
    return undefined;
  }

  const value = row[index]?.trim();

  return value || undefined;
}

function firstPresent(values: Array<string | undefined>) {
  return values.find(Boolean);
}

function buildAddress(row: string[], mapping: ColumnMapping) {
  const directAddress = getCell(row, mapping.addressIndex);

  if (directAddress) {
    return directAddress;
  }

  return [
    getCell(row, mapping.streetIndex),
    getCell(row, mapping.cityIndex),
    getCell(row, mapping.stateIndex),
    getCell(row, mapping.zipIndex),
  ]
    .filter(Boolean)
    .join(", ");
}

function labelForColumn(header: string[] | undefined, index: number | undefined) {
  if (!header || index === undefined) {
    return undefined;
  }

  return header[index];
}
