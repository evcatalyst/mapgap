import {expect, test} from "@playwright/test";
import type {AddDataToMapPayload} from "@kepler.gl/types";
import {
  getCivicCapacityProjectFixture,
  getRelocationProjectFixture,
} from "@mapgap/project-contract/fixtures";
import {
  ANALYSIS_BUNDLE_DATASET_IDS,
  COMPARISON_LAYER_IDS,
  getComparisonLayerRegistry,
  getComparisonMapConfig,
  getFocusModeLayerVisibility,
  getWideSplitMapMasks,
} from "../src/map/comparison-config";

test("wide compare assigns every layer explicitly and isolates housing from access", () => {
  const registry = getComparisonLayerRegistry("relocation", getRelocationProjectFixture(), {
    accessSurface: true,
    housingAreas: true,
    housingCandidates: true,
  });
  const [access, intelligence] = getWideSplitMapMasks(registry);

  expect(Object.keys(access.layers)).toEqual(Object.keys(intelligence.layers));
  expect(Object.keys(access.layers)).toHaveLength(registry.length);
  expect(access.layers[COMPARISON_LAYER_IDS.accessSurface]).toBe(true);
  expect(intelligence.layers[COMPARISON_LAYER_IDS.accessSurface]).toBe(false);
  expect(access.layers[COMPARISON_LAYER_IDS.housingAreas]).toBe(false);
  expect(intelligence.layers[COMPARISON_LAYER_IDS.housingAreas]).toBe(true);
  expect(access.layers[COMPARISON_LAYER_IDS.housingCandidates]).toBe(false);
  expect(intelligence.layers[COMPARISON_LAYER_IDS.housingCandidates]).toBe(true);
  expect(access.layers["mapgap-relocation-candidates"]).toBe(true);
  expect(intelligence.layers["mapgap-relocation-candidates"]).toBe(true);
});

test("single-canvas focus modes retain shared layers and hide the opposite lens", () => {
  const registry = getComparisonLayerRegistry("civic", getCivicCapacityProjectFixture(), {
    accessSurface: true,
    housingAreas: true,
  });
  const access = getFocusModeLayerVisibility(registry, "access");
  const intelligence = getFocusModeLayerVisibility(registry, "intelligence");

  expect(access["mapgap-civic-access"]).toBe(true);
  expect(access["mapgap-civic-assets"]).toBe(false);
  expect(access["mapgap-civic-anchor"]).toBe(true);
  expect(intelligence["mapgap-civic-access"]).toBe(false);
  expect(intelligence["mapgap-civic-assets"]).toBe(true);
  expect(intelligence["mapgap-civic-anchor"]).toBe(true);
  expect(access[COMPARISON_LAYER_IDS.housingAreas]).toBe(false);
  expect(intelligence[COMPARISON_LAYER_IDS.housingAreas]).toBe(true);
});

test("comparison config activates synchronized split state only in compare mode", () => {
  const project = getRelocationProjectFixture();
  const availability = {accessSurface: true, housingAreas: true, housingCandidates: true};
  const compare = getComparisonMapConfig("relocation", project, availability, "compare");
  const focused = getComparisonMapConfig("relocation", project, availability, "intelligence");
  const acceptsAddDataConfig = (config: NonNullable<AddDataToMapPayload["config"]>) => config;

  // Compile-time guard: this foundation must remain directly consumable by
  // addDataToMap instead of becoming a parallel MapGap-only config dialect.
  expect(acceptsAddDataConfig(compare)).toBe(compare);

  expect(compare.config.mapState).toMatchObject({
    isSplit: true,
    isViewportSynced: true,
    isZoomLocked: true,
    mapSplitMode: "DUAL_MAP",
  });
  expect(compare.config.visState.splitMaps).toHaveLength(2);
  expect(focused.config.mapState).toMatchObject({
    isSplit: false,
    isViewportSynced: true,
    isZoomLocked: false,
    mapSplitMode: "SINGLE_MAP",
  });
  expect(focused.config.visState.splitMaps).toEqual([]);

  const focusedById = Object.fromEntries(
    focused.config.visState.layers.map((layer) => [layer.id, layer.config.isVisible]),
  );
  expect(focusedById[COMPARISON_LAYER_IDS.accessSurface]).toBe(false);
  expect(focusedById[COMPARISON_LAYER_IDS.housingAreas]).toBe(true);
  expect(focusedById["mapgap-relocation-pois"]).toBe(true);
  expect(focusedById["mapgap-relocation-access"]).toBe(false);

  expect(
    focused.config.visState.layers.find(
      (layer) => layer.id === COMPARISON_LAYER_IDS.housingAreas,
    )?.config.dataId,
  ).toBe(ANALYSIS_BUNDLE_DATASET_IDS.housingAreas);
  expect(
    focused.config.visState.interactionConfig.tooltip.fieldsToShow[
      ANALYSIS_BUNDLE_DATASET_IDS.housingAreas
    ].map((field) => field.name),
  ).toContain("medianGrossRent");
});

test("analysis layers stay absent until their datasets are available", () => {
  const project = getRelocationProjectFixture();
  const registry = getComparisonLayerRegistry("relocation", project);
  const config = getComparisonMapConfig("relocation", project, {}, "compare");

  expect(registry.every((layer) => layer.source === "portable-project")).toBe(true);
  expect(config.config.visState.layers.some((layer) => layer.id.startsWith("mapgap-analysis-"))).toBe(false);
  expect(config.config.visState.splitMaps.flatMap((map) => Object.keys(map.layers)))
    .not.toContain(COMPARISON_LAYER_IDS.housingAreas);
});
