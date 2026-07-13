import assert from "node:assert/strict";
import test from "node:test";

import {
  INTELLIGENCE_VIEW_LIMITS,
  INTELLIGENCE_VIEW_SCHEMA_VERSION,
  assertIntelligenceViewV1,
  cloneIntelligenceViewV1,
  parseIntelligenceViewV1,
  type IntelligenceLayerV1,
  type IntelligenceMarkV1,
  type IntelligenceSourceV1,
  type MapGapIntelligenceViewV1,
} from "../src/intelligence.ts";
import { getAlbanyIntelligenceViewFixture } from "../src/intelligence-fixtures.ts";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test("deterministic fixture validates and uses only renderer-neutral view intent", () => {
  const view = getAlbanyIntelligenceViewFixture();
  const result = parseIntelligenceViewV1(view);
  assert.equal(result.ok, true);
  assert.equal(view.schemaVersion, INTELLIGENCE_VIEW_SCHEMA_VERSION);
  assert.deepEqual(view.layers.map((layer) => layer.mark), ["isochrone", "choropleth"]);
  assert.equal(view.link?.direction, "from-target");
  assert.equal(view.workspace.layout, "adaptive");
  assert.equal(JSON.stringify(view).match(/kepler|maplibre|deck\.gl|rendererProps/gi), null);
});

test("parse, assert, and clone return defensive copies", () => {
  const fixture = getAlbanyIntelligenceViewFixture();
  const parsed = parseIntelligenceViewV1(fixture);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  parsed.view.layers[0]!.label = "changed";
  assert.notEqual(fixture.layers[0]!.label, "changed");

  const asserted = assertIntelligenceViewV1(fixture);
  const cloned = cloneIntelligenceViewV1(fixture);
  asserted.workspace.title = "asserted";
  cloned.workspace.title = "cloned";
  assert.equal(fixture.workspace.title, "Location intelligence");
});

test("future and unknown schema versions fail closed", () => {
  const view = clone(getAlbanyIntelligenceViewFixture()) as MapGapIntelligenceViewV1 & { schemaVersion: string };
  view.schemaVersion = "mapgap-intelligence-view/v2";
  const result = parseIntelligenceViewV1(view);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some((issue) => issue.includes("Unsupported intelligence view schema")));
});

test("all specified visualization marks have a valid portable representation", () => {
  const cases: Array<[IntelligenceMarkV1, IntelligenceSourceV1]> = [
    ...(["symbol", "cluster", "density", "heat", "hex", "grid"] as const).map((mark) => [mark, pointSource()] as [IntelligenceMarkV1, IntelligenceSourceV1]),
    ["h3", polygonSource()],
    ["choropleth", polygonSource()],
    ["extrusion", polygonSource()],
    ["path", lineSource()],
    ["isochrone", polygonSource()],
    ["trip", lineSource()],
    ["raster", rasterSource()],
    ["vector-tile", vectorTileSource()],
  ];

  cases.forEach(([mark, source]) => {
    const view = oneLayerView(mark, source);
    const result = parseIntelligenceViewV1(view);
    assert.equal(result.ok, true, `${mark}: ${result.ok ? "" : result.issues.join(" ")}`);
  });
});

test("duplicate ids, layer orders, and missing references fail closed", () => {
  const duplicateSource = getAlbanyIntelligenceViewFixture();
  duplicateSource.sources.push(clone(duplicateSource.sources[0]!));
  assertRejected(duplicateSource, "duplicate id");

  const duplicateLayer = getAlbanyIntelligenceViewFixture();
  duplicateLayer.layers.push({ ...clone(duplicateLayer.layers[0]!), order: 2 });
  assertRejected(duplicateLayer, "duplicate id");

  const duplicateOrder = getAlbanyIntelligenceViewFixture();
  duplicateOrder.layers[1]!.order = 0;
  assertRejected(duplicateOrder, "duplicate order");

  const missingSource = getAlbanyIntelligenceViewFixture();
  missingSource.layers[0]!.sourceId = "missing";
  assertRejected(missingSource, "references missing source");

  const missingLayer = getAlbanyIntelligenceViewFixture();
  missingLayer.workspace.activeLayerId = "missing";
  assertRejected(missingLayer, "activeLayerId");
});

test("geometry and remote-source incompatibilities reject where determinable", () => {
  const pointChoropleth = oneLayerView("choropleth", pointSource());
  assertRejected(pointChoropleth, "incompatible with source geometryTypes");

  const polygonHeat = oneLayerView("heat", polygonSource());
  assertRejected(polygonHeat, "incompatible with source geometryTypes");

  const falseRaster = oneLayerView("raster", { ...rasterSource(), reference: { kind: "analysis-dataset", datasetId: "raster" } });
  assertRejected(falseRaster, "requires a raster-tile source");

  const falseVector = oneLayerView("vector-tile", { ...vectorTileSource(), reference: { kind: "analysis-dataset", datasetId: "vectors" } });
  assertRejected(falseVector, "requires a vector-tile source");
});

test("project datasets are referenced truthfully without pretending to be analysis bundles", () => {
  const view = oneLayerView("symbol", {
    ...pointSource(),
    reference: {kind: "project-dataset", datasetId: "mapgap-assets-v1"},
  });
  const result = parseIntelligenceViewV1(view);
  assert.equal(result.ok, true, result.ok ? "" : result.issues.join("\n"));
});

test("encodings and filters validate field references, types, scales, and finite values", () => {
  const missingField = getAlbanyIntelligenceViewFixture();
  missingField.layers[1]!.encodings.height = { kind: "field", field: "notDeclared" };
  assertRejected(missingField, "references missing field");

  const nonNumeric = getAlbanyIntelligenceViewFixture();
  nonNumeric.layers[1]!.encodings.height = { kind: "field", field: "rentBurdenBand" };
  assertRejected(nonNumeric, "requires a numeric field");

  const badLog = getAlbanyIntelligenceViewFixture();
  badLog.layers[1]!.encodings.height = { kind: "field", field: "medianGrossRent", scale: { type: "log", domain: [0, 2] } };
  assertRejected(badLog, "positive numbers");

  const missingFilterField = getAlbanyIntelligenceViewFixture();
  missingFilterField.layers[0]!.filters[0]!.field = "notDeclared";
  assertRejected(missingFilterField, "references missing field");

  const infinity = getAlbanyIntelligenceViewFixture();
  infinity.layers[0]!.opacity = Number.POSITIVE_INFINITY;
  assertRejected(infinity, "opacity must be between");

  const reversedRange = getAlbanyIntelligenceViewFixture();
  reversedRange.layers[0]!.filters = [{ id: "bad", field: "minutes", operator: "range", min: 30, max: 10 }];
  assertRejected(reversedRange, "finite min <= max");
});

test("legend missing-value meaning, pick/select, and active selection semantics are enforced", () => {
  const noMeaning = getAlbanyIntelligenceViewFixture();
  noMeaning.layers[0]!.legend.missing.label = "";
  assertRejected(noMeaning, "missing.label");

  const unpickable = getAlbanyIntelligenceViewFixture();
  unpickable.layers[0]!.pickable = false;
  assertRejected(unpickable, "cannot be selectable");

  const mismatchedSelection = getAlbanyIntelligenceViewFixture();
  mismatchedSelection.activeSelection = { sourceId: "access", entityId: "x", layerId: "housing-rent-burden" };
  assertRejected(mismatchedSelection, "layer and source must agree");
});

test("viewport, link, and time values are bounded and ordered", () => {
  const badViewport = getAlbanyIntelligenceViewFixture();
  badViewport.viewport!.pitch = 90;
  assertRejected(badViewport, "viewport.pitch");

  const badLink = getAlbanyIntelligenceViewFixture();
  (badLink.link as { target: string }).target = "untrusted-app";
  assertRejected(badLink, "link.target");

  const badTime = getAlbanyIntelligenceViewFixture();
  badTime.time = {
    start: "2026-07-12T12:00:00.000Z",
    end: "2026-07-12T13:00:00.000Z",
    current: "2026-07-12T14:00:00.000Z",
    playing: false,
    loop: false,
  };
  assertRejected(badTime, "start <= current <= end");
});

test("unsafe URLs, credentials, and renderer-specific escape hatches are rejected", () => {
  const http = oneLayerView("raster", rasterSource());
  const source = http.sources[0]!;
  if (source.reference.kind === "remote") source.reference.url = "http://tiles.example.org/{z}/{x}/{y}.png";
  assertRejected(http, "credential-free HTTPS URL");

  const token = oneLayerView("vector-tile", vectorTileSource());
  const tokenSource = token.sources[0]!;
  if (tokenSource.reference.kind === "remote") tokenSource.reference.url += "?access_token=secret";
  assertRejected(token, "credential-free HTTPS URL");

  const rendererProps = getAlbanyIntelligenceViewFixture() as MapGapIntelligenceViewV1 & { rendererProps: object };
  rendererProps.rendererProps = { implementation: "anything" };
  assertRejected(rendererProps, "unsupported property rendererProps");

  const nestedProps = getAlbanyIntelligenceViewFixture();
  (nestedProps.layers[0] as IntelligenceLayerV1 & { deckProps: object }).deckProps = {};
  assertRejected(nestedProps, "unsupported property deckProps");
});

test("oversized layers, filters, scale arrays, and strings are rejected", () => {
  const tooManyLayers = oneLayerView("symbol", pointSource());
  tooManyLayers.layers = Array.from({ length: INTELLIGENCE_VIEW_LIMITS.maxLayers + 1 }, (_, index) => ({
    ...clone(tooManyLayers.layers[0]!),
    id: `layer-${index}`,
    order: index,
  }));
  assertRejected(tooManyLayers, "exceeds maxLayers");

  const tooManyFilters = getAlbanyIntelligenceViewFixture();
  tooManyFilters.layers[0]!.filters = Array.from({ length: INTELLIGENCE_VIEW_LIMITS.maxFiltersPerLayer + 1 }, (_, index) => ({
    id: `filter-${index}`,
    field: "minutes",
    operator: "gte" as const,
    value: index,
  }));
  assertRejected(tooManyFilters, "exceeds maxFiltersPerLayer");

  const tooLargeScale = getAlbanyIntelligenceViewFixture();
  tooLargeScale.layers[1]!.encodings.height = {
    kind: "field",
    field: "medianGrossRent",
    scale: { type: "linear", domain: Array.from({ length: INTELLIGENCE_VIEW_LIMITS.maxScaleValues + 1 }, (_, index) => index) },
  };
  assertRejected(tooLargeScale, "maxScaleValues");

  const tooLong = getAlbanyIntelligenceViewFixture();
  tooLong.title = "x".repeat(INTELLIGENCE_VIEW_LIMITS.maxStringLength + 1);
  assertRejected(tooLong, "maxStringLength");
});

function assertRejected(value: unknown, phrase: string) {
  const result = parseIntelligenceViewV1(value);
  assert.equal(result.ok, false, `${phrase} should reject`);
  if (!result.ok) assert.ok(result.issues.some((issue) => issue.includes(phrase)), result.issues.join("\n"));
}

function pointSource(): IntelligenceSourceV1 {
  return {
    id: "source",
    label: "Points",
    reference: { kind: "analysis-dataset", datasetId: "points-v1" },
    geometryTypes: ["Point"],
    fields: [
      { name: "id", label: "ID", type: "string", nullable: false },
      { name: "value", label: "Value", type: "number", nullable: true },
    ],
    idField: "id",
  };
}

function polygonSource(): IntelligenceSourceV1 {
  return { ...pointSource(), label: "Areas", geometryTypes: ["Polygon"], reference: { kind: "analysis-dataset", datasetId: "areas-v1" } };
}

function lineSource(): IntelligenceSourceV1 {
  return { ...pointSource(), label: "Paths", geometryTypes: ["LineString"], reference: { kind: "analysis-dataset", datasetId: "paths-v1" } };
}

function rasterSource(): IntelligenceSourceV1 {
  return {
    id: "source",
    label: "Raster tiles",
    reference: { kind: "remote", format: "raster-tile", url: "https://tiles.example.org/{z}/{x}/{y}.png" },
    geometryTypes: ["Raster"],
    fields: [],
  };
}

function vectorTileSource(): IntelligenceSourceV1 {
  return {
    ...polygonSource(),
    label: "Vector tiles",
    reference: {
      kind: "remote",
      format: "vector-tile",
      url: "https://tiles.example.org/{z}/{x}/{y}.mvt",
      sourceLayer: "areas",
    },
  };
}

function oneLayerView(mark: IntelligenceMarkV1, source: IntelligenceSourceV1): MapGapIntelligenceViewV1 {
  return {
    schemaVersion: INTELLIGENCE_VIEW_SCHEMA_VERSION,
    id: `test-${mark}`,
    title: `Test ${mark}`,
    sources: [source],
    layers: [{
      id: "layer",
      label: "Layer",
      sourceId: source.id,
      mark,
      visible: true,
      order: 0,
      opacity: 1,
      encodings: {},
      filters: [],
      legend: { visible: true, title: "Legend", placement: "panel", missing: { label: "No data" } },
      pickable: true,
      selectable: true,
    }],
    workspace: {
      title: "Location intelligence",
      layout: "adaptive",
      activeLayerId: "layer",
      layerPanel: "open",
      inspector: "closed",
      legendPlacement: "panel",
    },
  };
}
