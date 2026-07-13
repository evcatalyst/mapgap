import type {
  MapBounds,
  MapPoint,
  ServicePoint,
  ServicePointCategory,
  ServicePointSource,
} from "../types";

export const SERVICE_POINT_CATEGORY_LABELS: Record<ServicePointCategory, string> = {
  laundry: "Laundry",
  coffee: "Coffee",
  grocery: "Groceries",
  library: "Libraries",
  custom: "Custom",
};

export const SERVICE_POINT_SOURCE_LABELS: Record<ServicePointSource, string> = {
  google_places: "Google Places",
  ny_libraries: "NY Open Data",
  nj_libraries: "NJ Open Data",
  hybrid: "Open Data",
  openstreetmap: "OpenStreetMap",
  official_local: "Town verified",
};

export const SERVICE_POINT_COLORS: Record<ServicePointCategory, string> = {
  laundry: "#0ea5e9",
  coffee: "#a16207",
  grocery: "#16a34a",
  library: "#7c3aed",
  custom: "#0f766e",
};

const EARTH_RADIUS_METERS = 6_371_000;

export function getBoundsCenter(bounds?: MapBounds) {
  if (!bounds) {
    return undefined;
  }

  return {
    lat: (bounds.south + bounds.north) / 2,
    lng: (bounds.west + bounds.east) / 2,
  };
}

export function getDistanceMiles(
  from: { lat: number; lng: number } | undefined,
  to: { lat: number; lng: number },
) {
  if (!from) {
    return undefined;
  }

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return (EARTH_RADIUS_METERS * c) / 1609.344;
}

export function formatDistanceMiles(value?: number) {
  if (value === undefined) {
    return undefined;
  }

  if (value < 0.1) {
    return "<0.1 mi";
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} mi`;
}

export function servicePointToMapPoint(point: ServicePoint, index: number): MapPoint {
  return {
    id: point.id,
    name: point.name,
    lat: point.location.lat,
    lng: point.location.lng,
    address: point.address,
    color: SERVICE_POINT_COLORS[point.category],
    createdAt: new Date().toISOString(),
    assetType: point.category,
    capacity: index + 1,
  };
}

export function servicePointsToGeoJson(points: ServicePoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((point) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [point.location.lng, point.location.lat],
      },
      properties: {
        id: point.id,
        name: point.name,
        category: point.category,
        categoryLabel: point.categoryLabel,
        source: point.source,
        address: point.address,
        confidence: point.confidence,
      },
    })),
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
