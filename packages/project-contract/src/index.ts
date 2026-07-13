/**
 * MapGap's portable project contract.  This package deliberately has no UI,
 * rendering, state-management, routing-provider, or third-party dependency.
 * It is the only object V2 and V3 exchange as portable project state. The
 * separately versioned analysis bundle exported below carries bounded,
 * derived visualization data and cannot alter project semantics.
 */

export * from "./analysis";
export * from "./analysis-fixtures";
export * from "./intelligence";
export * from "./intelligence-fixtures";

export const PROJECT_SCHEMA_VERSION = "mapgap-project/v1" as const;
export const V3_VIEW_ATTACHMENT_VERSION = "mapgap-v3-view/v1" as const;

export const MAPGAP_DATASET_IDS = {
  points: "mapgap-points-v1",
  isochrones: "mapgap-isochrones-v1",
  pois: "mapgap-pois-v1",
  candidates: "mapgap-candidates-v1",
  assets: "mapgap-assets-v1",
  underserved: "mapgap-underserved-v1",
} as const;

export type MapGapDatasetId = (typeof MAPGAP_DATASET_IDS)[keyof typeof MAPGAP_DATASET_IDS];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
export type JsonRecord = { [key: string]: JsonValue };

/** GeoJSON order: longitude, latitude. */
export type Position = [number, number];

export type PointGeometryV1 = {
  type: "Point";
  coordinates: Position;
};

export type PolygonGeometryV1 = {
  type: "Polygon";
  coordinates: Position[][];
};

export type MultiPolygonGeometryV1 = {
  type: "MultiPolygon";
  coordinates: Position[][][];
};

export type AreaGeometryV1 = PolygonGeometryV1 | MultiPolygonGeometryV1;

export type ProvenanceV1 = {
  sourceType: "user" | "import" | "routing-provider" | "open-data" | "system";
  label: string;
  datasetId?: string;
  sourceUrl?: string;
  updatedAt?: string;
  retrievedAt?: string;
  confidence?: "high" | "medium" | "low" | "unverified";
  note?: string;
};

export type ProjectScenarioV1 = {
  id: string;
  label?: string;
};

export type RoutingSettingsV1 = {
  provider: string;
  transportMode: string;
  mobilityMode: string;
  timeMinutes: number;
  generatedAt?: string;
};

export type ProfileAnchorV1 = {
  id: string;
  name: string;
  category: string;
  priority: "required" | "preferred" | "optional";
  geometry: PointGeometryV1;
  address?: string;
};

/** Constraint payloads retain MapGap semantics without inheriting a V2 union type. */
export type DecisionConstraintV1 = JsonRecord & {
  type: string;
};

export type DecisionProfileV1 = {
  id: string;
  name: string;
  scenarioId: string;
  regionLabel: string;
  anchors: ProfileAnchorV1[];
  constraints: DecisionConstraintV1[];
  weights: Record<string, number>;
};

export type ProjectPointV1 = {
  id: string;
  name: string;
  geometry: PointGeometryV1;
  address?: string;
  color?: string;
  createdAt?: string;
  provenance: ProvenanceV1;
};

export type PoiV1 = {
  id: string;
  name: string;
  geometry: PointGeometryV1;
  category: string;
  source: string;
  sourceId: string;
  address?: string;
  rating?: number;
  userRatingCount?: number;
  tags?: string[];
  provenance: ProvenanceV1;
};

export type PoiLayerV1 = {
  id: string;
  label: string;
  category: string;
  query: string;
  source: string;
  visible: boolean;
  createdAt?: string;
  truncated?: boolean;
  message?: string;
  points: PoiV1[];
};

export type RoutedAccessPolygonV1 = {
  id: string;
  pointId: string;
  pointName: string;
  color?: string;
  geometry: AreaGeometryV1;
  timeMinutes: number;
  bucketMinutes: number;
  adjustedMinutes: number;
  effortScore: number;
  mobilityMode: string;
  transportMode: string;
  routingProvider: string;
  isochroneMode: string;
  generatedAt?: string;
  provenance: ProvenanceV1;
};

export type ScoreComponentV1 = {
  key: string;
  label: string;
  value: number;
  explanation: string;
};

export type FailedConstraintV1 = {
  constraintType: string;
  label: string;
  explanation: string;
};

export type ScenarioAssumptionV1 = {
  id: string;
  label: string;
  value: string;
  source: string;
};

export type CandidateScoreV1 = {
  total: number;
  band: string;
  components: ScoreComponentV1[];
  failedConstraints: FailedConstraintV1[];
  assumptions: ScenarioAssumptionV1[];
};

export type CandidateV1 = {
  id: string;
  label: string;
  source: "grid" | "user" | "listing" | "import";
  geometry: PointGeometryV1;
  rank?: number;
  score?: CandidateScoreV1;
  provenance: ProvenanceV1;
};

export type CivicAssetV1 = {
  id: string;
  pointId?: string;
  name: string;
  assetType: string;
  geometry: PointGeometryV1;
  capacity?: number;
  /** Normalized 0–1 rate. The raw V2 field is preserved separately. */
  utilizationRate?: number;
  sourceUtilization?: string;
  hoursOpen?: string;
  staffing?: string;
  annualCost?: number;
  fundingSource?: string;
  provenance: ProvenanceV1;
};

export type UnderservedAreaV1 = {
  id: string;
  geometry: AreaGeometryV1;
  underservedScore: number;
  reachableCapacity: number;
  evidence: string[];
  provenance: ProvenanceV1;
};

/**
 * A presentation attachment is optional and cannot alter core MapGap project
 * data. The legacy `config` field remains JSON for backward compatibility with
 * research spikes. New Intelligence presentation state belongs in the validated
 * `mapgap-intelligence-view/v1` contract, referenced independently of project
 * truth; dataset ids keep this attachment safely addressable and portable.
 */
export type V3ViewAttachmentV1 = {
  version: typeof V3_VIEW_ATTACHMENT_VERSION;
  datasetIds: MapGapDatasetId[];
  config?: JsonRecord;
  updatedAt?: string;
};

export type MapGapProjectV1 = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  scenario: ProjectScenarioV1;
  routing: RoutingSettingsV1;
  profile?: DecisionProfileV1;
  points: ProjectPointV1[];
  poiLayers: PoiLayerV1[];
  isochrones: RoutedAccessPolygonV1[];
  candidates: CandidateV1[];
  civic: {
    assets: CivicAssetV1[];
    underservedAreas: UnderservedAreaV1[];
  };
  provenance: ProvenanceV1[];
  views?: {
    v3?: V3ViewAttachmentV1;
  };
};

export type ProjectValidationResult =
  | { ok: true; project: MapGapProjectV1 }
  | { ok: false; issues: string[] };

export function createEmptyProjectV1(input: {
  id: string;
  scenario: ProjectScenarioV1;
  routing: RoutingSettingsV1;
  now?: string;
}): MapGapProjectV1 {
  const now = input.now ?? new Date().toISOString();

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: input.id,
    createdAt: now,
    updatedAt: now,
    scenario: input.scenario,
    routing: input.routing,
    points: [],
    poiLayers: [],
    isochrones: [],
    candidates: [],
    civic: { assets: [], underservedAreas: [] },
    provenance: [],
  };
}

/**
 * Validates a persisted/untrusted object and returns a defensive copy on
 * success. Forward schema versions intentionally fail closed.
 */
export function parseProjectV1(value: unknown): ProjectValidationResult {
  if (!isRecord(value)) {
    return { ok: false, issues: ["Project must be an object."] };
  }

  const issues: string[] = [];
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    issues.push(`Unsupported project schema version: ${stringify(value.schemaVersion)}.`);
  }
  if (!nonEmptyString(value.id)) issues.push("Project id is required.");
  if (!nonEmptyString(value.createdAt) || !nonEmptyString(value.updatedAt)) {
    issues.push("Project timestamps are required.");
  }
  if (!isRecord(value.scenario) || !nonEmptyString(value.scenario.id)) {
    issues.push("Project scenario id is required.");
  }
  if (!isRecord(value.routing) || !finiteNumber(value.routing.timeMinutes)) {
    issues.push("Routing settings with timeMinutes are required.");
  }

  validateArray(value.points, "points", issues, validateProjectPoint);
  validateArray(value.poiLayers, "poiLayers", issues, validatePoiLayer);
  validateArray(value.isochrones, "isochrones", issues, validateIsochrone);
  validateArray(value.candidates, "candidates", issues, validateCandidate);

  if (!isRecord(value.civic)) {
    issues.push("Civic analysis is required.");
  } else {
    validateArray(value.civic.assets, "civic.assets", issues, validateAsset);
    validateArray(value.civic.underservedAreas, "civic.underservedAreas", issues, validateUnderserved);
  }

  validateArray(value.provenance, "provenance", issues, validateProvenance);
  validateProfile(value.profile, issues);
  validateV3Attachment(value.views, issues);
  validateNoSecrets(value, issues);

  if (issues.length > 0) return { ok: false, issues };

  return { ok: true, project: cloneJson(value) as MapGapProjectV1 };
}

export function assertProjectV1(value: unknown): MapGapProjectV1 {
  const result = parseProjectV1(value);
  if (!result.ok) {
    throw new Error(`Invalid MapGap project: ${result.issues.join(" ")}`);
  }
  return result.project;
}

export function cloneProjectV1(project: MapGapProjectV1): MapGapProjectV1 {
  return assertProjectV1(project);
}

export function projectDatasetCounts(project: MapGapProjectV1) {
  return {
    [MAPGAP_DATASET_IDS.points]: project.points.length,
    [MAPGAP_DATASET_IDS.isochrones]: project.isochrones.length,
    [MAPGAP_DATASET_IDS.pois]: project.poiLayers.reduce((count, layer) => count + layer.points.length, 0),
    [MAPGAP_DATASET_IDS.candidates]: project.candidates.length,
    [MAPGAP_DATASET_IDS.assets]: project.civic.assets.length,
    [MAPGAP_DATASET_IDS.underserved]: project.civic.underservedAreas.length,
  } as Record<MapGapDatasetId, number>;
}

function validateArray(
  value: unknown,
  label: string,
  issues: string[],
  validateItem: (item: unknown, label: string, issues: string[]) => void,
) {
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array.`);
    return;
  }

  const ids = new Set<string>();
  value.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`;
    validateItem(item, itemLabel, issues);
    if (isRecord(item) && typeof item.id === "string") {
      if (ids.has(item.id)) issues.push(`${label} contains duplicate id ${item.id}.`);
      ids.add(item.id);
    }
  });
}

function validateProjectPoint(value: unknown, label: string, issues: string[]) {
  if (!hasId(value, label, issues)) return;
  const item = value as JsonRecord;
  if (!nonEmptyString(item.name)) issues.push(`${label}.name is required.`);
  validatePointGeometry(item.geometry, `${label}.geometry`, issues);
  validateProvenance(item.provenance, `${label}.provenance`, issues);
}

function validatePoiLayer(value: unknown, label: string, issues: string[]) {
  if (!hasId(value, label, issues)) return;
  const item = value as JsonRecord;
  if (!nonEmptyString(item.label)) issues.push(`${label}.label is required.`);
  validateArray(item.points, `${label}.points`, issues, validatePoi);
}

function validatePoi(value: unknown, label: string, issues: string[]) {
  if (!hasId(value, label, issues)) return;
  const item = value as JsonRecord;
  validatePointGeometry(item.geometry, `${label}.geometry`, issues);
  validateProvenance(item.provenance, `${label}.provenance`, issues);
}

function validateIsochrone(value: unknown, label: string, issues: string[]) {
  if (!hasId(value, label, issues)) return;
  const item = value as JsonRecord;
  validateAreaGeometry(item.geometry, `${label}.geometry`, issues);
  for (const field of ["timeMinutes", "bucketMinutes", "adjustedMinutes", "effortScore"] as const) {
    if (!finiteNumber(item[field])) issues.push(`${label}.${field} must be finite.`);
  }
  validateProvenance(item.provenance, `${label}.provenance`, issues);
}

function validateCandidate(value: unknown, label: string, issues: string[]) {
  if (!hasId(value, label, issues)) return;
  const item = value as JsonRecord;
  validatePointGeometry(item.geometry, `${label}.geometry`, issues);
  if (item.score !== undefined) {
    if (!isRecord(item.score) || !finiteNumber(item.score.total)) {
      issues.push(`${label}.score.total must be finite when score is present.`);
    } else if (item.score.total < 0 || item.score.total > 100) {
      issues.push(`${label}.score.total must be between 0 and 100.`);
    }
  }
  validateProvenance(item.provenance, `${label}.provenance`, issues);
}

function validateAsset(value: unknown, label: string, issues: string[]) {
  if (!hasId(value, label, issues)) return;
  const item = value as JsonRecord;
  validatePointGeometry(item.geometry, `${label}.geometry`, issues);
  if (item.utilizationRate !== undefined && (!finiteNumber(item.utilizationRate) || item.utilizationRate < 0 || item.utilizationRate > 1)) {
    issues.push(`${label}.utilizationRate must be between 0 and 1.`);
  }
  validateProvenance(item.provenance, `${label}.provenance`, issues);
}

function validateUnderserved(value: unknown, label: string, issues: string[]) {
  if (!hasId(value, label, issues)) return;
  const item = value as JsonRecord;
  validateAreaGeometry(item.geometry, `${label}.geometry`, issues);
  if (!finiteNumber(item.underservedScore) || item.underservedScore < 0 || item.underservedScore > 100) {
    issues.push(`${label}.underservedScore must be between 0 and 100.`);
  }
  if (!Array.isArray(item.evidence) || item.evidence.some((entry) => !nonEmptyString(entry))) {
    issues.push(`${label}.evidence must contain textual evidence.`);
  }
  validateProvenance(item.provenance, `${label}.provenance`, issues);
}

function validateProfile(value: unknown, issues: string[]) {
  if (value === undefined) return;
  if (!isRecord(value) || !nonEmptyString(value.id)) {
    issues.push("profile must be a valid profile when present.");
    return;
  }
  validateArray(value.anchors, "profile.anchors", issues, (anchor, label, nestedIssues) => {
    if (!hasId(anchor, label, nestedIssues)) return;
    validatePointGeometry((anchor as JsonRecord).geometry, `${label}.geometry`, nestedIssues);
  });
  if (!Array.isArray(value.constraints)) issues.push("profile.constraints must be an array.");
}

function validateV3Attachment(value: unknown, issues: string[]) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push("views must be an object when present.");
    return;
  }
  if (value.v3 === undefined) return;
  if (!isRecord(value.v3) || value.v3.version !== V3_VIEW_ATTACHMENT_VERSION) {
    issues.push("views.v3 has an unsupported version.");
    return;
  }
  if (!Array.isArray(value.v3.datasetIds) || value.v3.datasetIds.some((id) => !isDatasetId(id))) {
    issues.push("views.v3.datasetIds must contain known MapGap dataset ids.");
  }
}

function validateProvenance(value: unknown, label: string, issues: string[]) {
  if (!isRecord(value) || !nonEmptyString(value.label) || !nonEmptyString(value.sourceType)) {
    issues.push(`${label} requires sourceType and label.`);
  }
}

function validatePointGeometry(value: unknown, label: string, issues: string[]) {
  if (!isRecord(value) || value.type !== "Point" || !isPosition(value.coordinates)) {
    issues.push(`${label} must be a valid Point geometry.`);
  }
}

function validateAreaGeometry(value: unknown, label: string, issues: string[]) {
  if (!isRecord(value) || (value.type !== "Polygon" && value.type !== "MultiPolygon")) {
    issues.push(`${label} must be a Polygon or MultiPolygon geometry.`);
    return;
  }

  const polygons = value.type === "Polygon" ? [value.coordinates] : value.coordinates;
  if (!Array.isArray(polygons) || polygons.length === 0) {
    issues.push(`${label} must contain at least one polygon.`);
    return;
  }

  polygons.forEach((polygon, polygonIndex) => {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      issues.push(`${label}[${polygonIndex}] must contain at least one ring.`);
      return;
    }
    polygon.forEach((ring, ringIndex) => {
      if (!Array.isArray(ring) || ring.length < 4 || ring.some((position) => !isPosition(position))) {
        issues.push(`${label}[${polygonIndex}][${ringIndex}] must be a closed coordinate ring.`);
        return;
      }
      const first = ring[0] as Position;
      const last = ring[ring.length - 1] as Position;
      if (first[0] !== last[0] || first[1] !== last[1]) {
        issues.push(`${label}[${polygonIndex}][${ringIndex}] must be closed.`);
      }
    });
  });
}

function validateNoSecrets(value: unknown, issues: string[]) {
  walkJson(value, [], (entry, path) => {
    const key = path[path.length - 1] || "";
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
    value.forEach((item, index) => walkJson(item, [...path, String(index)], visit));
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => walkJson(item, [...path, key], visit));
  }
}

function hasId(value: unknown, label: string, issues: string[]): value is JsonRecord {
  if (!isRecord(value) || !nonEmptyString(value.id)) {
    issues.push(`${label}.id is required.`);
    return false;
  }
  return true;
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2 && finiteNumber(value[0]) && finiteNumber(value[1]) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

function isDatasetId(value: unknown): value is MapGapDatasetId {
  return typeof value === "string" && Object.values(MAPGAP_DATASET_IDS).includes(value as MapGapDatasetId);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringify(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}
