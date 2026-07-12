import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  ANALYSIS_BUNDLE_SCHEMA_VERSION,
  MAPGAP_ANALYSIS_DATASET_IDS,
  analysisBundleUsage,
  parseAnalysisBundleV1,
  type AnalysisRepresentationV1,
  type MapGapAnalysisBundleV1,
} from "../src/analysis.ts";
import {
  getAlbanyHousingAnalysisBundleFixture,
  getComparisonAnalysisBundleFixture,
} from "../src/analysis-fixtures.ts";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
};

test("bounded ACS/TIGER fixture validates with explicit lineage, joins, and budgets", () => {
  const fixture = getAlbanyHousingAnalysisBundleFixture();
  const result = parseAnalysisBundleV1(fixture);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(fixture.schemaVersion, ANALYSIS_BUNDLE_SCHEMA_VERSION);
  assert.deepEqual(
    fixture.datasets.map((dataset) => dataset.descriptor.id),
    [
      MAPGAP_ANALYSIS_DATASET_IDS.accessSurface,
      MAPGAP_ANALYSIS_DATASET_IDS.tigerTracts,
      MAPGAP_ANALYSIS_DATASET_IDS.acsHousing,
      MAPGAP_ANALYSIS_DATASET_IDS.housingAreas,
    ],
  );
  assert.equal(fixture.joins[0]?.method, "attribute-equality");
  assert.equal(fixture.joins[0]?.outputDatasetId, MAPGAP_ANALYSIS_DATASET_IDS.housingAreas);
  assert.equal(result.usage.datasets, 4);
  assert.equal(result.usage.features, 7);
  assert.equal(result.usage.records, 2);
  assert.ok(result.usage.coordinates > 50);
  assert.ok(result.usage.encodedBytes < fixture.budget.maxEncodedBytes);
});

test("fixture-payload sha256 checksums match canonical inline payloads", () => {
  for (const key of ["civic", "relocation"] as const) {
    const fixture = getComparisonAnalysisBundleFixture(key);
    for (const dataset of fixture.datasets) {
      if (dataset.checksum.scope !== "fixture-payload") continue;
      const actual = createHash("sha256").update(canonicalJson(dataset.data)).digest("hex");
      assert.equal(actual, dataset.checksum.value, `${fixture.id}/${dataset.descriptor.id}`);
    }
  }
});

test("render-facing fixture properties match the comparison-map contract", () => {
  const fixture = getComparisonAnalysisBundleFixture("civic");
  const access = fixture.datasets.find((dataset) => dataset.descriptor.id === MAPGAP_ANALYSIS_DATASET_IDS.accessSurface);
  const housing = fixture.datasets.find((dataset) => dataset.descriptor.id === MAPGAP_ANALYSIS_DATASET_IDS.housingAreas);
  assert.ok(access && housing);
  assert.equal(access.descriptor.representation.kind, "inline-geojson");
  assert.equal(housing.descriptor.representation.kind, "inline-geojson");

  const accessProperties = access.data && !Array.isArray(access.data) ? access.data.features[0]?.properties : undefined;
  const housingProperties = housing.data && !Array.isArray(housing.data) ? housing.data.features[0]?.properties : undefined;
  for (const field of ["accessBand", "minutes", "mobilityMode", "routingProvider"]) {
    assert.ok(field in (accessProperties ?? {}), `missing access property ${field}`);
  }
  for (const field of ["name", "geoid", "medianGrossRent", "rentBurdenPercent", "rentBurdenBand", "sourceVintage"]) {
    assert.ok(field in (housingProperties ?? {}), `missing housing property ${field}`);
  }
});

test("relocation comparison remains geographically separate and access-only", () => {
  const fixture = getComparisonAnalysisBundleFixture("relocation-routed-access-v1");
  assert.equal(fixture.datasets.length, 1);
  assert.equal(fixture.datasets[0]?.descriptor.id, MAPGAP_ANALYSIS_DATASET_IDS.accessSurface);
  assert.match(fixture.geography.label, /Jersey City/);
  assert.equal(parseAnalysisBundleV1(fixture).ok, true);
});

test("parsing is defensive and future schema versions fail closed", () => {
  const fixture = getAlbanyHousingAnalysisBundleFixture();
  const result = parseAnalysisBundleV1(fixture);
  assert.equal(result.ok, true);
  if (result.ok) {
    result.bundle.datasets[0]!.descriptor.label = "changed";
    assert.notEqual(fixture.datasets[0]!.descriptor.label, "changed");
  }

  const future = clone(fixture) as MapGapAnalysisBundleV1 & { schemaVersion: string };
  future.schemaVersion = "mapgap-analysis-bundle/v2";
  const rejected = parseAnalysisBundleV1(future);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.ok(rejected.issues.some((issue) => issue.includes("Unsupported analysis bundle schema")));
});

test("feature, coordinate, byte, and dataset budgets are enforced", () => {
  const cases: Array<[keyof MapGapAnalysisBundleV1["budget"], number, string]> = [
    ["maxFeatures", 1, "maxFeatures"],
    ["maxCoordinates", 1, "maxCoordinates"],
    ["maxEncodedBytes", 1, "maxEncodedBytes"],
    ["maxDatasets", 1, "maxDatasets"],
  ];
  for (const [key, value, expected] of cases) {
    const fixture = getAlbanyHousingAnalysisBundleFixture();
    fixture.budget[key] = value;
    const result = parseAnalysisBundleV1(fixture);
    assert.equal(result.ok, false, `${String(key)} should reject`);
    if (!result.ok) assert.ok(result.issues.some((issue) => issue.includes(expected)));
  }

  const fixture = getAlbanyHousingAnalysisBundleFixture();
  fixture.datasets[0]!.descriptor.budget.maxCoordinates = 1;
  const datasetResult = parseAnalysisBundleV1(fixture);
  assert.equal(datasetResult.ok, false);
  if (!datasetResult.ok) assert.ok(datasetResult.issues.some((issue) => issue.includes("dataset mapgap-analysis-access-surface-v1 exceeds")));
});

test("field missing-value policies, checksums, bounds, and joins fail closed", () => {
  const badMissing = getAlbanyHousingAnalysisBundleFixture();
  badMissing.datasets[0]!.descriptor.fields[0]!.missing = { kind: "null", meaning: "missing" };
  assert.equal(parseAnalysisBundleV1(badMissing).ok, false);

  const badChecksum = getAlbanyHousingAnalysisBundleFixture();
  badChecksum.datasets[0]!.checksum.value = "not-a-checksum";
  assert.equal(parseAnalysisBundleV1(badChecksum).ok, false);

  const badBounds = getAlbanyHousingAnalysisBundleFixture();
  const data = badBounds.datasets[0]!.data;
  if (data && !Array.isArray(data)) data.features[0]!.geometry = { type: "Point", coordinates: [0, 0] };
  assert.equal(parseAnalysisBundleV1(badBounds).ok, false);

  const badJoin = getAlbanyHousingAnalysisBundleFixture();
  badJoin.joins[0]!.right.field = "notDeclared";
  assert.equal(parseAnalysisBundleV1(badJoin).ok, false);
});

test("Arrow query, MVT, and PMTiles scale-out representations validate without inline payloads", () => {
  const variants: AnalysisRepresentationV1[] = [
    {
      kind: "arrow-query",
      mediaType: "application/vnd.apache.arrow.stream",
      url: "https://data.example.org/housing.arrow",
      query: {
        protocol: "http-parameters",
        template: "bbox={bbox}&fields={fields}",
        allowedParameters: ["bbox", "fields"],
      },
      coordinateReferenceSystem: "EPSG:4326",
    },
    {
      kind: "mvt",
      mediaType: "application/vnd.mapbox-vector-tile",
      urlTemplate: "https://tiles.example.org/housing/{z}/{x}/{y}.mvt",
      sourceLayer: "housing",
      minZoom: 4,
      maxZoom: 14,
      coordinateReferenceSystem: "EPSG:3857",
    },
    {
      kind: "pmtiles",
      mediaType: "application/vnd.pmtiles",
      url: "https://tiles.example.org/housing.pmtiles",
      sourceLayer: "housing",
      minZoom: 4,
      maxZoom: 14,
      coordinateReferenceSystem: "EPSG:3857",
    },
  ];

  for (const representation of variants) {
    const fixture = getAlbanyHousingAnalysisBundleFixture();
    const housing = fixture.datasets.find((dataset) => dataset.descriptor.id === MAPGAP_ANALYSIS_DATASET_IDS.housingAreas)!;
    housing.descriptor.representation = representation;
    housing.data = null;
    const result = parseAnalysisBundleV1(fixture);
    assert.equal(result.ok, true, `${representation.kind} should validate`);
  }
});

test("remote representations reject token-bearing URLs and malformed tile templates", () => {
  const tokenFixture = getAlbanyHousingAnalysisBundleFixture();
  const housing = tokenFixture.datasets.find((dataset) => dataset.descriptor.id === MAPGAP_ANALYSIS_DATASET_IDS.housingAreas)!;
  housing.descriptor.representation = {
    kind: "pmtiles",
    mediaType: "application/vnd.pmtiles",
    url: "https://tiles.example.org/housing.pmtiles?access_token=secret",
    sourceLayer: "housing",
    minZoom: 4,
    maxZoom: 14,
    coordinateReferenceSystem: "EPSG:3857",
  };
  housing.data = null;
  assert.equal(parseAnalysisBundleV1(tokenFixture).ok, false);

  const mvtFixture = getAlbanyHousingAnalysisBundleFixture();
  const mvtHousing = mvtFixture.datasets.find((dataset) => dataset.descriptor.id === MAPGAP_ANALYSIS_DATASET_IDS.housingAreas)!;
  mvtHousing.descriptor.representation = {
    kind: "mvt",
    mediaType: "application/vnd.mapbox-vector-tile",
    urlTemplate: "https://tiles.example.org/housing.mvt",
    sourceLayer: "housing",
    minZoom: 4,
    maxZoom: 14,
    coordinateReferenceSystem: "EPSG:3857",
  };
  mvtHousing.data = null;
  assert.equal(parseAnalysisBundleV1(mvtFixture).ok, false);
});

test("commercial listing and parcel data stay blocked until every governance gate is explicit", () => {
  const blocked = getAlbanyHousingAnalysisBundleFixture();
  const housing = blocked.datasets.find((dataset) => dataset.descriptor.id === MAPGAP_ANALYSIS_DATASET_IDS.housingAreas)!;
  housing.governance.sourceClass = "commercial-listing";
  const blockedResult = parseAnalysisBundleV1(blocked);
  assert.equal(blockedResult.ok, false);
  if (!blockedResult.ok) {
    assert.ok(blockedResult.issues.some((issue) => issue.includes("permission is approved")));
    assert.ok(blockedResult.issues.some((issue) => issue.includes("server-brokered")));
    assert.ok(blockedResult.issues.some((issue) => issue.includes("retention TTL")));
  }

  const approved = getAlbanyHousingAnalysisBundleFixture();
  const approvedHousing = approved.datasets.find((dataset) => dataset.descriptor.id === MAPGAP_ANALYSIS_DATASET_IDS.housingAreas)!;
  approvedHousing.governance = {
    sourceClass: "commercial-parcel",
    permission: {
      status: "approved",
      reference: "contract-register/MG-2026-004",
      approvedAt: "2026-07-12T12:00:00.000Z",
    },
    authentication: {
      mode: "server-brokered",
      credentialStorage: "server-only",
      clientCredentialsProhibited: true,
    },
    retention: {
      mode: "ttl",
      days: 30,
      deletionProcedure: "Delete cached payloads and derived row-level extracts after 30 days.",
    },
  };
  approvedHousing.sensitivity.classification = "restricted";
  const approvedResult = parseAnalysisBundleV1(approved);
  assert.equal(approvedResult.ok, true);
});

test("usage helper reports the same bounded totals as validation", () => {
  const fixture = getAlbanyHousingAnalysisBundleFixture();
  const direct = analysisBundleUsage(fixture);
  const parsed = parseAnalysisBundleV1(fixture);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(direct, parsed.usage);
});
