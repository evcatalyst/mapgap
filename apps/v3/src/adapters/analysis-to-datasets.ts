import type {
  AnalysisFeatureCollectionV1,
  AnalysisGeometryV1,
  MapGapAnalysisBundleV1,
  MapGapProjectV1,
} from "@mapgap/project-contract";
import {MAPGAP_ANALYSIS_DATASET_IDS} from "@mapgap/project-contract";

export type AnalysisRenderDataset = {
  id: string;
  label: string;
  featureCollection: AnalysisFeatureCollectionV1;
  provenance: MapGapAnalysisBundleV1["datasets"][number]["provenance"];
  fields: MapGapAnalysisBundleV1["datasets"][number]["descriptor"]["fields"];
  geometryTypes: MapGapAnalysisBundleV1["datasets"][number]["descriptor"]["geometryTypes"];
};

/**
 * Renderer-neutral projection of bounded inline GeoJSON. Source tables remain
 * lineage and join evidence; they are not copied into the WebGL renderer.
 */
export function analysisBundleToRenderDatasets(bundle: MapGapAnalysisBundleV1): AnalysisRenderDataset[] {
  const renderedIds = new Set<string>([
    MAPGAP_ANALYSIS_DATASET_IDS.accessSurface,
    MAPGAP_ANALYSIS_DATASET_IDS.housingAreas,
    MAPGAP_ANALYSIS_DATASET_IDS.housingCandidates,
  ]);
  return bundle.datasets.flatMap((dataset) => {
    if (!renderedIds.has(dataset.descriptor.id) || dataset.descriptor.representation.kind !== "inline-geojson") return [];
    return [{
      id: dataset.descriptor.id,
      label: dataset.descriptor.label,
      featureCollection: cloneJson(dataset.data as AnalysisFeatureCollectionV1),
      provenance: cloneJson(dataset.provenance),
      fields: cloneJson(dataset.descriptor.fields),
      geometryTypes: cloneJson(dataset.descriptor.geometryTypes),
    }];
  });
}

export function getAnalysisLayerAvailability(bundle: MapGapAnalysisBundleV1) {
  const ids = new Set(bundle.datasets.map((dataset) => dataset.descriptor.id));
  return {
    accessSurface: ids.has(MAPGAP_ANALYSIS_DATASET_IDS.accessSurface),
    housingAreas: ids.has(MAPGAP_ANALYSIS_DATASET_IDS.housingAreas),
    housingCandidates: ids.has(MAPGAP_ANALYSIS_DATASET_IDS.housingCandidates),
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
  if (candidate) return {
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
  const asset = project.civic.assets[0];
  if (asset) return {
    id: asset.id,
    label: asset.name,
    datasetId: "mapgap-assets-v1",
    geometry: cloneJson(asset.geometry),
    properties: {id: asset.id, name: asset.name, capacity: asset.capacity},
  };
  const point = project.points[0];
  if (!point) throw new Error("An intelligence project requires at least one selectable geometry.");
  return {
    id: point.id,
    label: point.name,
    datasetId: "mapgap-points-v1",
    geometry: cloneJson(point.geometry),
    properties: {id: point.id, name: point.name},
  };
}

export function findAnalysisFeature(bundle: MapGapAnalysisBundleV1, id: string): CanonicalSelection | null {
  const datasets = [...bundle.datasets].sort((left, right) => selectionPriority(left.descriptor.role) - selectionPriority(right.descriptor.role));
  for (const dataset of datasets) {
    if (dataset.descriptor.representation.kind !== "inline-geojson") continue;
    const feature = (dataset.data as AnalysisFeatureCollectionV1).features.find((entry) =>
      String(entry.properties[dataset.descriptor.primaryKey] ?? entry.id ?? "") === id,
    );
    if (!feature) continue;
    const label = feature.properties.label ?? feature.properties.name ?? feature.properties.geoid;
    return {
      id,
      label: typeof label === "string" ? label : id,
      datasetId: dataset.descriptor.id,
      geometry: cloneJson(feature.geometry),
      properties: {...feature.properties},
    };
  }
  return null;
}

export function selectionToFeatureCollection(selection: CanonicalSelection): AnalysisFeatureCollectionV1 {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      id: selection.id,
      geometry: cloneJson(selection.geometry),
      properties: {entityId: selection.id, label: selection.label, selectionKind: selection.geometry.type === "Point" ? "Selected location" : "Selected area"},
    }],
  };
}

function selectionPriority(role: string) {
  if (role === "location-intelligence" || role === "candidate") return 0;
  if (role === "access-surface") return 1;
  return 2;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
