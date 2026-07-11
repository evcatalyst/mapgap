import { processGeojson } from "@kepler.gl/processors";
import {
  MAPGAP_DATASET_IDS,
  type AreaGeometryV1,
  type JsonRecord,
  type MapGapDatasetId,
  type MapGapProjectV1,
  type PointGeometryV1,
} from "@mapgap/project-contract";

type Feature = {
  type: "Feature";
  geometry: PointGeometryV1 | AreaGeometryV1;
  properties: JsonRecord;
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

export type MapGapDataset = {
  id: MapGapDatasetId;
  label: string;
  featureCollection: FeatureCollection;
};

export type KeplerDataset = {
  info: { id: MapGapDatasetId; label: string };
  data: NonNullable<ReturnType<typeof processGeojson>>;
};

/**
 * Converts a portable project to canonical presentation datasets. It only reads
 * the project and creates fresh GeoJSON; Kepler never becomes project truth.
 */
export function projectToDatasets(project: MapGapProjectV1): MapGapDataset[] {
  const datasets: MapGapDataset[] = [
    dataset(MAPGAP_DATASET_IDS.points, "MapGap points", project.points.map((point) => feature(point.geometry, {
      id: point.id,
      name: point.name,
      address: point.address,
      color: point.color,
      createdAt: point.createdAt,
      provenanceLabel: point.provenance.label,
      provenanceSource: point.provenance.sourceType,
      provenanceUpdatedAt: point.provenance.updatedAt,
    }))),
    dataset(MAPGAP_DATASET_IDS.isochrones, "Routed access polygons", project.isochrones.map((isochrone) => feature(isochrone.geometry, {
      id: isochrone.id,
      pointId: isochrone.pointId,
      pointName: isochrone.pointName,
      timeMinutes: isochrone.timeMinutes,
      bucketMinutes: isochrone.bucketMinutes,
      adjustedMinutes: isochrone.adjustedMinutes,
      effortScore: isochrone.effortScore,
      mobilityMode: isochrone.mobilityMode,
      transportMode: isochrone.transportMode,
      routingProvider: isochrone.routingProvider,
      isochroneMode: isochrone.isochroneMode,
      generatedAt: isochrone.generatedAt,
      provenanceLabel: isochrone.provenance.label,
      provenanceSource: isochrone.provenance.sourceType,
    }))),
    dataset(MAPGAP_DATASET_IDS.pois, "Points of interest", project.poiLayers.flatMap((layer) =>
      layer.points.map((point) => feature(point.geometry, {
        id: point.id,
        name: point.name,
        layerId: layer.id,
        layerLabel: layer.label,
        layerVisible: layer.visible,
        category: point.category,
        source: point.source,
        sourceId: point.sourceId,
        address: point.address,
        rating: point.rating,
        userRatingCount: point.userRatingCount,
        tags: point.tags?.join(", "),
        provenanceLabel: point.provenance.label,
        provenanceUpdatedAt: point.provenance.updatedAt,
      })),
    )),
    dataset(MAPGAP_DATASET_IDS.candidates, "Candidate scores", project.candidates.map((candidate) => feature(candidate.geometry, {
      id: candidate.id,
      label: candidate.label,
      source: candidate.source,
      rank: candidate.rank,
      totalScore: candidate.score?.total,
      scoreBand: candidate.score?.band,
      scoreComponents: candidate.score?.components
        .map((component) => `${component.label}: ${component.value}`)
        .join("; "),
      failedConstraints: candidate.score?.failedConstraints
        .map((constraint) => `${constraint.label}: ${constraint.explanation}`)
        .join(" | "),
      assumptions: candidate.score?.assumptions
        .map((assumption) => `${assumption.label}: ${assumption.value}`)
        .join(" | "),
      provenanceLabel: candidate.provenance.label,
      provenanceUpdatedAt: candidate.provenance.updatedAt,
    }))),
    dataset(MAPGAP_DATASET_IDS.assets, "Civic assets", project.civic.assets.map((asset) => feature(asset.geometry, {
      id: asset.id,
      pointId: asset.pointId,
      name: asset.name,
      assetType: asset.assetType,
      capacity: asset.capacity,
      utilizationRate: asset.utilizationRate,
      utilizationPercent:
        asset.utilizationRate === undefined ? undefined : Math.round(asset.utilizationRate * 100),
      sourceUtilization: asset.sourceUtilization,
      hoursOpen: asset.hoursOpen,
      staffing: asset.staffing,
      annualCost: asset.annualCost,
      fundingSource: asset.fundingSource,
      provenanceLabel: asset.provenance.label,
      provenanceDatasetId: asset.provenance.datasetId,
      provenanceUpdatedAt: asset.provenance.updatedAt,
      provenanceConfidence: asset.provenance.confidence,
    }))),
    dataset(MAPGAP_DATASET_IDS.underserved, "Underserved capacity proxy", project.civic.underservedAreas.map((area) => feature(area.geometry, {
      id: area.id,
      underservedScore: area.underservedScore,
      reachableCapacity: area.reachableCapacity,
      evidence: area.evidence.join(" | "),
      provenanceLabel: area.provenance.label,
      provenanceNote: area.provenance.note,
      provenanceUpdatedAt: area.provenance.updatedAt,
      provenanceConfidence: area.provenance.confidence,
    }))),
  ];

  // Empty GeoJSON datasets produce unhelpful Kepler layers, so the workbench
  // receives only datasets with data. IDs remain stable whenever present.
  return datasets.filter((entry) => entry.featureCollection.features.length > 0);
}

export function projectToKeplerDatasets(project: MapGapProjectV1): KeplerDataset[] {
  return projectToDatasets(project).map((entry) => {
    const data = processGeojson(entry.featureCollection);
    if (!data) {
      throw new Error(`Could not process MapGap dataset ${entry.id} as GeoJSON.`);
    }
    return { info: { id: entry.id, label: entry.label }, data };
  });
}

export function projectToEvidenceSummary(project: MapGapProjectV1) {
  return {
    candidateCount: project.candidates.length,
    failedCandidateCount: project.candidates.filter(
      (candidate) => (candidate.score?.failedConstraints.length ?? 0) > 0,
    ).length,
    routedPolygonCount: project.isochrones.length,
    assetCount: project.civic.assets.length,
    totalCapacity: project.civic.assets.reduce((total, asset) => total + (asset.capacity ?? 0), 0),
    underservedAreaCount: project.civic.underservedAreas.length,
  };
}

function dataset(id: MapGapDatasetId, label: string, features: Feature[]): MapGapDataset {
  return {
    id,
    label,
    featureCollection: { type: "FeatureCollection", features },
  };
}

function feature(geometry: Feature["geometry"], properties: Record<string, unknown>): Feature {
  return {
    type: "Feature",
    geometry: cloneJson(geometry),
    properties: Object.fromEntries(
      Object.entries(properties).filter(([, value]) => value !== undefined),
    ) as JsonRecord,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
