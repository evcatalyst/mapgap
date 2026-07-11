import { expect, test } from "@playwright/test";
import { getRelocationProjectFixture } from "@mapgap/project-contract/fixtures";
import { projectToDatasets } from "../src/adapters/project-to-datasets";
import { selectScaleStrategy } from "../src/scale";

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
