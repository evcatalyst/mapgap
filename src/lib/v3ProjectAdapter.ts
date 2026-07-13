import {
  assertProjectV1,
  type AreaGeometryV1,
  type CandidateScoreV1,
  type CivicAssetV1,
  type DecisionConstraintV1,
  type DecisionProfileV1,
  type MapGapProjectV1,
  type PoiLayerV1,
  type ProjectPointV1,
  type ProvenanceV1,
  type RoutedAccessPolygonV1,
  type UnderservedAreaV1,
} from "../../packages/project-contract/src";
import type { CandidateHome, HouseholdProfile } from "../domain/decisionTypes";
import type {
  AppSettings,
  IsochroneCollection,
  MapPoint,
  PoiLayer,
  ScenarioId,
} from "../types";

/**
 * The narrow, read-only V2 seam. Do not pass Zustand state itself across the
 * version boundary: it contains UI state and a locally stored routing secret.
 */
export type V2ProjectSource = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  settings: Pick<
    AppSettings,
    "selectedScenario" | "routingProvider" | "transportMode" | "mobilityMode" | "timeMinutes"
  >;
  decisionProfile: HouseholdProfile;
  points: MapPoint[];
  poiLayers: PoiLayer[];
  isochrones: IsochroneCollection;
  candidateHomes: CandidateHome[];
  underservedAreas?: UnderservedAreaV1[];
};

/**
 * Versioned, one-way V2 -> portable project adapter. This intentionally never
 * accepts or returns V2 state setters and never includes valhallaAccessSecret.
 */
export function projectFromV2(source: V2ProjectSource): MapGapProjectV1 {
  const now = source.updatedAt ?? new Date().toISOString();
  const scenarioId = source.settings.selectedScenario ?? source.decisionProfile.scenarioId;
  const points = source.points.map(toProjectPoint);
  const assets = source.points.filter(hasAssetMetadata).map(toCivicAsset);

  return assertProjectV1({
    schemaVersion: "mapgap-project/v1",
    id: source.id,
    createdAt: source.createdAt ?? now,
    updatedAt: now,
    scenario: {
      id: scenarioId,
      label: scenarioLabel(scenarioId),
    },
    routing: {
      provider: source.settings.routingProvider,
      transportMode: source.settings.transportMode,
      mobilityMode: source.settings.mobilityMode,
      timeMinutes: source.settings.timeMinutes,
    },
    profile: toDecisionProfile(source.decisionProfile),
    points,
    poiLayers: source.poiLayers.map(toPoiLayer),
    isochrones: source.isochrones.map(toRoutedAccessPolygon),
    candidates: source.candidateHomes.map((candidate, index) => ({
      id: candidate.id,
      label: candidate.label,
      source: candidate.source,
      geometry: { type: "Point", coordinates: [candidate.lng, candidate.lat] },
      rank: index + 1,
      score: candidate.score ? toCandidateScore(candidate.score) : undefined,
      provenance: {
        sourceType: candidate.source === "import" || candidate.source === "listing" ? "import" : "system",
        label:
          candidate.source === "grid"
            ? "MapGap V2 deterministic candidate grid"
            : `MapGap V2 candidate (${candidate.source})`,
        confidence: candidate.source === "grid" ? "medium" : "unverified",
      },
    })),
    civic: {
      assets,
      underservedAreas: source.underservedAreas ?? [],
    },
    provenance: uniqueProvenance([
      ...points.map((point) => point.provenance),
      ...assets.map((asset) => asset.provenance),
      ...source.poiLayers.flatMap((layer) => layer.points.map((point) => toPoiProvenance(point, layer))),
      ...source.isochrones.map((isochrone) => toIsochroneProvenance(isochrone)),
      ...(source.underservedAreas ?? []).map((area) => area.provenance),
    ]),
  });
}

export function normalizeV2Utilization(value?: string, capacity?: number) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const percent = normalized.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
  if (percent) return clamp(Number(percent[1]) / 100, 0, 1);

  const fraction = normalized.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (fraction && Number(fraction[2]) > 0) return clamp(Number(fraction[1]) / Number(fraction[2]), 0, 1);

  const number = Number(normalized);
  if (Number.isFinite(number)) {
    if (number >= 0 && number <= 1) return number;
    if (number >= 0 && number <= 100) return number / 100;
    if (capacity && capacity > 0) return clamp(number / capacity, 0, 1);
  }

  return undefined;
}

function toProjectPoint(point: MapPoint): ProjectPointV1 {
  return {
    id: point.id,
    name: point.name,
    geometry: { type: "Point", coordinates: [point.lng, point.lat] },
    address: point.address,
    color: point.color,
    createdAt: point.createdAt,
    provenance: pointProvenance(point),
  };
}

function toCivicAsset(point: MapPoint): CivicAssetV1 {
  return {
    id: point.id,
    pointId: point.id,
    name: point.name,
    assetType: point.assetType || "Unclassified asset",
    geometry: { type: "Point", coordinates: [point.lng, point.lat] },
    capacity: point.capacity,
    utilizationRate: normalizeV2Utilization(point.utilization, point.capacity),
    sourceUtilization: point.utilization,
    hoursOpen: point.hoursOpen,
    staffing: point.staffing,
    annualCost: point.annualCost,
    fundingSource: point.fundingSource,
    provenance: pointProvenance(point),
  };
}

function pointProvenance(point: MapPoint): ProvenanceV1 {
  return {
    sourceType: point.assetType || point.capacity !== undefined ? "import" : "user",
    label: point.assetType || point.capacity !== undefined ? "MapGap V2 imported asset" : "MapGap V2 user point",
    updatedAt: point.createdAt,
    confidence: "unverified",
  };
}

function toPoiLayer(layer: PoiLayer): PoiLayerV1 {
  return {
    id: layer.id,
    label: layer.label,
    category: layer.category,
    query: layer.query,
    source: layer.source,
    visible: layer.visible,
    createdAt: layer.createdAt,
    truncated: layer.truncated,
    message: layer.message,
    points: layer.points.map((point) => ({
      id: point.id,
      name: point.name,
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      category: point.category,
      source: point.source,
      sourceId: point.sourceId,
      address: point.address,
      rating: point.rating,
      userRatingCount: point.userRatingCount,
      tags: point.tags,
      provenance: toPoiProvenance(point, layer),
    })),
  };
}

function toPoiProvenance(point: PoiLayer["points"][number], layer: PoiLayer): ProvenanceV1 {
  return {
    sourceType: point.source === "open-data" ? "open-data" : "import",
    label: `${layer.label} via ${point.source}`,
    datasetId: point.sourceId,
    updatedAt: layer.createdAt,
    confidence: "unverified",
  };
}

function toRoutedAccessPolygon(feature: IsochroneCollection[number]): RoutedAccessPolygonV1 {
  return {
    id: feature.properties.id,
    pointId: feature.properties.pointId,
    pointName: feature.properties.pointName,
    color: feature.properties.color,
    geometry: feature.geometry as AreaGeometryV1,
    timeMinutes: feature.properties.timeMinutes,
    bucketMinutes: feature.properties.bucketMinutes,
    adjustedMinutes: feature.properties.adjustedMinutes,
    effortScore: feature.properties.effortScore,
    mobilityMode: feature.properties.mobilityMode,
    transportMode: feature.properties.transportMode,
    routingProvider: feature.properties.routingProvider,
    isochroneMode: feature.properties.isochroneMode,
    provenance: toIsochroneProvenance(feature),
  };
}

function toIsochroneProvenance(feature: IsochroneCollection[number]): ProvenanceV1 {
  return {
    sourceType: "routing-provider",
    label: `${feature.properties.routingProvider} routed access polygon`,
    datasetId: feature.properties.pointId,
    confidence: "medium",
  };
}

function toDecisionProfile(profile: HouseholdProfile): DecisionProfileV1 {
  return {
    id: profile.id,
    name: profile.name,
    scenarioId: profile.scenarioId,
    regionLabel: profile.regionLabel,
    anchors: profile.anchors.map((anchor) => ({
      id: anchor.id,
      name: anchor.name,
      category: anchor.category,
      priority: anchor.priority,
      address: anchor.address,
      geometry: { type: "Point", coordinates: [anchor.lng, anchor.lat] },
    })),
    constraints: profile.constraints.map(
      (constraint) => JSON.parse(JSON.stringify(constraint)) as DecisionConstraintV1,
    ),
    weights: { ...profile.weights },
  };
}

function toCandidateScore(score: NonNullable<CandidateHome["score"]>): CandidateScoreV1 {
  return {
    total: score.total,
    band: score.band,
    components: score.components.map((component) => ({
      key: component.key,
      label: component.label,
      value: component.value,
      explanation: component.explanation,
    })),
    failedConstraints: score.failedConstraints.map((constraint) => ({
      constraintType: constraint.constraintType,
      label: constraint.label,
      explanation: constraint.explanation,
    })),
    assumptions: score.assumptions.map((assumption) => ({
      id: assumption.id,
      label: assumption.label,
      value: assumption.value,
      source: assumption.source,
    })),
  };
}

function hasAssetMetadata(point: MapPoint) {
  return Boolean(
    point.assetType ||
      point.capacity !== undefined ||
      point.utilization ||
      point.staffing ||
      point.annualCost !== undefined ||
      point.fundingSource,
  );
}

function scenarioLabel(scenario: ScenarioId) {
  return scenario
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueProvenance(items: ProvenanceV1[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
