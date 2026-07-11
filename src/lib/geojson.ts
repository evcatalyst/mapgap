import type {
  IsochroneCollection,
  MapPoint,
  PointsFeatureCollection,
} from "../types";

export function pointsToGeoJson(points: MapPoint[]): PointsFeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lng, point.lat],
      },
      properties: {
        id: point.id,
        name: point.name,
        address: point.address,
        assetType: point.assetType,
        capacity: point.capacity,
        hoursOpen: point.hoursOpen,
        utilization: point.utilization,
        staffing: point.staffing,
        annualCost: point.annualCost,
        fundingSource: point.fundingSource,
        color: point.color,
        createdAt: point.createdAt,
      },
    })),
  };
}

export function buildMapIsoGeoJson(points: MapPoint[], isochrones: IsochroneCollection) {
  return {
    type: "FeatureCollection",
    features: [...pointsToGeoJson(points).features, ...isochrones],
  };
}
