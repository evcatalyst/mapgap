import {expect, test} from "@playwright/test";
import {MAPGAP_ANALYSIS_DATASET_IDS} from "@mapgap/project-contract";
import {getComparisonAnalysisBundleFixture} from "@mapgap/project-contract/analysis-fixtures";
import {getCivicCapacityProjectFixture} from "@mapgap/project-contract/fixtures";
import {
  analysisBundleToKeplerDatasets,
  findAnalysisFeature,
  getAnalysisLayerAvailability,
  getInitialSelection,
  selectionToKeplerDataset,
} from "../src/adapters/analysis-to-datasets";
import {COMPARISON_PRESENTATION_DATASET_IDS} from "../src/map/comparison-config";

test("bounded civic bundle renders access and housing while source lineage tables stay outside Redux", () => {
  const bundle = getComparisonAnalysisBundleFixture("civic");
  const datasets = analysisBundleToKeplerDatasets(bundle);

  expect(datasets.map((dataset) => dataset.info.id)).toEqual([
    MAPGAP_ANALYSIS_DATASET_IDS.accessSurface,
    MAPGAP_ANALYSIS_DATASET_IDS.housingAreas,
  ]);
  expect(datasets.map((dataset) => dataset.info.id)).not.toContain(MAPGAP_ANALYSIS_DATASET_IDS.acsHousing);
  expect(datasets.map((dataset) => dataset.info.id)).not.toContain(MAPGAP_ANALYSIS_DATASET_IDS.tigerTracts);
  expect(getAnalysisLayerAvailability(bundle)).toMatchObject({
    accessSurface: true,
    housingAreas: true,
    selection: true,
  });
});

test("relocation bundle supplies the normalized access surface without borrowing Albany housing", () => {
  const bundle = getComparisonAnalysisBundleFixture("relocation");
  const datasets = analysisBundleToKeplerDatasets(bundle);

  expect(datasets.map((dataset) => dataset.info.id)).toEqual([
    MAPGAP_ANALYSIS_DATASET_IDS.accessSurface,
  ]);
  expect(getAnalysisLayerAvailability(bundle).housingAreas).toBe(false);
});

test("shared presentation selection is replaceable and never part of either portable contract", () => {
  const project = getCivicCapacityProjectFixture();
  const selection = getInitialSelection(project);
  const dataset = selectionToKeplerDataset(selection);
  const housing = findAnalysisFeature(
    getComparisonAnalysisBundleFixture("civic"),
    "14000US36001000100",
  );

  expect(dataset.info.id).toBe(COMPARISON_PRESENTATION_DATASET_IDS.selection);
  expect(selection.id).toBe(project.civic.assets[0].id);
  expect(housing).toMatchObject({
    datasetId: MAPGAP_ANALYSIS_DATASET_IDS.housingAreas,
    properties: {medianGrossRent: 1243, rentBurdenPercent: 56.14},
  });
  expect(JSON.stringify(project)).not.toContain(COMPARISON_PRESENTATION_DATASET_IDS.selection);
});
