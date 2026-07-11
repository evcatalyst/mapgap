/**
 * Presentation policy for the V3 scale tiers. It prevents a caller from
 * accidentally hydrating a national dataset as a million-feature GeoJSON
 * object in React/Redux state.
 */
export type ScaleStrategy =
  | { kind: "direct-geojson"; maximumFeatures: 50_000 }
  | { kind: "arrow-or-query"; maximumFeatures: 1_000_000 }
  | { kind: "tiled"; maximumFeatures: number };

export function selectScaleStrategy(featureCount: number): ScaleStrategy {
  if (!Number.isFinite(featureCount) || featureCount < 0) {
    throw new Error("featureCount must be a non-negative finite number.");
  }
  if (featureCount <= 50_000) return { kind: "direct-geojson", maximumFeatures: 50_000 };
  if (featureCount <= 1_000_000) return { kind: "arrow-or-query", maximumFeatures: 1_000_000 };
  return { kind: "tiled", maximumFeatures: Number.POSITIVE_INFINITY };
}
