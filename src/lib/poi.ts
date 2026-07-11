import { POINT_COLORS } from "../constants";
import type { MapPoint, PoiCategory, PoiLayer, PointOfInterest } from "../types";

export const POI_CATEGORY_LABELS: Record<PoiCategory, string> = {
  grocery: "Grocery",
  bookstore: "Bookstores",
  laundry: "Laundry",
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
  transit: "Transit",
  custom: "Custom",
};

export const PRIMARY_POI_CATEGORIES: PoiCategory[] = [
  "grocery",
  "bookstore",
  "laundry",
  "fresh-produce",
  "farmers-market",
  "butcher",
];

export function labelForPoiSearch(category: PoiCategory, query?: string) {
  return query?.trim() || POI_CATEGORY_LABELS[category];
}

export function poiToMapPoint(point: PointOfInterest, index: number, prefix = "poi"): MapPoint {
  return {
    id: `${prefix}-${point.id}`,
    name: point.name,
    address: point.address,
    lat: point.lat,
    lng: point.lng,
    color: POINT_COLORS[index % POINT_COLORS.length],
    createdAt: new Date().toISOString(),
  };
}

export function layerToMapPoints(layer: PoiLayer) {
  return layer.points.map((point, index) => poiToMapPoint(point, index, `layer-${layer.id}`));
}

export function layersToMapPoints(layers: PoiLayer[]) {
  return layers.flatMap((layer) =>
    layer.visible
      ? layer.points.map((point, index) => poiToMapPoint(point, index, `layer-${layer.id}`))
      : [],
  );
}
