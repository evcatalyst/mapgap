/**
 * Renderer-neutral visual-intelligence view contract.
 *
 * This contract describes what MapGap should show, never how a particular
 * map renderer should implement it. Data remains in an analysis bundle (or a
 * governed remote source); this document only carries portable view intent.
 */

export const INTELLIGENCE_VIEW_SCHEMA_VERSION = "mapgap-intelligence-view/v1" as const;

export const INTELLIGENCE_VIEW_LIMITS = {
  maxSources: 32,
  maxLayers: 64,
  maxFiltersPerLayer: 32,
  maxTotalFilters: 256,
  maxEncodingsPerLayer: 16,
  maxScaleValues: 64,
  maxStringLength: 2_048,
  maxTotalStringLength: 131_072,
} as const;

export type IntelligenceGeometryTypeV1 =
  | "Point"
  | "MultiPoint"
  | "LineString"
  | "MultiLineString"
  | "Polygon"
  | "MultiPolygon"
  | "Raster";

export type IntelligenceFieldTypeV1 =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "datetime";

export type IntelligenceFieldV1 = {
  name: string;
  label: string;
  type: IntelligenceFieldTypeV1;
  nullable: boolean;
};

export type IntelligenceSourceReferenceV1 =
  | {
      kind: "analysis-dataset";
      datasetId: string;
    }
  | {
      kind: "project-dataset";
      datasetId: string;
    }
  | {
      kind: "remote";
      format: "geojson" | "arrow" | "pmtiles" | "raster-tile" | "vector-tile";
      url: string;
      sourceLayer?: string;
    };

export type IntelligenceSourceV1 = {
  id: string;
  label: string;
  reference: IntelligenceSourceReferenceV1;
  geometryTypes: IntelligenceGeometryTypeV1[];
  fields: IntelligenceFieldV1[];
  idField?: string;
};

export type IntelligenceMarkV1 =
  | "symbol"
  | "cluster"
  | "density"
  | "heat"
  | "hex"
  | "grid"
  | "h3"
  | "choropleth"
  | "extrusion"
  | "path"
  | "isochrone"
  | "trip"
  | "raster"
  | "vector-tile";

export type IntelligenceScaleV1 = {
  type: "linear" | "log" | "sqrt" | "ordinal" | "threshold" | "quantile" | "time";
  domain?: Array<string | number>;
  range?: Array<string | number>;
  clamp?: boolean;
};

export type IntelligenceEncodingV1 =
  | {
      kind: "field";
      field: string;
      scale?: IntelligenceScaleV1;
    }
  | {
      kind: "value";
      value: string | number | boolean;
    };

export type IntelligenceEncodingChannelV1 =
  | "color"
  | "fillColor"
  | "strokeColor"
  | "opacity"
  | "radius"
  | "size"
  | "height"
  | "width"
  | "weight"
  | "label"
  | "startTime"
  | "endTime";

export type IntelligenceFilterV1 =
  | {
      id: string;
      field: string;
      operator: "eq" | "not-eq" | "gt" | "gte" | "lt" | "lte";
      value: string | number | boolean;
    }
  | {
      id: string;
      field: string;
      operator: "in" | "not-in";
      values: Array<string | number | boolean>;
    }
  | {
      id: string;
      field: string;
      operator: "range";
      min: number;
      max: number;
    }
  | {
      id: string;
      field: string;
      operator: "exists";
      value: boolean;
    };

export type IntelligenceLegendV1 = {
  visible: boolean;
  title: string;
  placement: "top-right" | "bottom-right" | "bottom-left" | "panel";
  missing: {
    label: string;
    color?: string;
  };
};

export type IntelligenceLayerV1 = {
  id: string;
  label: string;
  sourceId: string;
  mark: IntelligenceMarkV1;
  visible: boolean;
  order: number;
  opacity: number;
  encodings: Partial<Record<IntelligenceEncodingChannelV1, IntelligenceEncodingV1>>;
  filters: IntelligenceFilterV1[];
  legend: IntelligenceLegendV1;
  pickable: boolean;
  selectable: boolean;
};

export type IntelligenceEntityRefV1 = {
  sourceId: string;
  entityId: string | number;
  layerId?: string;
};

export type IntelligenceViewportV1 = {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
};

export type IntelligenceMapLinkV1 = {
  target: "mapgap-v2";
  mode: "none" | "center" | "camera";
  direction: "from-target" | "bidirectional";
};

export type IntelligenceTimeV1 = {
  start: string;
  end: string;
  current: string;
  windowSeconds?: number;
  playing: boolean;
  loop: boolean;
};

export type IntelligenceWorkspaceV1 = {
  title: string;
  layout: "adaptive" | "split" | "intelligence-only";
  activeLayerId?: string;
  layerPanel: "open" | "closed";
  inspector: "open" | "closed";
  legendPlacement: "panel" | "map";
};

export type MapGapIntelligenceViewV1 = {
  schemaVersion: typeof INTELLIGENCE_VIEW_SCHEMA_VERSION;
  id: string;
  title: string;
  sources: IntelligenceSourceV1[];
  layers: IntelligenceLayerV1[];
  workspace: IntelligenceWorkspaceV1;
  activeSelection?: IntelligenceEntityRefV1;
  viewport?: IntelligenceViewportV1;
  link?: IntelligenceMapLinkV1;
  time?: IntelligenceTimeV1;
};

export type IntelligenceViewValidationResultV1 =
  | { ok: true; view: MapGapIntelligenceViewV1 }
  | { ok: false; issues: string[] };

const MARKS: IntelligenceMarkV1[] = [
  "symbol", "cluster", "density", "heat", "hex", "grid", "h3",
  "choropleth", "extrusion", "path", "isochrone", "trip", "raster", "vector-tile",
];
const GEOMETRIES: IntelligenceGeometryTypeV1[] = [
  "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "Raster",
];
const FIELD_TYPES: IntelligenceFieldTypeV1[] = ["string", "number", "integer", "boolean", "datetime"];
const CHANNELS: IntelligenceEncodingChannelV1[] = [
  "color", "fillColor", "strokeColor", "opacity", "radius", "size", "height", "width", "weight",
  "label", "startTime", "endTime",
];
const NUMERIC_CHANNELS = new Set<IntelligenceEncodingChannelV1>([
  "opacity", "radius", "size", "height", "width", "weight",
]);
const TIME_CHANNELS = new Set<IntelligenceEncodingChannelV1>(["startTime", "endTime"]);

/** Validates untrusted persisted view state and fails closed on future versions. */
export function parseIntelligenceViewV1(value: unknown): IntelligenceViewValidationResultV1 {
  if (!isRecord(value)) return { ok: false, issues: ["Intelligence view must be an object."] };
  const issues: string[] = [];
  exactKeys(value, ["schemaVersion", "id", "title", "sources", "layers", "workspace", "activeSelection", "viewport", "link", "time"], "view", issues);
  if (value.schemaVersion !== INTELLIGENCE_VIEW_SCHEMA_VERSION) {
    issues.push(`Unsupported intelligence view schema version: ${stringify(value.schemaVersion)}.`);
  }
  requireString(value.id, "view.id", issues, 128);
  requireString(value.title, "view.title", issues);

  const sources = validateSources(value.sources, issues);
  const layers = validateLayers(value.layers, sources, issues);
  validateWorkspace(value.workspace, layers, issues);
  if (value.activeSelection !== undefined) validateSelection(value.activeSelection, sources, layers, issues);
  if (value.viewport !== undefined) validateViewport(value.viewport, issues);
  if (value.link !== undefined) validateLink(value.link, issues);
  if (value.time !== undefined) validateTime(value.time, issues);
  validateNoSecrets(value, issues);
  validateStringBudget(value, issues);

  if (issues.length > 0) return { ok: false, issues: unique(issues) };
  return { ok: true, view: cloneJson(value) as MapGapIntelligenceViewV1 };
}

export function assertIntelligenceViewV1(value: unknown): MapGapIntelligenceViewV1 {
  const result = parseIntelligenceViewV1(value);
  if (!result.ok) throw new Error(`Invalid MapGap intelligence view: ${result.issues.join(" ")}`);
  return result.view;
}

export function cloneIntelligenceViewV1(view: MapGapIntelligenceViewV1): MapGapIntelligenceViewV1 {
  return assertIntelligenceViewV1(view);
}

function validateSources(value: unknown, issues: string[]) {
  const sources = new Map<string, IntelligenceSourceV1>();
  if (!Array.isArray(value)) {
    issues.push("sources must be an array.");
    return sources;
  }
  if (value.length > INTELLIGENCE_VIEW_LIMITS.maxSources) issues.push(`sources exceeds maxSources ${INTELLIGENCE_VIEW_LIMITS.maxSources}.`);
  value.forEach((entry, index) => {
    const label = `sources[${index}]`;
    if (!isRecord(entry)) {
      issues.push(`${label} must be an object.`);
      return;
    }
    exactKeys(entry, ["id", "label", "reference", "geometryTypes", "fields", "idField"], label, issues);
    const id = requireString(entry.id, `${label}.id`, issues, 128);
    requireString(entry.label, `${label}.label`, issues);
    if (id) {
      if (sources.has(id)) issues.push(`sources contains duplicate id ${id}.`);
      sources.set(id, entry as unknown as IntelligenceSourceV1);
    }
    const fields = validateFields(entry.fields, label, issues);
    if (entry.idField !== undefined && (!requireString(entry.idField, `${label}.idField`, issues, 128) || !fields.has(String(entry.idField)))) {
      issues.push(`${label}.idField must reference a declared field.`);
    }
    validateGeometryTypes(entry.geometryTypes, label, issues);
    validateSourceReference(entry.reference, label, issues);
  });
  return sources;
}

function validateFields(value: unknown, sourceLabel: string, issues: string[]) {
  const fields = new Map<string, IntelligenceFieldV1>();
  if (!Array.isArray(value)) {
    issues.push(`${sourceLabel}.fields must be an array.`);
    return fields;
  }
  if (value.length > 256) issues.push(`${sourceLabel}.fields exceeds 256 fields.`);
  value.forEach((entry, index) => {
    const label = `${sourceLabel}.fields[${index}]`;
    if (!isRecord(entry)) {
      issues.push(`${label} must be an object.`);
      return;
    }
    exactKeys(entry, ["name", "label", "type", "nullable"], label, issues);
    const name = requireString(entry.name, `${label}.name`, issues, 128);
    requireString(entry.label, `${label}.label`, issues);
    if (!FIELD_TYPES.includes(entry.type as IntelligenceFieldTypeV1)) issues.push(`${label}.type is unsupported.`);
    if (typeof entry.nullable !== "boolean") issues.push(`${label}.nullable must be boolean.`);
    if (name) {
      if (fields.has(name)) issues.push(`${sourceLabel}.fields contains duplicate field ${name}.`);
      fields.set(name, entry as unknown as IntelligenceFieldV1);
    }
  });
  return fields;
}

function validateGeometryTypes(value: unknown, label: string, issues: string[]) {
  if (!Array.isArray(value) || value.length === 0 || value.some((type) => !GEOMETRIES.includes(type as IntelligenceGeometryTypeV1))) {
    issues.push(`${label}.geometryTypes must contain supported geometry types.`);
    return;
  }
  if (new Set(value).size !== value.length) issues.push(`${label}.geometryTypes contains duplicates.`);
}

function validateSourceReference(value: unknown, label: string, issues: string[]) {
  const nested = `${label}.reference`;
  if (!isRecord(value)) {
    issues.push(`${nested} must be an object.`);
    return;
  }
  if (value.kind === "analysis-dataset" || value.kind === "project-dataset") {
    exactKeys(value, ["kind", "datasetId"], nested, issues);
    requireString(value.datasetId, `${nested}.datasetId`, issues, 256);
    return;
  }
  if (value.kind !== "remote") {
    issues.push(`${nested}.kind is unsupported.`);
    return;
  }
  exactKeys(value, ["kind", "format", "url", "sourceLayer"], nested, issues);
  const formats = ["geojson", "arrow", "pmtiles", "raster-tile", "vector-tile"];
  if (!formats.includes(String(value.format))) issues.push(`${nested}.format is unsupported.`);
  if (!safeRemoteUrl(value.url)) issues.push(`${nested}.url must be a credential-free HTTPS URL.`);
  if (value.format === "raster-tile" || value.format === "vector-tile") {
    const url = String(value.url ?? "");
    if (!url.includes("{z}") || !url.includes("{x}") || !url.includes("{y}")) issues.push(`${nested}.url must include {z}, {x}, and {y}.`);
  }
  if (value.format === "vector-tile") requireString(value.sourceLayer, `${nested}.sourceLayer`, issues, 256);
  else if (value.sourceLayer !== undefined) issues.push(`${nested}.sourceLayer is only valid for vector-tile sources.`);
}

function validateLayers(value: unknown, sources: Map<string, IntelligenceSourceV1>, issues: string[]) {
  const layers = new Map<string, IntelligenceLayerV1>();
  const orders = new Set<number>();
  let totalFilters = 0;
  if (!Array.isArray(value)) {
    issues.push("layers must be an array.");
    return layers;
  }
  if (value.length > INTELLIGENCE_VIEW_LIMITS.maxLayers) issues.push(`layers exceeds maxLayers ${INTELLIGENCE_VIEW_LIMITS.maxLayers}.`);
  value.forEach((entry, index) => {
    const label = `layers[${index}]`;
    if (!isRecord(entry)) {
      issues.push(`${label} must be an object.`);
      return;
    }
    exactKeys(entry, ["id", "label", "sourceId", "mark", "visible", "order", "opacity", "encodings", "filters", "legend", "pickable", "selectable"], label, issues);
    const id = requireString(entry.id, `${label}.id`, issues, 128);
    requireString(entry.label, `${label}.label`, issues);
    const sourceId = requireString(entry.sourceId, `${label}.sourceId`, issues, 128);
    const source = sourceId ? sources.get(sourceId) : undefined;
    if (sourceId && !source) issues.push(`${label}.sourceId references missing source ${sourceId}.`);
    if (id) {
      if (layers.has(id)) issues.push(`layers contains duplicate id ${id}.`);
      layers.set(id, entry as unknown as IntelligenceLayerV1);
    }
    if (!MARKS.includes(entry.mark as IntelligenceMarkV1)) issues.push(`${label}.mark is unsupported.`);
    if (typeof entry.visible !== "boolean") issues.push(`${label}.visible must be boolean.`);
    if (!integerInRange(entry.order, 0, INTELLIGENCE_VIEW_LIMITS.maxLayers - 1)) issues.push(`${label}.order must be an integer between 0 and ${INTELLIGENCE_VIEW_LIMITS.maxLayers - 1}.`);
    else if (orders.has(entry.order)) issues.push(`layers contains duplicate order ${entry.order}.`);
    else orders.add(entry.order);
    if (!numberInRange(entry.opacity, 0, 1)) issues.push(`${label}.opacity must be between 0 and 1.`);
    if (typeof entry.pickable !== "boolean" || typeof entry.selectable !== "boolean") issues.push(`${label}.pickable and selectable must be boolean.`);
    if (entry.selectable === true && entry.pickable !== true) issues.push(`${label} cannot be selectable when pickable is false.`);
    if (source && MARKS.includes(entry.mark as IntelligenceMarkV1)) validateMarkCompatibility(entry.mark as IntelligenceMarkV1, source, label, issues);
    validateEncodings(entry.encodings, source, label, issues);
    totalFilters += validateFilters(entry.filters, source, label, issues);
    validateLegend(entry.legend, label, issues);
  });
  if (totalFilters > INTELLIGENCE_VIEW_LIMITS.maxTotalFilters) issues.push(`layers exceed maxTotalFilters ${INTELLIGENCE_VIEW_LIMITS.maxTotalFilters}.`);
  return layers;
}

function validateMarkCompatibility(mark: IntelligenceMarkV1, source: IntelligenceSourceV1, label: string, issues: string[]) {
  const allowed: Partial<Record<IntelligenceMarkV1, IntelligenceGeometryTypeV1[]>> = {
    symbol: ["Point", "MultiPoint"],
    cluster: ["Point", "MultiPoint"],
    density: ["Point", "MultiPoint"],
    heat: ["Point", "MultiPoint"],
    hex: ["Point", "MultiPoint"],
    grid: ["Point", "MultiPoint"],
    h3: ["Point", "MultiPoint", "Polygon", "MultiPolygon"],
    choropleth: ["Polygon", "MultiPolygon"],
    extrusion: ["Polygon", "MultiPolygon"],
    path: ["LineString", "MultiLineString"],
    isochrone: ["Polygon", "MultiPolygon"],
    trip: ["LineString", "MultiLineString"],
    raster: ["Raster"],
  };
  const expected = allowed[mark];
  if (expected && !source.geometryTypes.some((type) => expected.includes(type))) {
    issues.push(`${label}.mark ${mark} is incompatible with source geometryTypes.`);
  }
  const reference = source.reference;
  if (mark === "raster" && !(reference.kind === "remote" && reference.format === "raster-tile")) {
    issues.push(`${label}.mark raster requires a raster-tile source.`);
  }
  if (mark === "vector-tile" && !(reference.kind === "remote" && reference.format === "vector-tile")) {
    issues.push(`${label}.mark vector-tile requires a vector-tile source.`);
  }
}

function validateEncodings(value: unknown, source: IntelligenceSourceV1 | undefined, layerLabel: string, issues: string[]) {
  const label = `${layerLabel}.encodings`;
  if (!isRecord(value)) {
    issues.push(`${label} must be an object.`);
    return;
  }
  const keys = Object.keys(value);
  if (keys.length > INTELLIGENCE_VIEW_LIMITS.maxEncodingsPerLayer) issues.push(`${label} exceeds maxEncodingsPerLayer.`);
  keys.forEach((channelName) => {
    if (!CHANNELS.includes(channelName as IntelligenceEncodingChannelV1)) {
      issues.push(`${label} contains unsupported channel ${channelName}.`);
      return;
    }
    const channel = channelName as IntelligenceEncodingChannelV1;
    const encoding = value[channelName];
    const encodingLabel = `${label}.${channel}`;
    if (!isRecord(encoding)) {
      issues.push(`${encodingLabel} must be an object.`);
      return;
    }
    if (encoding.kind === "field") {
      exactKeys(encoding, ["kind", "field", "scale"], encodingLabel, issues);
      const fieldName = requireString(encoding.field, `${encodingLabel}.field`, issues, 128);
      const field = fieldName ? source?.fields.find((candidate) => candidate.name === fieldName) : undefined;
      if (source && fieldName && !field) issues.push(`${encodingLabel}.field references missing field ${fieldName}.`);
      if (field && NUMERIC_CHANNELS.has(channel) && field.type !== "number" && field.type !== "integer") {
        issues.push(`${encodingLabel} requires a numeric field.`);
      }
      if (field && TIME_CHANNELS.has(channel) && !["datetime", "number", "integer"].includes(field.type)) {
        issues.push(`${encodingLabel} requires a datetime or numeric field.`);
      }
      if (encoding.scale !== undefined) validateScale(encoding.scale, field, encodingLabel, issues);
    } else if (encoding.kind === "value") {
      exactKeys(encoding, ["kind", "value"], encodingLabel, issues);
      if (!scalar(encoding.value)) issues.push(`${encodingLabel}.value must be a finite scalar.`);
      if (NUMERIC_CHANNELS.has(channel) && !finiteNumber(encoding.value)) issues.push(`${encodingLabel}.value must be numeric.`);
    } else {
      issues.push(`${encodingLabel}.kind is unsupported.`);
    }
  });
}

function validateScale(value: unknown, field: IntelligenceFieldV1 | undefined, label: string, issues: string[]) {
  if (!isRecord(value)) {
    issues.push(`${label}.scale must be an object.`);
    return;
  }
  exactKeys(value, ["type", "domain", "range", "clamp"], `${label}.scale`, issues);
  const types = ["linear", "log", "sqrt", "ordinal", "threshold", "quantile", "time"];
  if (!types.includes(String(value.type))) issues.push(`${label}.scale.type is unsupported.`);
  if (value.clamp !== undefined && typeof value.clamp !== "boolean") issues.push(`${label}.scale.clamp must be boolean.`);
  validateScaleValues(value.domain, `${label}.scale.domain`, issues);
  validateScaleValues(value.range, `${label}.scale.range`, issues);
  if (["linear", "log", "sqrt", "threshold", "quantile"].includes(String(value.type)) && field && !["number", "integer"].includes(field.type)) {
    issues.push(`${label}.scale ${String(value.type)} requires a numeric field.`);
  }
  if (value.type === "time" && field && !["datetime", "number", "integer"].includes(field.type)) issues.push(`${label}.scale time requires a datetime or numeric field.`);
  if (value.type === "log" && Array.isArray(value.domain) && value.domain.some((entry) => typeof entry !== "number" || entry <= 0)) {
    issues.push(`${label}.scale.log domain values must be positive numbers.`);
  }
}

function validateScaleValues(value: unknown, label: string, issues: string[]) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length === 0 || value.length > INTELLIGENCE_VIEW_LIMITS.maxScaleValues || value.some((entry) => typeof entry !== "string" && !finiteNumber(entry))) {
    issues.push(`${label} must contain 1-${INTELLIGENCE_VIEW_LIMITS.maxScaleValues} finite string or number values (maxScaleValues).`);
  }
}

function validateFilters(value: unknown, source: IntelligenceSourceV1 | undefined, layerLabel: string, issues: string[]) {
  const label = `${layerLabel}.filters`;
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array.`);
    return 0;
  }
  if (value.length > INTELLIGENCE_VIEW_LIMITS.maxFiltersPerLayer) issues.push(`${label} exceeds maxFiltersPerLayer ${INTELLIGENCE_VIEW_LIMITS.maxFiltersPerLayer}.`);
  const ids = new Set<string>();
  value.forEach((filter, index) => {
    const filterLabel = `${label}[${index}]`;
    if (!isRecord(filter)) {
      issues.push(`${filterLabel} must be an object.`);
      return;
    }
    const id = requireString(filter.id, `${filterLabel}.id`, issues, 128);
    if (id) {
      if (ids.has(id)) issues.push(`${label} contains duplicate id ${id}.`);
      ids.add(id);
    }
    const fieldName = requireString(filter.field, `${filterLabel}.field`, issues, 128);
    const field = fieldName ? source?.fields.find((candidate) => candidate.name === fieldName) : undefined;
    if (source && fieldName && !field) issues.push(`${filterLabel}.field references missing field ${fieldName}.`);
    if (["eq", "not-eq", "gt", "gte", "lt", "lte"].includes(String(filter.operator))) {
      exactKeys(filter, ["id", "field", "operator", "value"], filterLabel, issues);
      if (!scalar(filter.value)) issues.push(`${filterLabel}.value must be a finite scalar.`);
      if (field && ["gt", "gte", "lt", "lte"].includes(String(filter.operator)) && !["number", "integer", "datetime"].includes(field.type)) issues.push(`${filterLabel}.${String(filter.operator)} requires an ordered field.`);
    } else if (filter.operator === "in" || filter.operator === "not-in") {
      exactKeys(filter, ["id", "field", "operator", "values"], filterLabel, issues);
      if (!Array.isArray(filter.values) || filter.values.length === 0 || filter.values.length > 256 || filter.values.some((entry) => !scalar(entry))) issues.push(`${filterLabel}.values must contain 1-256 finite scalar values.`);
    } else if (filter.operator === "range") {
      exactKeys(filter, ["id", "field", "operator", "min", "max"], filterLabel, issues);
      if (!finiteNumber(filter.min) || !finiteNumber(filter.max) || filter.min > filter.max) issues.push(`${filterLabel}.range requires finite min <= max.`);
      if (field && !["number", "integer", "datetime"].includes(field.type)) issues.push(`${filterLabel}.range requires an ordered field.`);
    } else if (filter.operator === "exists") {
      exactKeys(filter, ["id", "field", "operator", "value"], filterLabel, issues);
      if (typeof filter.value !== "boolean") issues.push(`${filterLabel}.value must be boolean.`);
    } else {
      issues.push(`${filterLabel}.operator is unsupported.`);
    }
  });
  return value.length;
}

function validateLegend(value: unknown, layerLabel: string, issues: string[]) {
  const label = `${layerLabel}.legend`;
  if (!isRecord(value)) {
    issues.push(`${label} is required.`);
    return;
  }
  exactKeys(value, ["visible", "title", "placement", "missing"], label, issues);
  if (typeof value.visible !== "boolean") issues.push(`${label}.visible must be boolean.`);
  requireString(value.title, `${label}.title`, issues);
  if (!["top-right", "bottom-right", "bottom-left", "panel"].includes(String(value.placement))) issues.push(`${label}.placement is unsupported.`);
  if (!isRecord(value.missing)) issues.push(`${label}.missing must explain missing values.`);
  else {
    exactKeys(value.missing, ["label", "color"], `${label}.missing`, issues);
    requireString(value.missing.label, `${label}.missing.label`, issues);
    if (value.missing.color !== undefined) requireString(value.missing.color, `${label}.missing.color`, issues, 128);
  }
}

function validateWorkspace(value: unknown, layers: Map<string, IntelligenceLayerV1>, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("workspace is required.");
    return;
  }
  exactKeys(value, ["title", "layout", "activeLayerId", "layerPanel", "inspector", "legendPlacement"], "workspace", issues);
  requireString(value.title, "workspace.title", issues);
  if (!["adaptive", "split", "intelligence-only"].includes(String(value.layout))) issues.push("workspace.layout is unsupported.");
  if (value.activeLayerId !== undefined && (!requireString(value.activeLayerId, "workspace.activeLayerId", issues, 128) || !layers.has(String(value.activeLayerId)))) issues.push("workspace.activeLayerId must reference a layer.");
  if (!["open", "closed"].includes(String(value.layerPanel))) issues.push("workspace.layerPanel is unsupported.");
  if (!["open", "closed"].includes(String(value.inspector))) issues.push("workspace.inspector is unsupported.");
  if (!["panel", "map"].includes(String(value.legendPlacement))) issues.push("workspace.legendPlacement is unsupported.");
}

function validateSelection(value: unknown, sources: Map<string, IntelligenceSourceV1>, layers: Map<string, IntelligenceLayerV1>, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("activeSelection must be an EntityRef object.");
    return;
  }
  exactKeys(value, ["sourceId", "entityId", "layerId"], "activeSelection", issues);
  const sourceId = requireString(value.sourceId, "activeSelection.sourceId", issues, 128);
  if (sourceId && !sources.has(sourceId)) issues.push("activeSelection.sourceId must reference a source.");
  if ((typeof value.entityId !== "string" || value.entityId.length === 0) && !finiteNumber(value.entityId)) issues.push("activeSelection.entityId must be a non-empty string or finite number.");
  if (value.layerId !== undefined) {
    const layerId = requireString(value.layerId, "activeSelection.layerId", issues, 128);
    const layer = layerId ? layers.get(layerId) : undefined;
    if (!layer) issues.push("activeSelection.layerId must reference a layer.");
    else if (sourceId && layer.sourceId !== sourceId) issues.push("activeSelection layer and source must agree.");
    else if (!layer.selectable) issues.push("activeSelection.layerId must reference a selectable layer.");
  }
}

function validateViewport(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("viewport must be an object.");
    return;
  }
  exactKeys(value, ["longitude", "latitude", "zoom", "bearing", "pitch"], "viewport", issues);
  if (!numberInRange(value.longitude, -180, 180)) issues.push("viewport.longitude must be between -180 and 180.");
  if (!numberInRange(value.latitude, -90, 90)) issues.push("viewport.latitude must be between -90 and 90.");
  if (!numberInRange(value.zoom, 0, 24)) issues.push("viewport.zoom must be between 0 and 24.");
  if (!numberInRange(value.bearing, -180, 180)) issues.push("viewport.bearing must be between -180 and 180.");
  if (!numberInRange(value.pitch, 0, 85)) issues.push("viewport.pitch must be between 0 and 85.");
}

function validateLink(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("link must be an object.");
    return;
  }
  exactKeys(value, ["target", "mode", "direction"], "link", issues);
  if (value.target !== "mapgap-v2") issues.push("link.target is unsupported.");
  if (!["none", "center", "camera"].includes(String(value.mode))) issues.push("link.mode is unsupported.");
  if (!["from-target", "bidirectional"].includes(String(value.direction))) issues.push("link.direction is unsupported.");
}

function validateTime(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("time must be an object.");
    return;
  }
  exactKeys(value, ["start", "end", "current", "windowSeconds", "playing", "loop"], "time", issues);
  const start = dateValue(value.start);
  const end = dateValue(value.end);
  const current = dateValue(value.current);
  if (start === undefined || end === undefined || current === undefined) issues.push("time start, end, and current must be ISO-8601 timestamps.");
  else if (start > end || current < start || current > end) issues.push("time requires start <= current <= end.");
  if (value.windowSeconds !== undefined && (!integerInRange(value.windowSeconds, 1, 31_536_000))) issues.push("time.windowSeconds must be an integer between 1 and 31536000.");
  if (typeof value.playing !== "boolean" || typeof value.loop !== "boolean") issues.push("time.playing and time.loop must be boolean.");
}

function safeRemoteUrl(value: unknown) {
  if (typeof value !== "string" || value.length > INTELLIGENCE_VIEW_LIMITS.maxStringLength) return false;
  try {
    const normalized = value.replace(/\{z\}/g, "0").replace(/\{x\}/g, "0").replace(/\{y\}/g, "0");
    const url = new URL(normalized);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    for (const key of url.searchParams.keys()) {
      if (/(?:token|secret|key|authorization|credential|signature)/i.test(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function validateNoSecrets(value: unknown, issues: string[]) {
  walk(value, [], (entry, path) => {
    const key = path[path.length - 1] ?? "";
    if (/(?:secret|access[_-]?token|api[_-]?key|authorization|credential|password)/i.test(key)) issues.push(`Forbidden credential-like field at ${path.join(".")}.`);
    if (typeof entry === "string" && /(?:[?&](?:access_token|token|api_key|key|signature)=|\bBearer\s+|mapbox:\/\/)/i.test(entry)) issues.push(`Forbidden credential-bearing value at ${path.join(".")}.`);
  });
}

function validateStringBudget(value: unknown, issues: string[]) {
  let total = 0;
  walk(value, [], (entry, path) => {
    if (typeof entry !== "string") return;
    total += entry.length;
    if (entry.length > INTELLIGENCE_VIEW_LIMITS.maxStringLength) issues.push(`${path.join(".")} exceeds maxStringLength ${INTELLIGENCE_VIEW_LIMITS.maxStringLength}.`);
  });
  if (total > INTELLIGENCE_VIEW_LIMITS.maxTotalStringLength) issues.push(`view exceeds maxTotalStringLength ${INTELLIGENCE_VIEW_LIMITS.maxTotalStringLength}.`);
}

function exactKeys(value: Record<string, unknown>, allowed: string[], label: string, issues: string[]) {
  Object.keys(value).forEach((key) => {
    if (!allowed.includes(key)) issues.push(`${label} contains unsupported property ${key}.`);
  });
}

function requireString(value: unknown, label: string, issues: string[], max: number = INTELLIGENCE_VIEW_LIMITS.maxStringLength) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    issues.push(`${label} must be a non-empty string no longer than ${max} characters.`);
    return undefined;
  }
  return value;
}

function walk(value: unknown, path: string[], visit: (entry: unknown, path: string[]) => void) {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((entry, index) => walk(entry, [...path, String(index)], visit));
  else if (isRecord(value)) Object.entries(value).forEach(([key, entry]) => walk(entry, [...path, key], visit));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "boolean" || finiteNumber(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberInRange(value: unknown, min: number, max: number): value is number {
  return finiteNumber(value) && value >= min && value <= max;
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return numberInRange(value, min, max) && Number.isInteger(value);
}

function dateValue(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? date : undefined;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringify(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}
