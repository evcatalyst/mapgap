import type {Layer} from "@deck.gl/core";
import type {Feature, FeatureCollection, Geometry} from "geojson";
import {GridLayer, HeatmapLayer, HexagonLayer} from "@deck.gl/aggregation-layers";
import {GeoJsonLayer, PathLayer, PolygonLayer, ScatterplotLayer} from "@deck.gl/layers";
import {cellToBoundary, latLngToCell} from "h3-js";
import type {
  IntelligenceFieldV1,
  IntelligenceGeometryTypeV1,
  IntelligenceSourceReferenceV1,
} from "@mapgap/project-contract/intelligence";
import type {CanonicalSelection} from "../adapters/analysis-to-datasets";

export type IntelligenceMark = "choropleth" | "symbol" | "heat" | "hex" | "grid" | "h3" | "isochrone" | "path" | "trip";

export function isPickableMark(mark: IntelligenceMark) {
  return ["choropleth", "symbol", "h3", "isochrone"].includes(mark);
}
export type RenderFeature = Feature<Geometry, Record<string, unknown>>;
export type RenderCollection = FeatureCollection<Geometry, Record<string, unknown>>;

export type IntelligenceSource = {
  id: string;
  label: string;
  description: string;
  data: RenderCollection | null;
  geometry: "point" | "area";
  reference: IntelligenceSourceReferenceV1;
  geometryTypes: IntelligenceGeometryTypeV1[];
  fields: IntelligenceFieldV1[];
  provenance: {
    publisher: string;
    vintage: string;
    license: string;
    note: string;
  };
  status: "ready" | "failed";
  error?: string;
};

export type IntelligenceLayerState = {
  id: string;
  sourceId: string;
  label: string;
  mark: IntelligenceMark;
  supportedMarks: IntelligenceMark[];
  visible: boolean;
  opacity: number;
  colorField?: string;
  weightField?: string;
  filterField?: string;
  filterMin: number;
  filterMax: number;
  filterValue: number;
  legend: {title: string; low: string; high: string; colors: [string, string]};
};

type LayerFactoryOptions = {
  layer: IntelligenceLayerState;
  source: IntelligenceSource;
  onSelect: (selection: CanonicalSelection) => void;
  /** Numeric route time used only by a semantically qualified trip source. */
  timeCurrent?: number;
};

/** Creates only the selected deck primitive; source data identity is preserved. */
export function createIntelligenceLayer({layer, source, onSelect, timeCurrent}: LayerFactoryOptions): Layer | null {
  if (!source.data || source.status !== "ready" || !layer.visible) return null;
  if (!layer.supportedMarks.includes(layer.mark)) return null;
  if (!canRenderMark(layer.mark, source.data)) return null;
  const data = filterCollection(source.data, layer);
  const common = {
    // deck.gl cannot reuse one id across different Layer subclasses during a
    // visualization switch; include the portable mark while retaining the
    // stable workspace layer id in application state.
    id: `${layer.id}-${layer.mark}`,
    opacity: layer.opacity,
  };
  const handlePick = (feature: RenderFeature | null | undefined) => {
    if (!feature) return;
    const id = String(feature.properties.id ?? feature.properties.geoid ?? feature.id ?? `${layer.id}-feature`);
    const label = String(feature.properties.label ?? feature.properties.name ?? id);
    onSelect({id, label, datasetId: source.id, geometry: feature.geometry as CanonicalSelection["geometry"], properties: {...feature.properties}});
  };

  if (layer.mark === "choropleth" || layer.mark === "isochrone") {
    return new GeoJsonLayer<Record<string, unknown>>({
      ...common,
      pickable: true,
      data,
      filled: true,
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: [255, 255, 255, 210],
      getFillColor: (feature) => colorForValue(feature.properties[layer.colorField ?? ""], layer),
      onClick: (info) => handlePick(info.object as RenderFeature | null),
      updateTriggers: {getFillColor: [layer.colorField, layer.filterValue]},
    });
  }

  const pointData = pointFeatures(data);
  const weightedPointData = layer.weightField
    ? pointData.filter((feature) => numberOrNull(feature.properties[layer.weightField!]) !== null)
    : pointData;
  if (layer.mark === "symbol") {
    return new ScatterplotLayer<RenderFeature>({
      ...common,
      pickable: true,
      data: weightedPointData,
      getPosition: pointPosition,
      getRadius: (feature) => 420 + Math.sqrt(Math.max(0, numeric(feature.properties[layer.weightField ?? ""]))) * 90,
      radiusMinPixels: 7,
      radiusMaxPixels: 28,
      getFillColor: (feature) => colorForValue(feature.properties[layer.colorField ?? layer.weightField ?? ""], layer),
      getLineColor: [255, 255, 255, 245],
      lineWidthMinPixels: 2,
      stroked: true,
      updateTriggers: {getRadius: [layer.weightField], getFillColor: [layer.colorField, layer.weightField]},
      onClick: (info) => handlePick(info.object),
    });
  }
  if (layer.mark === "heat") {
    return new HeatmapLayer<RenderFeature>({
      ...common,
      pickable: false,
      data: weightedPointData,
      getPosition: pointPosition,
      getWeight: (feature) => Math.max(1, numeric(feature.properties[layer.weightField ?? ""])),
      radiusPixels: 54,
      intensity: 1.4,
      threshold: 0.04,
      updateTriggers: {getWeight: [layer.weightField]},
    });
  }
  if (layer.mark === "hex") {
    return new HexagonLayer<RenderFeature>({
      ...common,
      pickable: false,
      data: weightedPointData,
      getPosition: pointPosition,
      getColorWeight: (feature) => Math.max(1, numeric(feature.properties[layer.weightField ?? ""])),
      colorAggregation: "SUM",
      radius: 850,
      extruded: false,
      coverage: 0.88,
      colorRange: [[225, 244, 254], [125, 211, 252], [14, 165, 233], [3, 105, 161], [8, 47, 73]],
      updateTriggers: {getColorWeight: [layer.weightField]},
    });
  }
  if (layer.mark === "h3") {
    const cells = aggregateH3(weightedPointData, layer.weightField);
    return new PolygonLayer<{cell: string; count: number; weight: number; polygon: Array<[number, number]>}>({
      ...common,
      pickable: true,
      data: cells,
      getPolygon: (entry) => entry.polygon,
      getFillColor: (entry) => colorRamp(entry.weight, layer),
      getLineColor: [255, 255, 255, 220],
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
      onClick: (info) => {
        const cell = info.object;
        if (!cell) return;
        onSelect({
          id: cell.cell,
          label: `H3 cell ${cell.cell}`,
          datasetId: source.id,
          geometry: {type: "Polygon", coordinates: [[...cell.polygon, cell.polygon[0]]]},
          properties: {h3: cell.cell, count: cell.count, weight: cell.weight},
        });
      },
    });
  }
  if (layer.mark === "path") {
    const paths = pathRecords(data);
    return new PathLayer<{path: Array<[number, number]>; feature: RenderFeature}>({
      ...common,
      pickable: false,
      data: paths,
      getPath: (entry) => entry.path,
      getColor: [7, 114, 101, 230],
      getWidth: 5,
      widthMinPixels: 3,
      jointRounded: true,
      capRounded: true,
    });
  }
  if (layer.mark === "trip") {
    const trips = tripRecords(data);
    const maximum = Math.max(1, ...trips.flatMap((entry) => entry.timestamps));
    const currentTime = Number.isFinite(timeCurrent) ? Math.max(0, Math.min(maximum, timeCurrent!)) : maximum;
    const visibleTrips = trips.map((entry) => ({...entry, path: entry.path.filter((_, index) => entry.timestamps[index] <= currentTime)})).filter((entry) => entry.path.length >= 2);
    return new PathLayer<{path: Array<[number, number]>; timestamps: number[]; feature: RenderFeature}>({
      ...common,
      pickable: false,
      id: `${layer.id}-time-${currentTime}`,
      data: visibleTrips,
      getPath: (entry) => entry.path,
      getColor: [7, 114, 101],
      widthMinPixels: 4,
    });
  }
  return new GridLayer<RenderFeature>({
    ...common,
    pickable: false,
    data: weightedPointData,
    getPosition: pointPosition,
    getColorWeight: (feature) => Math.max(1, numeric(feature.properties[layer.weightField ?? ""])),
    colorAggregation: "SUM",
    cellSize: 900,
    extruded: false,
    colorRange: [[236, 253, 245], [167, 243, 208], [52, 211, 153], [5, 150, 105], [6, 78, 59]],
    updateTriggers: {getColorWeight: [layer.weightField]},
  });
}

/** Geometry and semantic gates prevent density marks from impersonating routes. */
export function canRenderMark(mark: IntelligenceMark, data: RenderCollection) {
  if (!data.features.length) return false;
  if (["symbol", "heat", "hex", "grid", "h3"].includes(mark)) return data.features.every((feature) => feature.geometry.type === "Point");
  if (mark === "choropleth") return data.features.every((feature) => feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon");
  if (mark === "isochrone") return data.features.every((feature) =>
    (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")
      && typeof feature.properties.timeMinutes === "number"
      && typeof feature.properties.routingProvider === "string",
  );
  if (mark === "path") return data.features.every((feature) =>
    (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString")
      && feature.properties.routeKind === "routed-path"
      && typeof feature.properties.routingProvider === "string",
  );
  if (mark === "trip") return data.features.every((feature) => {
    if (
      feature.geometry.type !== "LineString"
      || !("coordinates" in feature.geometry)
      || feature.properties.routeKind !== "routed-path"
      || typeof feature.properties.routingProvider !== "string"
      || !Array.isArray(feature.properties.timestamps)
    ) return false;
    return feature.properties.timestamps.length === feature.geometry.coordinates.length
      && feature.properties.timestamps.every((value) => typeof value === "number" && Number.isFinite(value));
  });
  return false;
}

export function createSelectionLayer(selection: CanonicalSelection | null): Layer | null {
  if (!selection) return null;
  return new GeoJsonLayer({
    id: "mapgap-shared-selection",
    data: {type: "Feature", geometry: selection.geometry, properties: {label: selection.label}},
    pickable: false,
    filled: true,
    stroked: true,
    getFillColor: [215, 255, 111, 70],
    getLineColor: [11, 59, 53, 255],
    getLineWidth: 4,
    lineWidthMinPixels: 4,
    pointRadiusMinPixels: 14,
  });
}

function filterCollection(data: RenderCollection, layer: IntelligenceLayerState): RenderCollection {
  if (!layer.filterField) return data;
  return {
    type: "FeatureCollection",
    features: data.features.filter((feature) => {
      const value = numberOrNull(feature.properties[layer.filterField!]);
      return value !== null && value >= layer.filterValue;
    }),
  };
}

function pointFeatures(data: RenderCollection): RenderFeature[] {
  return data.features.flatMap((feature) => {
    if (feature.geometry.type === "Point") return [feature];
    const center = centroid("coordinates" in feature.geometry ? feature.geometry.coordinates : null);
    return center ? [{...feature, geometry: {type: "Point", coordinates: center}}] : [];
  });
}

function pointPosition(feature: RenderFeature): [number, number] {
  return (feature.geometry as {type: "Point"; coordinates: [number, number]}).coordinates;
}

function aggregateH3(features: RenderFeature[], weightField?: string) {
  const cells = new Map<string, {cell: string; count: number; weight: number; polygon: Array<[number, number]>}>();
  for (const feature of features) {
    const [lng, lat] = pointPosition(feature);
    const cell = latLngToCell(lat, lng, 8);
    const existing = cells.get(cell);
    const weight = Math.max(1, numeric(feature.properties[weightField ?? ""]));
    if (existing) {
      existing.count += 1;
      existing.weight += weight;
    } else {
      cells.set(cell, {cell, count: 1, weight, polygon: cellToBoundary(cell, true) as Array<[number, number]>});
    }
  }
  return [...cells.values()];
}

function pathRecords(data: RenderCollection) {
  return data.features.flatMap((feature) => {
    if (!("coordinates" in feature.geometry)) return [];
    if (feature.geometry.type === "LineString") return [{path: feature.geometry.coordinates as Array<[number, number]>, feature}];
    if (feature.geometry.type === "MultiLineString") return (feature.geometry.coordinates as Array<Array<[number, number]>>).map((path) => ({path, feature}));
    return [];
  });
}

function tripRecords(data: RenderCollection) {
  return data.features.flatMap((feature) => {
    if (feature.geometry.type !== "LineString" || !("coordinates" in feature.geometry) || !Array.isArray(feature.properties.timestamps)) return [];
    return [{path: feature.geometry.coordinates as Array<[number, number]>, timestamps: feature.properties.timestamps as number[], feature}];
  });
}

function centroid(value: unknown): [number, number] | null {
  const positions: Array<[number, number]> = [];
  collectPositions(value, positions);
  if (!positions.length) return null;
  return [positions.reduce((sum, value) => sum + value[0], 0) / positions.length, positions.reduce((sum, value) => sum + value[1], 0) / positions.length];
}

function collectPositions(value: unknown, output: Array<[number, number]>) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    output.push([value[0], value[1]]);
    return;
  }
  value.forEach((entry) => collectPositions(entry, output));
}

function numeric(value: unknown) {
  return numberOrNull(value) ?? 0;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function colorForValue(value: unknown, layer: IntelligenceLayerState): [number, number, number, number] {
  const number = numberOrNull(value);
  return number === null ? [96, 116, 112, 85] : colorRamp(number, layer);
}

function colorRamp(value: number, layer: IntelligenceLayerState): [number, number, number, number] {
  const span = Math.max(1, layer.filterMax - layer.filterMin);
  const ratio = Math.max(0, Math.min(1, (value - layer.filterMin) / span));
  const low: [number, number, number] = [190, 242, 232];
  const high: [number, number, number] = [190, 48, 72];
  return [
    Math.round(low[0] + (high[0] - low[0]) * ratio),
    Math.round(low[1] + (high[1] - low[1]) * ratio),
    Math.round(low[2] + (high[2] - low[2]) * ratio),
    230,
  ];
}
