import { expect, test } from "@playwright/test";
import { MAPGAP_DATASET_IDS, projectDatasetCounts } from "@mapgap/project-contract";
import {
  getCivicCapacityProjectFixture,
  getRelocationProjectFixture,
} from "@mapgap/project-contract/fixtures";
import { projectToDatasets, projectToEvidenceSummary } from "../src/adapters/project-to-datasets";

test("relocation projection preserves candidate score and routed polygon evidence", () => {
  const project = getRelocationProjectFixture();
  const datasets = projectToDatasets(project);
  const candidates = datasets.find((dataset) => dataset.id === MAPGAP_DATASET_IDS.candidates)!;
  const isochrones = datasets.find((dataset) => dataset.id === MAPGAP_DATASET_IDS.isochrones)!;
  const proximityOnly = candidates.featureCollection.features.find(
    (feature) => feature.properties.id === "candidate-proximity-only",
  )!;

  expect(datasets.map((dataset) => dataset.id)).toEqual([
    MAPGAP_DATASET_IDS.points,
    MAPGAP_DATASET_IDS.isochrones,
    MAPGAP_DATASET_IDS.pois,
    MAPGAP_DATASET_IDS.candidates,
  ]);
  expect(proximityOnly.properties.totalScore).toBe(42);
  expect(String(proximityOnly.properties.failedConstraints)).toContain("Required work commute");
  expect(isochrones.featureCollection.features[0].geometry).toEqual(project.isochrones[0].geometry);
  expect(projectDatasetCounts(project)[MAPGAP_DATASET_IDS.candidates]).toBe(2);
});

test("civic projection keeps capacity, utilization, underserved evidence, and provenance", () => {
  const project = getCivicCapacityProjectFixture();
  const datasets = projectToDatasets(project);
  const assets = datasets.find((dataset) => dataset.id === MAPGAP_DATASET_IDS.assets)!;
  const underserved = datasets.find((dataset) => dataset.id === MAPGAP_DATASET_IDS.underserved)!;
  const summary = projectToEvidenceSummary(project);

  expect(assets.featureCollection.features.map((feature) => feature.properties.capacity)).toEqual([24, 48]);
  expect(assets.featureCollection.features.map((feature) => feature.properties.utilizationPercent)).toEqual([67, 33]);
  expect(underserved.featureCollection.features[0].properties.underservedScore).toBe(82);
  expect(String(underserved.featureCollection.features[0].properties.evidence)).toContain("deterministic alpha proxy");
  expect(summary).toMatchObject({ assetCount: 2, totalCapacity: 72, underservedAreaCount: 1 });

});

test("missing decision evidence stays unknown instead of becoming a pass or zero capacity", () => {
  const relocation = getRelocationProjectFixture();
  relocation.candidates[0].score = undefined;
  const candidateDataset = projectToDatasets(relocation).find((dataset) => dataset.id === MAPGAP_DATASET_IDS.candidates)!;
  const unscored = candidateDataset.featureCollection.features.find(
    (feature) => feature.properties.id === "candidate-proximity-only",
  )!;
  expect(unscored.properties.mapLabel).toBe("Not scored");
  expect(unscored.properties.scoreBand).toBe("unscored");
  expect(projectToEvidenceSummary(relocation)).toMatchObject({
    passedCandidateCount: 1,
    failedCandidateCount: 0,
    unscoredCandidateCount: 1,
  });

  const civic = getCivicCapacityProjectFixture();
  civic.civic.assets[0].capacity = undefined;
  expect(projectToEvidenceSummary(civic)).toMatchObject({
    totalCapacity: 48,
    unknownCapacityCount: 1,
  });
});
