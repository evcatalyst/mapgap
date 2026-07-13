import { expect, test } from "@playwright/test";
import { getRelocationProjectFixture } from "@mapgap/project-contract/fixtures";
import { projectToDatasets } from "../src/adapters/project-to-datasets";
import {
  countGeoJsonCoordinatePairs,
  estimateComparisonRuntimeBudget,
  qualifyComparisonViewport,
  selectScaleStrategy,
} from "../src/scale";

test("GeoJSON scale measurement counts geometry but ignores unrelated numeric arrays", () => {
  expect(countGeoJsonCoordinatePairs({
    type: "FeatureCollection",
    features: [
      {type: "Feature", geometry: {type: "Point", coordinates: [-73.7, 42.6]}, properties: {timestamps: [0, 30, 60]}},
      {type: "Feature", geometry: {type: "LineString", coordinates: [[-73.7, 42.6], [-73.6, 42.7]]}, properties: {range: [1, 2]}},
    ],
  })).toBe(3);
});

test("direct fixture projection handles the 10k qualification tier without changing scale policy", () => {
  const project = getRelocationProjectFixture();
  project.points = Array.from({ length: 10_000 }, (_, index) => ({
    ...project.points[0],
    id: `point-${index}`,
    name: `Generated point ${index}`,
    geometry: { type: "Point" as const, coordinates: [-74 + index / 1_000_000, 40.7] as [number, number] },
  }));

  const startedAt = performance.now();
  const datasets = projectToDatasets(project);
  const elapsedMs = performance.now() - startedAt;
  const points = datasets.find((dataset) => dataset.id === "mapgap-points-v1")!;

  expect(points.featureCollection.features).toHaveLength(10_000);
  expect(elapsedMs).toBeLessThan(5_000);
  expect(selectScaleStrategy(10_000).kind).toBe("direct-geojson");
});

test("regional and national scale tiers refuse million-feature GeoJSON hydration", () => {
  expect(selectScaleStrategy(50_001).kind).toBe("arrow-or-query");
  expect(selectScaleStrategy(1_000_000).kind).toBe("arrow-or-query");
  expect(selectScaleStrategy(1_000_001).kind).toBe("tiled");
  expect(() => selectScaleStrategy(-1)).toThrow("featureCount");
});

test("polygon complexity and bytes can promote a small feature count out of GeoJSON", () => {
  expect(selectScaleStrategy({
    featureCount: 120,
    byteCount: 28 * 1024 * 1024,
    coordinateCount: 2_400_000,
  }).kind).toBe("arrow-or-query");
  expect(selectScaleStrategy({
    featureCount: 120,
    byteCount: 280 * 1024 * 1024,
    coordinateCount: 13_000_000,
  }).kind).toBe("tiled");
});

test("dual mode is container and memory qualified for iPad/desktop, not user-agent guessed", () => {
  expect(qualifyComparisonViewport({
    width: 1180,
    height: 744,
    devicePixelRatio: 2,
  })).toMatchObject({mode: "dual", reason: "qualified", paneWidth: 588.5});
  expect(qualifyComparisonViewport({
    width: 1_000,
    height: 744,
    devicePixelRatio: 2,
  })).toMatchObject({mode: "single", reason: "pane-width"});
  expect(qualifyComparisonViewport({
    width: 1_003,
    height: 744,
    devicePixelRatio: 2,
  })).toMatchObject({mode: "dual", reason: "qualified"});
  expect(qualifyComparisonViewport({
    width: 820,
    height: 1080,
    devicePixelRatio: 2,
  })).toMatchObject({mode: "single", reason: "pane-width", paneWidth: 408.5});
  expect(qualifyComparisonViewport({
    width: 1440,
    height: 1200,
    devicePixelRatio: 3,
  })).toMatchObject({mode: "dual", reason: "qualified", paneWidth: 718.5});
  expect(qualifyComparisonViewport({
    width: 4_000,
    height: 2_400,
    devicePixelRatio: 2,
  })).toMatchObject({mode: "single", reason: "framebuffer-budget", paneWidth: 1_998.5});
});

test("comparison runtime budget exposes a tile cap and conservative resident-memory estimate", () => {
  const budget = estimateComparisonRuntimeBudget([
    {featureCount: 1_200, byteCount: 2_000_000, coordinateCount: 18_000},
    {featureCount: 240, byteCount: 600_000, coordinateCount: 8_000},
  ], {width: 1180, height: 744, devicePixelRatio: 2});

  expect(budget.maximumInitialTileRequests).toBe(56);
  expect(budget.estimatedResidentBytes).toBeGreaterThan(7_800_000);
  expect(budget.qualified).toBe(true);
});
