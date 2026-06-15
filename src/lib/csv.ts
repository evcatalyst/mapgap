import type { MapPoint } from "../types";

function escapeCsv(value: string | number | undefined) {
  const normalized = String(value ?? "");
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function buildPointsCsv(points: MapPoint[]) {
  const headers = ["id", "name", "latitude", "longitude", "address", "created_at"];
  const rows = points.map((point) => [
    point.id,
    point.name,
    point.lat.toFixed(6),
    point.lng.toFixed(6),
    point.address,
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
}> {
  const rows = csv
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const first = rows[0].toLowerCase();
  const dataRows = first.includes("lat") || first.includes("latitude") ? rows.slice(1) : rows;

  return dataRows.flatMap((row) => {
      const columns = splitCsvRow(row);
      const lat = Number(columns[0]);
      const lng = Number(columns[1]);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return [];
      }

      return [{
        lat,
        lng,
        name: columns[2] || undefined,
        address: columns[3] || undefined,
      }];
    });
}

function splitCsvRow(row: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const next = row[index + 1];

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
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}
