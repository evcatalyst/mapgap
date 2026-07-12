/**
 * Framework-neutral contract for composed analysis datasets.
 *
 * This is deliberately separate from mapgap-project/v1. A project captures
 * user intent and routed evidence; an analysis bundle carries bounded,
 * visualization-ready datasets and the lineage needed to explain them.
 */

export const ANALYSIS_BUNDLE_SCHEMA_VERSION = "mapgap-analysis-bundle/v1" as const;

export const MAPGAP_ANALYSIS_DATASET_IDS = {
  accessSurface: "mapgap-analysis-access-surface-v1",
  housingAreas: "mapgap-analysis-housing-areas-v1",
  housingCandidates: "mapgap-analysis-housing-candidates-v1",
  tigerTracts: "mapgap-analysis-tiger-tracts-v1",
  acsHousing: "mapgap-analysis-acs-housing-v1",
} as const;

export type MapGapAnalysisDatasetId =
  (typeof MAPGAP_ANALYSIS_DATASET_IDS)[keyof typeof MAPGAP_ANALYSIS_DATASET_IDS];

export type AnalysisJsonPrimitive = string | number | boolean | null;
export type AnalysisJsonValue = AnalysisJsonPrimitive | AnalysisJsonRecord | AnalysisJsonValue[];
export type AnalysisJsonRecord = { [key: string]: AnalysisJsonValue };
export type AnalysisPosition = [number, number];
export type AnalysisBoundingBoxV1 = [number, number, number, number];

export type AnalysisPointGeometryV1 = {
  type: "Point";
  coordinates: AnalysisPosition;
};

export type AnalysisPolygonGeometryV1 = {
  type: "Polygon";
  coordinates: AnalysisPosition[][];
};

export type AnalysisMultiPolygonGeometryV1 = {
  type: "MultiPolygon";
  coordinates: AnalysisPosition[][][];
};

export type AnalysisGeometryV1 =
  | AnalysisPointGeometryV1
  | AnalysisPolygonGeometryV1
  | AnalysisMultiPolygonGeometryV1;

export type AnalysisFeatureV1 = {
  type: "Feature";
  id?: string;
  geometry: AnalysisGeometryV1;
  properties: AnalysisJsonRecord;
};

export type AnalysisFeatureCollectionV1 = {
  type: "FeatureCollection";
  features: AnalysisFeatureV1[];
};

export type AnalysisFieldTypeV1 = "string" | "number" | "integer" | "boolean";

export type AnalysisMissingValuePolicyV1 =
  | {
      kind: "null";
      meaning: string;
    }
  | {
      kind: "sentinel";
      value: string | number;
      meaning: string;
    }
  | {
      kind: "not-applicable";
      meaning: string;
    };

export type AnalysisFieldV1 = {
  name: string;
  label: string;
  type: AnalysisFieldTypeV1;
  unit:
    | "none"
    | "geoid"
    | "category"
    | "minutes"
    | "score-0-100"
    | "count"
    | "percent"
    | "usd-current";
  nullable: boolean;
  missing: AnalysisMissingValuePolicyV1;
  description: string;
  sourceVariable?: string;
};

export type AnalysisRepresentationV1 =
  | {
      kind: "inline-geojson";
      mediaType: "application/geo+json";
      coordinateReferenceSystem: "EPSG:4326";
    }
  | {
      kind: "inline-records";
      mediaType: "application/json";
    }
  | {
      kind: "arrow-query";
      mediaType: "application/vnd.apache.arrow.stream";
      url: string;
      query: {
        protocol: "duckdb-sql" | "ogc-api-features" | "http-parameters";
        template: string;
        allowedParameters: string[];
      };
      coordinateReferenceSystem: "EPSG:4326";
    }
  | {
      kind: "mvt";
      mediaType: "application/vnd.mapbox-vector-tile";
      urlTemplate: string;
      sourceLayer: string;
      minZoom: number;
      maxZoom: number;
      coordinateReferenceSystem: "EPSG:3857";
    }
  | {
      kind: "pmtiles";
      mediaType: "application/vnd.pmtiles";
      url: string;
      sourceLayer: string;
      minZoom: number;
      maxZoom: number;
      coordinateReferenceSystem: "EPSG:3857";
    };

export type AnalysisDatasetBudgetV1 = {
  maxFeatures: number;
  maxRecords: number;
  maxCoordinates: number;
  maxEncodedBytes: number;
};

export type AnalysisLicenseV1 = {
  name: string;
  url: string;
  attribution: string;
  redistribution: "allowed" | "with-attribution" | "restricted" | "unknown";
};

export type AnalysisVintageV1 =
  | { kind: "as-of"; date: string }
  | { kind: "period"; startYear: number; endYear: number };

export type AnalysisSourceV1 = {
  id: string;
  publisher: string;
  title: string;
  datasetId?: string;
  url: string;
  retrievedAt: string;
  vintage: AnalysisVintageV1;
  license: AnalysisLicenseV1;
};

export type AnalysisTransformV1 = {
  id: string;
  description: string;
  inputSourceIds: string[];
  outputFields: string[];
  executedAt: string;
  software?: string;
};

export type AnalysisProvenanceV1 = {
  sources: AnalysisSourceV1[];
  transforms: AnalysisTransformV1[];
  caveat?: string;
};

export type AnalysisChecksumV1 = {
  algorithm: "sha256";
  value: string;
  scope: "fixture-payload" | "source-artifact";
  canonicalization: "RFC8785" | "publisher-bytes";
};

export type AnalysisSensitivityV1 = {
  classification: "public" | "internal" | "restricted";
  containsPersonalData: boolean;
  containsPrecisePersonLocations: boolean;
  aggregationLevel: string;
  retention: "public-data-no-contractual-limit" | "project-policy" | "license-defined";
  handlingNote: string;
};

export type AnalysisDatasetDescriptorV1 = {
  id: MapGapAnalysisDatasetId | string;
  label: string;
  description: string;
  role:
    | "access-surface"
    | "location-intelligence"
    | "source-geometry"
    | "source-table"
    | "candidate";
  primaryKey: string;
  geometryTypes: Array<AnalysisGeometryV1["type"]>;
  fields: AnalysisFieldV1[];
  unknownFields: "allow" | "reject";
  representation: AnalysisRepresentationV1;
  budget: AnalysisDatasetBudgetV1;
};

export type AnalysisDatasetGovernanceV1 = {
  sourceClass:
    | "public-open-data"
    | "mapgap-derived"
    | "partner-private"
    | "commercial-listing"
    | "commercial-parcel";
  permission: {
    status: "not-required" | "approved" | "blocked";
    reference?: string;
    approvedAt?: string;
  };
  authentication: {
    mode: "none" | "server-brokered";
    credentialStorage: "none" | "server-only";
    clientCredentialsProhibited: true;
  };
  retention:
    | { mode: "unlimited-public" }
    | { mode: "ttl"; days: number; deletionProcedure: string };
};

export type MapGapAnalysisDatasetV1 = {
  descriptor: AnalysisDatasetDescriptorV1;
  data: AnalysisFeatureCollectionV1 | AnalysisJsonRecord[] | null;
  provenance: AnalysisProvenanceV1;
  checksum: AnalysisChecksumV1;
  sensitivity: AnalysisSensitivityV1;
  governance: AnalysisDatasetGovernanceV1;
};

export type AnalysisJoinV1 = {
  id: string;
  label: string;
  left: { datasetId: string; field: string };
  right: { datasetId: string; field: string };
  outputDatasetId: string;
  method: "attribute-equality" | "spatial-intersects" | "nearest";
  cardinality: "one-to-one" | "one-to-many" | "many-to-one";
  unmatched: "retain-null" | "drop" | "reject";
  description: string;
};

export type AnalysisBundleBudgetV1 = AnalysisDatasetBudgetV1 & {
  maxDatasets: number;
};

export type MapGapAnalysisBundleV1 = {
  schemaVersion: typeof ANALYSIS_BUNDLE_SCHEMA_VERSION;
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  geography: {
    label: string;
    coordinateReferenceSystem: "EPSG:4326";
    boundingBox: AnalysisBoundingBoxV1;
  };
  datasets: MapGapAnalysisDatasetV1[];
  joins: AnalysisJoinV1[];
  budget: AnalysisBundleBudgetV1;
};

export type AnalysisBundleUsageV1 = {
  datasets: number;
  features: number;
  records: number;
  coordinates: number;
  encodedBytes: number;
  byDataset: Record<
    string,
    { features: number; records: number; coordinates: number; encodedBytes: number }
  >;
};

export type AnalysisBundleValidationResultV1 =
  | { ok: true; bundle: MapGapAnalysisBundleV1; usage: AnalysisBundleUsageV1 }
  | { ok: false; issues: string[] };

/** Validates untrusted persisted data and fails closed on future versions. */
export function parseAnalysisBundleV1(value: unknown): AnalysisBundleValidationResultV1 {
  if (!isRecord(value)) return { ok: false, issues: ["Analysis bundle must be an object."] };

  const issues: string[] = [];
  if (value.schemaVersion !== ANALYSIS_BUNDLE_SCHEMA_VERSION) {
    issues.push(`Unsupported analysis bundle schema version: ${stringify(value.schemaVersion)}.`);
  }
  if (!nonEmptyString(value.id)) issues.push("Analysis bundle id is required.");
  if (!nonEmptyString(value.label)) issues.push("Analysis bundle label is required.");
  if (!nonEmptyString(value.createdAt) || !nonEmptyString(value.updatedAt)) {
    issues.push("Analysis bundle timestamps are required.");
  }

  const boundingBox = validateGeography(value.geography, issues);
  const bundleBudget = validateBudget(value.budget, "budget", issues, true);

  const datasets = new Map<string, MapGapAnalysisDatasetV1>();
  if (!Array.isArray(value.datasets)) {
    issues.push("datasets must be an array.");
  } else {
    value.datasets.forEach((dataset, index) => {
      const id = validateDataset(dataset, `datasets[${index}]`, boundingBox, issues);
      if (!id || !isRecord(dataset)) return;
      if (datasets.has(id)) issues.push(`datasets contains duplicate id ${id}.`);
      datasets.set(id, dataset as unknown as MapGapAnalysisDatasetV1);
    });
  }

  validateJoins(value.joins, datasets, issues);
  validateNoSecrets(value, issues);

  if (issues.length > 0) return { ok: false, issues };

  const bundle = cloneJson(value) as MapGapAnalysisBundleV1;
  const usage = analysisBundleUsage(bundle);
  if (bundleBudget) validateUsageWithinBudget(usage, bundleBudget, "bundle", issues);
  for (const dataset of bundle.datasets) {
    const datasetUsage = usage.byDataset[dataset.descriptor.id];
    validateUsageWithinBudget(datasetUsage, dataset.descriptor.budget, `dataset ${dataset.descriptor.id}`, issues);
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, bundle, usage };
}

export function assertAnalysisBundleV1(value: unknown): MapGapAnalysisBundleV1 {
  const result = parseAnalysisBundleV1(value);
  if (!result.ok) throw new Error(`Invalid MapGap analysis bundle: ${result.issues.join(" ")}`);
  return result.bundle;
}

export function cloneAnalysisBundleV1(bundle: MapGapAnalysisBundleV1): MapGapAnalysisBundleV1 {
  return assertAnalysisBundleV1(bundle);
}

export function analysisBundleUsage(bundle: MapGapAnalysisBundleV1): AnalysisBundleUsageV1 {
  const byDataset: AnalysisBundleUsageV1["byDataset"] = {};
  let features = 0;
  let records = 0;
  let coordinates = 0;

  for (const dataset of bundle.datasets) {
    const isGeoJson = dataset.descriptor.representation.kind === "inline-geojson";
    const isRecords = dataset.descriptor.representation.kind === "inline-records";
    const collection = isGeoJson ? (dataset.data as AnalysisFeatureCollectionV1) : undefined;
    const datasetFeatures = collection?.features.length ?? 0;
    const datasetRecords = isRecords ? (dataset.data as AnalysisJsonRecord[]).length : 0;
    const datasetCoordinates = collection
      ? collection.features.reduce((count, feature) => count + countGeometryCoordinates(feature.geometry), 0)
      : 0;
    const encodedBytes = utf8ByteLength(JSON.stringify(dataset));
    byDataset[dataset.descriptor.id] = {
      features: datasetFeatures,
      records: datasetRecords,
      coordinates: datasetCoordinates,
      encodedBytes,
    };
    features += datasetFeatures;
    records += datasetRecords;
    coordinates += datasetCoordinates;
  }

  return {
    datasets: bundle.datasets.length,
    features,
    records,
    coordinates,
    encodedBytes: utf8ByteLength(JSON.stringify(bundle)),
    byDataset,
  };
}

function validateGeography(value: unknown, issues: string[]) {
  if (!isRecord(value) || !nonEmptyString(value.label) || value.coordinateReferenceSystem !== "EPSG:4326") {
    issues.push("geography requires a label and EPSG:4326 coordinate reference system.");
    return undefined;
  }
  if (!isBoundingBox(value.boundingBox)) {
    issues.push("geography.boundingBox must be [west, south, east, north] in valid longitude/latitude order.");
    return undefined;
  }
  return value.boundingBox;
}

function validateDataset(
  value: unknown,
  label: string,
  boundingBox: AnalysisBoundingBoxV1 | undefined,
  issues: string[],
) {
  if (!isRecord(value) || !isRecord(value.descriptor)) {
    issues.push(`${label} requires a descriptor.`);
    return undefined;
  }
  const descriptor = value.descriptor;
  if (!nonEmptyString(descriptor.id)) issues.push(`${label}.descriptor.id is required.`);
  if (!nonEmptyString(descriptor.label) || !nonEmptyString(descriptor.description)) {
    issues.push(`${label}.descriptor label and description are required.`);
  }
  if (!["access-surface", "location-intelligence", "source-geometry", "source-table", "candidate"].includes(String(descriptor.role))) {
    issues.push(`${label}.descriptor.role is unsupported.`);
  }
  if (!nonEmptyString(descriptor.primaryKey)) issues.push(`${label}.descriptor.primaryKey is required.`);
  if (
    !Array.isArray(descriptor.geometryTypes) ||
    descriptor.geometryTypes.some((geometryType) => !["Point", "Polygon", "MultiPolygon"].includes(String(geometryType)))
  ) {
    issues.push(`${label}.descriptor.geometryTypes must contain supported geometry types.`);
  }
  if (descriptor.unknownFields !== "allow" && descriptor.unknownFields !== "reject") {
    issues.push(`${label}.descriptor.unknownFields must be allow or reject.`);
  }
  const fields = validateFields(descriptor.fields, `${label}.descriptor.fields`, issues);
  if (nonEmptyString(descriptor.primaryKey) && !fields.has(descriptor.primaryKey)) {
    issues.push(`${label}.descriptor.primaryKey must name a declared field.`);
  }
  validateBudget(descriptor.budget, `${label}.descriptor.budget`, issues, false);
  validateProvenance(value.provenance, `${label}.provenance`, fields, issues);
  validateChecksum(value.checksum, `${label}.checksum`, issues);
  validateSensitivity(value.sensitivity, `${label}.sensitivity`, issues);
  validateGovernance(value.governance, value.provenance, value.sensitivity, `${label}.governance`, issues);

  if (!isRecord(descriptor.representation)) {
    issues.push(`${label}.descriptor.representation is required.`);
  } else if (descriptor.representation.kind === "inline-geojson") {
    if (
      descriptor.representation.mediaType !== "application/geo+json" ||
      descriptor.representation.coordinateReferenceSystem !== "EPSG:4326"
    ) {
      issues.push(`${label}.descriptor.representation must declare GeoJSON in EPSG:4326.`);
    }
    validateFeatureCollection(value.data, descriptor, fields, boundingBox, `${label}.data`, issues);
  } else if (descriptor.representation.kind === "inline-records") {
    if (descriptor.representation.mediaType !== "application/json") {
      issues.push(`${label}.descriptor.representation records must use application/json.`);
    }
    if (Array.isArray(descriptor.geometryTypes) && descriptor.geometryTypes.length !== 0) {
      issues.push(`${label}.descriptor.geometryTypes must be empty for records.`);
    }
    validateRecords(value.data, descriptor, fields, `${label}.data`, issues);
  } else if (descriptor.representation.kind === "arrow-query") {
    validateArrowQueryRepresentation(descriptor.representation, `${label}.descriptor.representation`, issues);
    if (value.data !== null) issues.push(`${label}.data must be null for arrow-query representation.`);
  } else if (descriptor.representation.kind === "mvt") {
    validateTileRepresentation(descriptor.representation, `${label}.descriptor.representation`, true, issues);
    if (value.data !== null) issues.push(`${label}.data must be null for mvt representation.`);
  } else if (descriptor.representation.kind === "pmtiles") {
    validateTileRepresentation(descriptor.representation, `${label}.descriptor.representation`, false, issues);
    if (value.data !== null) issues.push(`${label}.data must be null for pmtiles representation.`);
  } else {
    issues.push(`${label}.descriptor.representation kind is unsupported.`);
  }

  return nonEmptyString(descriptor.id) ? descriptor.id : undefined;
}

function validateFields(value: unknown, label: string, issues: string[]) {
  const fields = new Map<string, AnalysisFieldV1>();
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${label} must contain at least one field.`);
    return fields;
  }
  value.forEach((field, index) => {
    const fieldLabel = `${label}[${index}]`;
    if (!isRecord(field) || !nonEmptyString(field.name)) {
      issues.push(`${fieldLabel}.name is required.`);
      return;
    }
    if (fields.has(field.name)) issues.push(`${label} contains duplicate field ${field.name}.`);
    if (!nonEmptyString(field.label) || !nonEmptyString(field.description)) {
      issues.push(`${fieldLabel} label and description are required.`);
    }
    if (!isFieldType(field.type)) issues.push(`${fieldLabel}.type is unsupported.`);
    if (!isFieldUnit(field.unit)) issues.push(`${fieldLabel}.unit is unsupported.`);
    if (typeof field.nullable !== "boolean") issues.push(`${fieldLabel}.nullable must be boolean.`);
    if (!isRecord(field.missing) || !nonEmptyString(field.missing.meaning)) {
      issues.push(`${fieldLabel}.missing requires an explicit policy and meaning.`);
    } else if (!["null", "sentinel", "not-applicable"].includes(String(field.missing.kind))) {
      issues.push(`${fieldLabel}.missing kind is unsupported.`);
    } else if (field.missing.kind === "sentinel" && field.missing.value === undefined) {
      issues.push(`${fieldLabel}.missing sentinel requires a value.`);
    } else if (!field.nullable && field.missing.kind === "null") {
      issues.push(`${fieldLabel} cannot use a null missing policy when nullable is false.`);
    }
    fields.set(field.name, field as unknown as AnalysisFieldV1);
  });
  return fields;
}

function validateFeatureCollection(
  value: unknown,
  descriptor: AnalysisJsonRecord,
  fields: Map<string, AnalysisFieldV1>,
  boundingBox: AnalysisBoundingBoxV1 | undefined,
  label: string,
  issues: string[],
) {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    issues.push(`${label} must be a GeoJSON FeatureCollection.`);
    return;
  }
  const primaryValues = new Set<string>();
  value.features.forEach((feature, index) => {
    const featureLabel = `${label}.features[${index}]`;
    if (!isRecord(feature) || feature.type !== "Feature" || !isRecord(feature.properties)) {
      issues.push(`${featureLabel} must be a GeoJSON Feature with properties.`);
      return;
    }
    validateGeometry(feature.geometry, descriptor.geometryTypes, boundingBox, `${featureLabel}.geometry`, issues);
    validateRow(feature.properties, descriptor, fields, featureLabel, primaryValues, issues);
  });
}

function validateRecords(
  value: unknown,
  descriptor: AnalysisJsonRecord,
  fields: Map<string, AnalysisFieldV1>,
  label: string,
  issues: string[],
) {
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array of records.`);
    return;
  }
  const primaryValues = new Set<string>();
  value.forEach((record, index) => {
    if (!isRecord(record)) {
      issues.push(`${label}[${index}] must be an object.`);
      return;
    }
    validateRow(record, descriptor, fields, `${label}[${index}]`, primaryValues, issues);
  });
}

function validateRow(
  row: AnalysisJsonRecord,
  descriptor: AnalysisJsonRecord,
  fields: Map<string, AnalysisFieldV1>,
  label: string,
  primaryValues: Set<string>,
  issues: string[],
) {
  if (descriptor.unknownFields === "reject") {
    Object.keys(row).forEach((key) => {
      if (!fields.has(key)) issues.push(`${label} contains undeclared field ${key}.`);
    });
  }
  fields.forEach((field, name) => {
    const entry = row[name];
    if (entry === undefined || entry === null) {
      if (!field.nullable) issues.push(`${label}.${name} is required and cannot be null.`);
      return;
    }
    if (!matchesFieldType(entry, field.type)) issues.push(`${label}.${name} does not match ${field.type}.`);
  });
  const primaryKey = descriptor.primaryKey;
  const primaryValue = row[String(primaryKey)];
  if (typeof primaryValue !== "string" && typeof primaryValue !== "number") {
    issues.push(`${label}.${String(primaryKey)} must identify the record.`);
  } else {
    const normalized = String(primaryValue);
    if (primaryValues.has(normalized)) issues.push(`${label} duplicates primary key ${normalized}.`);
    primaryValues.add(normalized);
  }
}

function validateGeometry(
  value: unknown,
  geometryTypes: unknown,
  boundingBox: AnalysisBoundingBoxV1 | undefined,
  label: string,
  issues: string[],
) {
  if (!isRecord(value) || !["Point", "Polygon", "MultiPolygon"].includes(String(value.type))) {
    issues.push(`${label} has an unsupported geometry.`);
    return;
  }
  if (!Array.isArray(geometryTypes) || !geometryTypes.includes(value.type)) {
    issues.push(`${label} type ${String(value.type)} is not declared by the dataset.`);
  }
  const polygons = value.type === "Point" ? undefined : value.type === "Polygon" ? [value.coordinates] : value.coordinates;
  if (value.type === "Point") {
    validatePosition(value.coordinates, boundingBox, label, issues);
    return;
  }
  if (!Array.isArray(polygons) || polygons.length === 0) {
    issues.push(`${label} must contain polygon coordinates.`);
    return;
  }
  polygons.forEach((polygon, polygonIndex) => {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      issues.push(`${label}[${polygonIndex}] must contain a ring.`);
      return;
    }
    polygon.forEach((ring, ringIndex) => {
      const ringLabel = `${label}[${polygonIndex}][${ringIndex}]`;
      if (!Array.isArray(ring) || ring.length < 4) {
        issues.push(`${ringLabel} must contain at least four positions.`);
        return;
      }
      ring.forEach((position) => validatePosition(position, boundingBox, ringLabel, issues));
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (!positionsEqual(first, last)) issues.push(`${ringLabel} must be closed.`);
    });
  });
}

function validatePosition(
  value: unknown,
  boundingBox: AnalysisBoundingBoxV1 | undefined,
  label: string,
  issues: string[],
) {
  if (!isPosition(value)) {
    issues.push(`${label} contains an invalid longitude/latitude position.`);
    return;
  }
  if (boundingBox && !positionWithinBounds(value, boundingBox)) {
    issues.push(`${label} contains a position outside geography.boundingBox.`);
  }
}

function validateProvenance(
  value: unknown,
  label: string,
  fields: Map<string, AnalysisFieldV1>,
  issues: string[],
) {
  if (!isRecord(value) || !Array.isArray(value.sources) || value.sources.length === 0) {
    issues.push(`${label}.sources must contain at least one source.`);
    return;
  }
  const sourceIds = new Set<string>();
  value.sources.forEach((source, index) => {
    const sourceLabel = `${label}.sources[${index}]`;
    if (!isRecord(source) || !nonEmptyString(source.id)) {
      issues.push(`${sourceLabel}.id is required.`);
      return;
    }
    if (sourceIds.has(source.id)) issues.push(`${label}.sources contains duplicate id ${source.id}.`);
    sourceIds.add(source.id);
    if (!nonEmptyString(source.publisher) || !nonEmptyString(source.title) || !validUrl(source.url)) {
      issues.push(`${sourceLabel} requires publisher, title, and an http(s) URL.`);
    }
    if (!nonEmptyString(source.retrievedAt) || !isRecord(source.vintage)) {
      issues.push(`${sourceLabel} requires retrievedAt and vintage.`);
    }
    if (
      !isRecord(source.license) ||
      !nonEmptyString(source.license.name) ||
      !validUrl(source.license.url) ||
      !nonEmptyString(source.license.attribution) ||
      !["allowed", "with-attribution", "restricted", "unknown"].includes(String(source.license.redistribution))
    ) {
      issues.push(`${sourceLabel}.license requires name, URL, attribution, and redistribution terms.`);
    }
    if (
      isRecord(source.vintage) &&
      source.vintage.kind !== "as-of" &&
      source.vintage.kind !== "period"
    ) issues.push(`${sourceLabel}.vintage kind is unsupported.`);
  });
  if (!Array.isArray(value.transforms)) {
    issues.push(`${label}.transforms must be an array.`);
    return;
  }
  value.transforms.forEach((transform, index) => {
    const transformLabel = `${label}.transforms[${index}]`;
    if (!isRecord(transform) || !nonEmptyString(transform.id) || !nonEmptyString(transform.description)) {
      issues.push(`${transformLabel} requires id and description.`);
      return;
    }
    if (!Array.isArray(transform.inputSourceIds) || transform.inputSourceIds.some((id) => !sourceIds.has(String(id)))) {
      issues.push(`${transformLabel}.inputSourceIds must reference this dataset's sources.`);
    }
    if (!Array.isArray(transform.outputFields) || transform.outputFields.some((field) => !fields.has(String(field)))) {
      issues.push(`${transformLabel}.outputFields must reference declared fields.`);
    }
    if (!nonEmptyString(transform.executedAt)) issues.push(`${transformLabel}.executedAt is required.`);
  });
}

function validateChecksum(value: unknown, label: string, issues: string[]) {
  if (
    !isRecord(value) ||
    value.algorithm !== "sha256" ||
    typeof value.value !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.value) ||
    !["fixture-payload", "source-artifact"].includes(String(value.scope)) ||
    !["RFC8785", "publisher-bytes"].includes(String(value.canonicalization))
  ) {
    issues.push(`${label} must be a scoped lowercase sha256 checksum with canonicalization.`);
  }
}

function validateSensitivity(value: unknown, label: string, issues: string[]) {
  if (
    !isRecord(value) ||
    !["public", "internal", "restricted"].includes(String(value.classification)) ||
    typeof value.containsPersonalData !== "boolean" ||
    typeof value.containsPrecisePersonLocations !== "boolean" ||
    !nonEmptyString(value.aggregationLevel) ||
    !nonEmptyString(value.handlingNote)
  ) {
    issues.push(`${label} requires classification, privacy flags, aggregation, and handling guidance.`);
  }
}

function validateGovernance(
  value: unknown,
  provenance: unknown,
  sensitivity: unknown,
  label: string,
  issues: string[],
) {
  if (
    !isRecord(value) ||
    !isRecord(value.permission) ||
    !isRecord(value.authentication) ||
    !isRecord(value.retention) ||
    value.authentication.clientCredentialsProhibited !== true
  ) {
    issues.push(`${label} requires permission, authentication, retention, and an explicit client-credential prohibition.`);
    return;
  }
  if (![
    "public-open-data",
    "mapgap-derived",
    "partner-private",
    "commercial-listing",
    "commercial-parcel",
  ].includes(String(value.sourceClass))) issues.push(`${label}.sourceClass is unsupported.`);
  if (!["not-required", "approved", "blocked"].includes(String(value.permission.status))) {
    issues.push(`${label}.permission.status is unsupported.`);
  }
  if (!["none", "server-brokered"].includes(String(value.authentication.mode))) {
    issues.push(`${label}.authentication.mode is unsupported.`);
  }
  if (!["none", "server-only"].includes(String(value.authentication.credentialStorage))) {
    issues.push(`${label}.authentication.credentialStorage is unsupported.`);
  }
  if (!["unlimited-public", "ttl"].includes(String(value.retention.mode))) {
    issues.push(`${label}.retention.mode is unsupported.`);
  }
  const commercial = value.sourceClass === "commercial-listing" || value.sourceClass === "commercial-parcel";
  if (!commercial) return;

  if (
    value.permission.status !== "approved" ||
    !nonEmptyString(value.permission.reference) ||
    !nonEmptyString(value.permission.approvedAt)
  ) {
    issues.push(`${label} blocks commercial data until permission is approved with a reference and timestamp.`);
  }
  if (
    value.authentication.mode !== "server-brokered" ||
    value.authentication.credentialStorage !== "server-only"
  ) {
    issues.push(`${label} requires server-brokered, server-only authentication for commercial data.`);
  }
  if (
    value.retention.mode !== "ttl" ||
    !positiveInteger(value.retention.days) ||
    !nonEmptyString(value.retention.deletionProcedure)
  ) {
    issues.push(`${label} requires a positive retention TTL and deletion procedure for commercial data.`);
  }
  if (!isRecord(sensitivity) || sensitivity.classification === "public") {
    issues.push(`${label} requires internal or restricted sensitivity for commercial data.`);
  }
  if (!isRecord(provenance) || !Array.isArray(provenance.sources) || provenance.sources.length === 0) {
    issues.push(`${label} requires source provenance for commercial data.`);
  } else if (
    provenance.sources.some(
      (source) => !isRecord(source) || !isRecord(source.license) || source.license.redistribution === "unknown",
    )
  ) {
    issues.push(`${label} requires known license/redistribution terms for every commercial source.`);
  }
}

function validateArrowQueryRepresentation(value: AnalysisJsonRecord, label: string, issues: string[]) {
  if (
    value.mediaType !== "application/vnd.apache.arrow.stream" ||
    value.coordinateReferenceSystem !== "EPSG:4326" ||
    !validUrl(value.url) ||
    !isRecord(value.query) ||
    !["duckdb-sql", "ogc-api-features", "http-parameters"].includes(String(value.query.protocol)) ||
    !nonEmptyString(value.query.template) ||
    !Array.isArray(value.query.allowedParameters) ||
    value.query.allowedParameters.some(
      (parameter) => !nonEmptyString(parameter) || /(secret|access[_-]?token|api[_-]?key|authorization)/i.test(parameter),
    )
  ) {
    issues.push(`${label} must declare a valid Arrow endpoint, query template, allowed parameters, and EPSG:4326.`);
  }
}

function validateTileRepresentation(
  value: AnalysisJsonRecord,
  label: string,
  templated: boolean,
  issues: string[],
) {
  const url = templated ? value.urlTemplate : value.url;
  const expectedMediaType = templated ? "application/vnd.mapbox-vector-tile" : "application/vnd.pmtiles";
  if (
    value.mediaType !== expectedMediaType ||
    !validUrl(url) ||
    !nonEmptyString(value.sourceLayer) ||
    !nonNegativeInteger(value.minZoom) ||
    !nonNegativeInteger(value.maxZoom) ||
    Number(value.minZoom) > Number(value.maxZoom) ||
    value.coordinateReferenceSystem !== "EPSG:3857"
  ) {
    issues.push(`${label} must declare a valid endpoint, source layer, zoom range, and EPSG:3857.`);
  }
  if (templated && typeof url === "string" && (!url.includes("{z}") || !url.includes("{x}") || !url.includes("{y}"))) {
    issues.push(`${label}.urlTemplate must include {z}, {x}, and {y}.`);
  }
}

function validateJoins(value: unknown, datasets: Map<string, MapGapAnalysisDatasetV1>, issues: string[]) {
  if (!Array.isArray(value)) {
    issues.push("joins must be an array.");
    return;
  }
  const ids = new Set<string>();
  value.forEach((join, index) => {
    const label = `joins[${index}]`;
    if (!isRecord(join) || !nonEmptyString(join.id) || !isRecord(join.left) || !isRecord(join.right)) {
      issues.push(`${label} requires id, left, and right references.`);
      return;
    }
    if (ids.has(join.id)) issues.push(`joins contains duplicate id ${join.id}.`);
    ids.add(join.id);
    if (!nonEmptyString(join.label) || !nonEmptyString(join.description)) {
      issues.push(`${label} requires label and description.`);
    }
    if (!["attribute-equality", "spatial-intersects", "nearest"].includes(String(join.method))) {
      issues.push(`${label}.method is unsupported.`);
    }
    if (!["one-to-one", "one-to-many", "many-to-one"].includes(String(join.cardinality))) {
      issues.push(`${label}.cardinality is unsupported.`);
    }
    if (!["retain-null", "drop", "reject"].includes(String(join.unmatched))) {
      issues.push(`${label}.unmatched is unsupported.`);
    }
    for (const sideName of ["left", "right"] as const) {
      const side = join[sideName] as AnalysisJsonRecord;
      const dataset = datasets.get(String(side.datasetId));
      if (!dataset) {
        issues.push(`${label}.${sideName}.datasetId must reference a bundle dataset.`);
      } else if (!dataset.descriptor.fields.some((field) => field.name === side.field)) {
        issues.push(`${label}.${sideName}.field must reference a declared field.`);
      }
    }
    if (!datasets.has(String(join.outputDatasetId))) {
      issues.push(`${label}.outputDatasetId must reference a bundle dataset.`);
    }
  });
}

function validateBudget(
  value: unknown,
  label: string,
  issues: string[],
  bundle: boolean,
): AnalysisBundleBudgetV1 | AnalysisDatasetBudgetV1 | undefined {
  if (!isRecord(value)) {
    issues.push(`${label} is required.`);
    return undefined;
  }
  const keys = ["maxFeatures", "maxRecords", "maxCoordinates", "maxEncodedBytes"];
  if (bundle) keys.push("maxDatasets");
  keys.forEach((key) => {
    if (!nonNegativeInteger(value[key])) issues.push(`${label}.${key} must be a non-negative integer.`);
  });
  return value as unknown as AnalysisBundleBudgetV1;
}

function validateUsageWithinBudget(
  usage: { features: number; records: number; coordinates: number; encodedBytes: number; datasets?: number },
  budget: AnalysisDatasetBudgetV1 | AnalysisBundleBudgetV1,
  label: string,
  issues: string[],
) {
  if (usage.features > budget.maxFeatures) issues.push(`${label} exceeds maxFeatures budget.`);
  if (usage.records > budget.maxRecords) issues.push(`${label} exceeds maxRecords budget.`);
  if (usage.coordinates > budget.maxCoordinates) issues.push(`${label} exceeds maxCoordinates budget.`);
  if (usage.encodedBytes > budget.maxEncodedBytes) issues.push(`${label} exceeds maxEncodedBytes budget.`);
  if ("maxDatasets" in budget && (usage.datasets ?? 0) > budget.maxDatasets) {
    issues.push(`${label} exceeds maxDatasets budget.`);
  }
}

function validateNoSecrets(value: unknown, issues: string[]) {
  walkJson(value, [], (entry, path) => {
    const key = path[path.length - 1] ?? "";
    if (/(secret|access[_-]?token|api[_-]?key|authorization)/i.test(key)) {
      issues.push(`Forbidden credential-like field at ${path.join(".")}.`);
    }
    if (typeof entry === "string" && /(?:[?&](?:access_token|token|api_key)=|mapbox:\/\/)/i.test(entry)) {
      issues.push(`Forbidden token-bearing value at ${path.join(".")}.`);
    }
  });
}

function walkJson(value: unknown, path: string[], visit: (entry: unknown, path: string[]) => void) {
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkJson(entry, [...path, String(index)], visit));
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, entry]) => walkJson(entry, [...path, key], visit));
  }
}

function countGeometryCoordinates(geometry: AnalysisGeometryV1) {
  if (geometry.type === "Point") return 1;
  if (geometry.type === "Polygon") return geometry.coordinates.reduce((count, ring) => count + ring.length, 0);
  return geometry.coordinates.reduce(
    (count, polygon) => count + polygon.reduce((ringCount, ring) => ringCount + ring.length, 0),
    0,
  );
}

function matchesFieldType(value: AnalysisJsonValue, type: AnalysisFieldTypeV1) {
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeof value === "number" && Number.isFinite(value);
}

function isFieldType(value: unknown): value is AnalysisFieldTypeV1 {
  return ["string", "number", "integer", "boolean"].includes(String(value));
}

function isFieldUnit(value: unknown): value is AnalysisFieldV1["unit"] {
  return [
    "none",
    "geoid",
    "category",
    "minutes",
    "score-0-100",
    "count",
    "percent",
    "usd-current",
  ].includes(String(value));
}

function isBoundingBox(value: unknown): value is AnalysisBoundingBoxV1 {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(finiteNumber) &&
    value[0] >= -180 &&
    value[2] <= 180 &&
    value[1] >= -90 &&
    value[3] <= 90 &&
    value[0] < value[2] &&
    value[1] < value[3]
  );
}

function isPosition(value: unknown): value is AnalysisPosition {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    finiteNumber(value[0]) &&
    finiteNumber(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

function positionWithinBounds(position: AnalysisPosition, bounds: AnalysisBoundingBoxV1) {
  return position[0] >= bounds[0] && position[0] <= bounds[2] && position[1] >= bounds[1] && position[1] <= bounds[3];
}

function positionsEqual(left: unknown, right: unknown) {
  return isPosition(left) && isPosition(right) && left[0] === right[0] && left[1] === right[1];
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function validUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is AnalysisJsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringify(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}
