import {processGeojson} from "@kepler.gl/processors";
import type {
  AnalysisFeatureCollectionV1,
  AnalysisGeometryV1,
  MapGapAnalysisBundleV1,
  MapGapProjectV1,
} from "@mapgap/project-contract";
import {
  ANALYSIS_BUNDLE_DATASET_IDS,
  COMPARISON_PRESENTATION_DATASET_IDS,
  type AnalysisLayerAvailability,
} from "../map/comparison-config";
import type {SharedMapSelection} from "../map/comparison-runtime";

export type AnalysisKeplerDataset = {
  info: {id: string; label: string};
  data: NonNullable<ReturnType<typeof processGeojson>>;
};

const RENDERED_ANALYSIS_IDS = new Set<string>(Object.values(ANALYSIS_BUNDLE_DATASET_IDS));

/** Converts only bounded inline GeoJSON datasets; source tables remain lineage, not Redux payloads. */
export function analysisBundleToKeplerDatasets(bundle: MapGapAnalysisBundleV1): AnalysisKeplerDataset[] {
  return bundle.datasets.flatMap((dataset) => {
    if (!RENDERED_ANALYSIS_IDS.has(dataset.descriptor.id)) return [];
    if (dataset.descriptor.representation.kind !== "inline-geojson") return [];
    const data = processGeojson(dataset.data as AnalysisFeatureCollectionV1);
    if (!data) throw new Error(`Could not process analysis dataset ${dataset.descriptor.id} as GeoJSON.`);
    return [{
      info: {id: dataset.descriptor.id, label: dataset.descriptor.label},
      data,
    }];
  });
}

export function getAnalysisLayerAvailability(
  bundle: MapGapAnalysisBundleV1,
): AnalysisLayerAvailability {
  const ids = new Set(bundle.datasets.map((dataset) => dataset.descriptor.id));
  return {
    accessSurface: ids.has(ANALYSIS_BUNDLE_DATASET_IDS.accessSurface),
    housingAreas: ids.has(ANALYSIS_BUNDLE_DATASET_IDS.housingAreas),
    housingCandidates: ids.has(ANALYSIS_BUNDLE_DATASET_IDS.housingCandidates),
    selection: true,
  };
}

export type CanonicalSelection = {
  id: string;
  label: string;
  datasetId: string;
  geometry: AnalysisGeometryV1;
  properties: Readonly<Record<string, unknown>>;
};

export function getInitialSelection(project: MapGapProjectV1): CanonicalSelection {
  const candidate = project.candidates[0];
  if (candidate) {
    return {
      id: candidate.id,
      label: candidate.label,
      datasetId: "mapgap-candidates-v1",
      geometry: cloneJson(candidate.geometry),
      properties: {
        id: candidate.id,
        label: candidate.label,
        totalScore: candidate.score?.total,
        failedConstraints: candidate.score?.failedConstraints.map((constraint) => constraint.label).join(", "),
      },
    };
  }
  const asset = project.civic.assets[0];
  if (asset) {
    return {
      id: asset.id,
      label: asset.name,
      datasetId: "mapgap-assets-v1",
      geometry: cloneJson(asset.geometry),
      properties: {id: asset.id, name: asset.name, capacity: asset.capacity},
    };
  }
  const point = project.points[0];
  if (!point) throw new Error("A comparison project requires at least one selectable geometry.");
  return {
    id: point.id,
    label: point.name,
    datasetId: "mapgap-points-v1",
    geometry: cloneJson(point.geometry),
    properties: {id: point.id, name: point.name},
  };
}

export function sharedSelectionToCanonical(
  selection: SharedMapSelection,
  fallback: CanonicalSelection,
): CanonicalSelection {
  const geometry = selection.geometry && isAnalysisGeometry(selection.geometry)
    ? cloneJson(selection.geometry)
    : selection.coordinate
      ? {type: "Point" as const, coordinates: [...selection.coordinate] as [number, number]}
      : fallback.geometry;
  const labelValue = selection.properties.label ?? selection.properties.name ?? selection.properties.geoid;
  return {
    id: selection.id,
    label: typeof labelValue === "string" ? labelValue : selection.id,
    datasetId: inferDatasetId(selection.layerId),
    geometry,
    properties: selection.properties,
  };
}

export function selectionToKeplerDataset(selection: CanonicalSelection): AnalysisKeplerDataset {
  const collection: AnalysisFeatureCollectionV1 = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      id: selection.id,
      geometry: cloneJson(selection.geometry),
      properties: {
        entityId: selection.id,
        label: selection.label,
        selectionKind: selection.geometry.type === "Point" ? "Selected location" : "Selected area",
      },
    }],
  };
  const data = processGeojson(collection);
  if (!data) throw new Error("Could not process the shared selection overlay.");
  return {
    info: {id: COMPARISON_PRESENTATION_DATASET_IDS.selection, label: "Shared selection"},
    data,
  };
}

export function findAnalysisFeature(
  bundle: MapGapAnalysisBundleV1,
  id: string,
): CanonicalSelection | null {
  // A GEOID can exist in retained TIGER source geometry and in the joined
  // render layer. Prefer the analyst-facing materialization so selection keeps
  // the housing measures instead of stopping at source-only geometry.
  const datasets = [...bundle.datasets].sort((left, right) =>
    selectionPriority(left.descriptor.role) - selectionPriority(right.descriptor.role),
  );
  for (const dataset of datasets) {
    if (dataset.descriptor.representation.kind !== "inline-geojson") continue;
    const feature = (dataset.data as AnalysisFeatureCollectionV1).features.find((entry) => {
      const primary = entry.properties[dataset.descriptor.primaryKey];
      return String(primary ?? entry.id ?? "") === id;
    });
    if (!feature) continue;
    const labelValue = feature.properties.label ?? feature.properties.name ?? feature.properties.geoid;
    return {
      id,
      label: typeof labelValue === "string" ? labelValue : id,
      datasetId: dataset.descriptor.id,
      geometry: cloneJson(feature.geometry),
      properties: {...feature.properties},
    };
  }
  return null;
}

function selectionPriority(role: string) {
  if (role === "location-intelligence" || role === "candidate") return 0;
  if (role === "access-surface") return 1;
  return 2;
}

function inferDatasetId(layerId?: string) {
  if (layerId?.includes("housing")) return ANALYSIS_BUNDLE_DATASET_IDS.housingAreas;
  if (layerId?.includes("access-surface")) return ANALYSIS_BUNDLE_DATASET_IDS.accessSurface;
  if (layerId?.includes("candidate")) return "mapgap-candidates-v1";
  if (layerId?.includes("asset")) return "mapgap-assets-v1";
  return "mapgap-presentation-selection-source";
}

function isAnalysisGeometry(value: SharedMapSelection["geometry"]): value is AnalysisGeometryV1 {
  return value?.type === "Point" || value?.type === "Polygon" || value?.type === "MultiPolygon";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
