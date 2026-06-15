import { MOBILITY_MODES } from "../constants";
import { SLOPE_HEATMAP_CELLS } from "../data/slopeDemo";
import type { LatLng, MapPoint, MobilityMode, SlopeSeverity } from "../types";

const EARTH_RADIUS_METERS = 6_371_000;

export function getSlopeColor(intensity: number) {
  if (intensity >= 0.72) {
    return "#ef4444";
  }

  if (intensity >= 0.42) {
    return "#f59e0b";
  }

  return "#22c55e";
}

export function getSlopeLabel(severity: SlopeSeverity) {
  if (severity === "steep") {
    return "Steep";
  }

  if (severity === "moderate") {
    return "Moderate";
  }

  return "Flat";
}

export function distanceMeters(a: LatLng, b: LatLng) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function estimateSlopeBurden(location: LatLng) {
  const weighted = SLOPE_HEATMAP_CELLS.reduce(
    (acc, cell) => {
      const distance = distanceMeters(location, cell);
      const influence = Math.max(0, 1 - distance / (cell.radiusMeters * 1.7));

      return {
        weight: acc.weight + influence,
        burden: acc.burden + influence * cell.intensity,
      };
    },
    { burden: 0, weight: 0 },
  );

  if (weighted.weight === 0) {
    return 0.18;
  }

  return Math.min(0.95, Math.max(0.08, weighted.burden / weighted.weight));
}

export function getEffortAdjustedMinutes(
  point: MapPoint,
  timeMinutes: number,
  mobilityMode: MobilityMode,
) {
  const mode = MOBILITY_MODES[mobilityMode];
  const slopeBurden = estimateSlopeBurden(point);
  const penalty = Math.min(0.62, slopeBurden * mode.slopeSensitivity);
  const adjustedMinutes = Math.max(
    3,
    Math.round(timeMinutes * mode.rangeMultiplier * (1 - penalty)),
  );

  return {
    adjustedMinutes,
    effortScore: Math.round(
      (slopeBurden * mode.slopeSensitivity + (1 - mode.rangeMultiplier)) * 100,
    ),
    slopeBurden,
  };
}

export function getIsochroneOpacity(mobilityMode: MobilityMode, effortScore: number) {
  const base = mobilityMode === "bike" ? 0.19 : 0.24;
  return Math.min(0.38, base + effortScore / 700);
}
