import {expect, test} from "@playwright/test";
import {canRenderMark, createIntelligenceLayer, type IntelligenceLayerState, type IntelligenceSource, type RenderCollection} from "../src/map/intelligence-layers";

const pointData: RenderCollection = {type: "FeatureCollection", features: [{type: "Feature", geometry: {type: "Point", coordinates: [-73.77, 42.67]}, properties: {id: "facility-1", capacity: 24}}]};
const plainLineData: RenderCollection = {type: "FeatureCollection", features: [{type: "Feature", geometry: {type: "LineString", coordinates: [[-73.77, 42.67], [-73.75, 42.68], [-73.73, 42.69]]}, properties: {id: "line-1"}}]};
const routeData: RenderCollection = {type: "FeatureCollection", features: plainLineData.features.map((feature) => ({...feature, properties: {id: "route-1", routingProvider: "valhalla", routeKind: "routed-path"}}))};
const tripData: RenderCollection = {type: "FeatureCollection", features: [{...routeData.features[0], properties: {...routeData.features[0].properties, id: "trip-1", timestamps: [0, 30, 60]}}]};
const isochroneData: RenderCollection = {type: "FeatureCollection", features: [{type: "Feature", geometry: {type: "Polygon", coordinates: [[[-73.78, 42.66], [-73.76, 42.66], [-73.76, 42.68], [-73.78, 42.66]]]}, properties: {id: "iso-1", timeMinutes: 15, routingProvider: "valhalla"}}]};
const polygonData: RenderCollection = {type: "FeatureCollection", features: [{type: "Feature", geometry: {type: "Polygon", coordinates: [[[-73.78, 42.66], [-73.76, 42.66], [-73.76, 42.68], [-73.78, 42.66]]]}, properties: {id: "tract-1", capacity: 44}}]};

test("eligible point data switches through symbol, heat, hex, grid and H3 without refetching", () => {
  const source = makeSource(pointData, "point");
  const original = source.data;
  for (const mark of ["symbol", "heat", "hex", "grid", "h3"] as const) {
    const rendered = createIntelligenceLayer({layer: makeLayer(mark), source, onSelect: () => undefined});
    expect(rendered, `${mark} should have a direct factory`).not.toBeNull();
    expect(source.data).toBe(original);
  }
});

test("choropleth, H3 picking, filters and temporal progression operate on truthful records", () => {
  const choropleth = createIntelligenceLayer({layer: {...makeLayer("choropleth"), colorField: "capacity"}, source: makeSource(polygonData, "area"), onSelect: () => undefined});
  expect(choropleth).not.toBeNull();

  let picked: {id: string; properties: Record<string, unknown>} | undefined;
  const h3 = createIntelligenceLayer({
    layer: makeLayer("h3"),
    source: makeSource(pointData, "point"),
    onSelect: (selection) => { picked = {id: selection.id, properties: selection.properties}; },
  }) as unknown as {props: {data: Array<Record<string, unknown>>; onClick: (info: {object: Record<string, unknown>}) => void}};
  expect(h3.props.data).toHaveLength(1);
  h3.props.onClick({object: h3.props.data[0]});
  expect(picked?.id).toMatch(/^[0-9a-f]+$/);
  expect(picked?.properties.count).toBe(1);

  const filteredData: RenderCollection = {type: "FeatureCollection", features: [
    ...pointData.features,
    {type: "Feature", geometry: {type: "Point", coordinates: [-73.76, 42.68]}, properties: {id: "facility-2", capacity: 5}},
  ]};
  const filtered = createIntelligenceLayer({
    layer: {...makeLayer("symbol"), filterField: "capacity", filterValue: 20},
    source: makeSource(filteredData, "point"),
    onSelect: () => undefined,
  }) as unknown as {props: {data: unknown[]}};
  expect(filtered.props.data).toHaveLength(1);

  const early = createIntelligenceLayer({layer: makeLayer("trip"), source: makeSource(tripData, "area"), onSelect: () => undefined, timeCurrent: 30}) as unknown as {props: {data: Array<{path: unknown[]}>}};
  const complete = createIntelligenceLayer({layer: makeLayer("trip"), source: makeSource(tripData, "area"), onSelect: () => undefined, timeCurrent: 60}) as unknown as {props: {data: Array<{path: unknown[]}>}};
  expect(early.props.data[0].path).toHaveLength(2);
  expect(complete.props.data[0].path).toHaveLength(3);
});

test("route and temporal factories fail closed unless geometry and semantic fields qualify", () => {
  expect(canRenderMark("path", plainLineData)).toBe(false);
  expect(canRenderMark("path", routeData)).toBe(true);
  expect(canRenderMark("trip", routeData)).toBe(false);
  expect(canRenderMark("trip", tripData)).toBe(true);
  expect(canRenderMark("isochrone", isochroneData)).toBe(true);
  expect(canRenderMark("isochrone", {...isochroneData, features: isochroneData.features.map((feature) => ({...feature, properties: {id: "not-routed"}}))})).toBe(false);
  expect(createIntelligenceLayer({layer: makeLayer("path"), source: makeSource(routeData, "area"), onSelect: () => undefined})).not.toBeNull();
  expect(createIntelligenceLayer({layer: makeLayer("trip"), source: makeSource(tripData, "area"), onSelect: () => undefined, timeCurrent: 30})).not.toBeNull();
});

function makeSource(data: RenderCollection, geometry: IntelligenceSource["geometry"]): IntelligenceSource {
  return {
    id: "test-source",
    label: "Test source",
    description: "Bounded fixture",
    data,
    geometry,
    reference: {kind: "analysis-dataset", datasetId: "test-source"},
    geometryTypes: geometry === "point" ? ["Point"] : [data.features[0]?.geometry.type === "LineString" ? "LineString" : "Polygon"],
    fields: [
      {name: "id", label: "ID", type: "string", nullable: false},
      {name: "capacity", label: "Capacity", type: "number", nullable: true},
      {name: "timestamps", label: "Timestamps", type: "string", nullable: true},
    ],
    status: "ready",
    provenance: {publisher: "Test", vintage: "2026", license: "Fixture", note: "Test only"},
  };
}

function makeLayer(mark: IntelligenceLayerState["mark"]): IntelligenceLayerState {
  return {id: `test-${mark}`, sourceId: "test-source", label: "Test layer", mark, supportedMarks: [mark], visible: true, opacity: .8, weightField: "capacity", filterMin: 0, filterMax: 100, filterValue: 0, legend: {title: "Test", low: "Low", high: "High", colors: ["#fff", "#000"]}};
}
