import {
  assertIntelligenceViewV1,
  type IntelligenceLayerV1,
  type IntelligenceSourceV1,
  type MapGapIntelligenceViewV1,
} from "@mapgap/project-contract/intelligence";
import type {CanonicalSelection} from "./adapters/analysis-to-datasets";
import {isPickableMark, type IntelligenceLayerState, type IntelligenceSource} from "./map/intelligence-layers";

/**
 * Serializes live application state into the renderer-neutral view contract.
 * Calling this at the runtime boundary keeps deck/MapLibre props out of saved
 * or shared state and fails closed if a future UI creates an invalid view.
 */
export function makePortableIntelligenceView(input: {
  id: string;
  title: string;
  sources: IntelligenceSource[];
  layers: IntelligenceLayerState[];
  selection: CanonicalSelection | null;
  linkedToV2: boolean;
  viewport: MapGapIntelligenceViewV1["viewport"];
}): MapGapIntelligenceViewV1 {
  const sources = input.sources.map(toPortableSource);
  const sourceIds = new Set(sources.map((source) => source.id));
  const layers = input.layers.map((layer, order) => toPortableLayer(layer, order, sources));
  const selection = input.selection && sourceIds.has(input.selection.datasetId)
    ? {
        sourceId: input.selection.datasetId,
        entityId: input.selection.id,
        layerId: layers.find((layer) => layer.sourceId === input.selection?.datasetId)?.id,
      }
    : undefined;

  return assertIntelligenceViewV1({
    schemaVersion: "mapgap-intelligence-view/v1",
    id: input.id,
    title: input.title,
    sources,
    layers,
    workspace: {
      title: "Location intelligence",
      layout: "adaptive",
      activeLayerId: layers[0]?.id,
      layerPanel: "closed",
      inspector: "open",
      legendPlacement: "panel",
    },
    viewport: input.viewport,
    ...(selection ? {activeSelection: selection} : {}),
    link: {
      target: "mapgap-v2",
      mode: input.linkedToV2 ? "camera" : "none",
      direction: "from-target",
    },
  });
}

function toPortableSource(source: IntelligenceSource): IntelligenceSourceV1 {
  return {
    id: source.id,
    label: source.label,
    reference: source.reference,
    geometryTypes: source.geometryTypes,
    fields: source.fields,
    ...(source.fields.some((field) => field.name === "id") ? {idField: "id"} : {}),
  };
}

function toPortableLayer(
  layer: IntelligenceLayerState,
  order: number,
  sources: IntelligenceSourceV1[],
): IntelligenceLayerV1 {
  const source = sources.find((entry) => entry.id === layer.sourceId);
  const fieldNames = new Set(source?.fields.map((field) => field.name) ?? []);
  const encodings: IntelligenceLayerV1["encodings"] = {
    opacity: {kind: "value", value: layer.opacity},
  };
  if (layer.colorField && fieldNames.has(layer.colorField)) {
    encodings.color = {kind: "field", field: layer.colorField, scale: {type: "linear", clamp: true}};
  }
  if (layer.weightField && fieldNames.has(layer.weightField)) {
    encodings.weight = {kind: "field", field: layer.weightField, scale: {type: "sqrt", clamp: true}};
  }
  const filters: IntelligenceLayerV1["filters"] = [];
  if (layer.filterField && fieldNames.has(layer.filterField)) {
    filters.push({
      id: `${layer.id}-minimum`,
      field: layer.filterField,
      operator: "gte",
      value: layer.filterValue,
    });
  }
  return {
    id: layer.id,
    label: layer.label,
    sourceId: layer.sourceId,
    mark: layer.mark,
    visible: layer.visible,
    order,
    opacity: layer.opacity,
    encodings,
    filters,
    legend: {
      visible: true,
      title: layer.legend.title,
      placement: "panel",
      missing: {label: "No data"},
    },
    pickable: isPickableMark(layer.mark),
    selectable: isPickableMark(layer.mark),
  };
}
