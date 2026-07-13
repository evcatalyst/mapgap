import { expect, test } from "@playwright/test";
import {
  MAPGAP_DATASET_IDS,
  V3_VIEW_ATTACHMENT_VERSION,
  parseProjectV1,
} from "@mapgap/project-contract";
import {
  getCivicCapacityProjectFixture,
  getRelocationProjectFixture,
} from "@mapgap/project-contract/fixtures";
import { normalizeV2Utilization, projectFromV2, type V2ProjectSource } from "../../../src/lib/v3ProjectAdapter";

test("portable fixtures validate, clone defensively, and reject a forward schema", () => {
  const relocation = getRelocationProjectFixture();
  const civic = getCivicCapacityProjectFixture();

  expect(parseProjectV1(relocation)).toMatchObject({ ok: true });
  expect(parseProjectV1(civic)).toMatchObject({ ok: true });
  expect(relocation.candidates).toHaveLength(2);
  expect(civic.civic.assets.map((asset) => asset.capacity)).toEqual([24, 48]);

  const future = { ...relocation, schemaVersion: "mapgap-project/v2" };
  const result = parseProjectV1(future);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.join(" ")).toContain("Unsupported project schema version");
});

test("V3 view attachment and project validation refuse credential-like values", () => {
  const project = getRelocationProjectFixture();
  project.views = {
    v3: {
      version: V3_VIEW_ATTACHMENT_VERSION,
      datasetIds: [MAPGAP_DATASET_IDS.candidates],
      config: { access_token: "must-not-persist" },
    },
  };

  const result = parseProjectV1(project);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.join(" ")).toContain("Forbidden credential-like field");
});

test("the one-way V2 adapter preserves decision evidence and omits V2 secrets", () => {
  const source = makeV2Source();
  const project = projectFromV2(source);
  const serialized = JSON.stringify(project);

  expect(project.schemaVersion).toBe("mapgap-project/v1");
  expect(project.profile?.anchors[0].geometry.coordinates).toEqual([-73.8457, 42.7798]);
  expect(project.isochrones[0].geometry.coordinates).toEqual(source.isochrones[0].geometry.coordinates);
  expect(project.candidates[0].score?.failedConstraints[0].label).toBe("Required commute");
  expect(project.civic.assets[0].capacity).toBe(24);
  expect(project.civic.assets[0].utilizationRate).toBeCloseTo(2 / 3, 6);
  expect(serialized).not.toContain("v2-secret-must-never-cross-the-adapter");
  expect(source.points[0].utilization).toBe("16 / 24");
});

test("V2 utilization normalization stays explicit rather than guessing from text", () => {
  expect(normalizeV2Utilization("67%", 24)).toBe(0.67);
  expect(normalizeV2Utilization("16 / 24", 24)).toBeCloseTo(2 / 3, 6);
  expect(normalizeV2Utilization("high", 24)).toBeUndefined();
});

function makeV2Source(): V2ProjectSource {
  const createdAt = "2026-07-11T12:00:00.000Z";
  return {
    id: "v2-parity-fixture",
    createdAt,
    updatedAt: createdAt,
    settings: {
      selectedScenario: "asset-audit",
      routingProvider: "valhalla",
      transportMode: "foot-walking",
      mobilityMode: "walk",
      timeMinutes: 15,
      // Deliberately supplied as an extra runtime field; the adapter's Pick
      // cannot read or serialize it.
      valhallaAccessSecret: "v2-secret-must-never-cross-the-adapter",
    } as V2ProjectSource["settings"],
    decisionProfile: {
      id: "profile-v2",
      name: "V2 parity profile",
      scenarioId: "asset-audit",
      regionLabel: "Capital Region",
      anchors: [
        {
          id: "work",
          name: "Work",
          category: "work",
          priority: "required",
          lat: 42.7798,
          lng: -73.8457,
        },
      ],
      constraints: [
        {
          type: "commute",
          anchorId: "work",
          maxMinutes: 15,
          priority: "required",
          transportMode: "foot-walking",
          mobilityMode: "walk",
        },
      ],
      weights: {
        commute: 1,
        anchors: 0,
        amenities: 0,
        schools: 0,
        healthcare: 0,
        affordability: 0,
        civicCapacity: 0,
        frictionPenalty: 0,
      },
    },
    points: [
      {
        id: "asset-1",
        name: "Computer Lab",
        lat: 42.78,
        lng: -73.84,
        assetType: "computer-lab",
        capacity: 24,
        utilization: "16 / 24",
        color: "#0f766e",
        createdAt,
      },
    ],
    poiLayers: [],
    isochrones: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[[-73.86, 42.77], [-73.83, 42.77], [-73.83, 42.79], [-73.86, 42.77]]],
        },
        properties: {
          id: "iso-v2",
          pointId: "asset-1",
          pointName: "Computer Lab",
          color: "#0f766e",
          timeMinutes: 15,
          bucketMinutes: 15,
          adjustedMinutes: 15,
          effortScore: 0,
          mobilityMode: "walk",
          transportMode: "foot-walking",
          routingProvider: "valhalla",
          isochroneMode: "individual",
        },
      },
    ],
    candidateHomes: [
      {
        id: "candidate-v2",
        label: "Candidate V2",
        source: "grid",
        lat: 42.781,
        lng: -73.842,
        score: {
          total: 80,
          band: "good",
          components: [{ key: "commute", label: "Commute fit", value: 80, explanation: "Within fixture range." }],
          failedConstraints: [{ constraintType: "commute", label: "Required commute", explanation: "Fixture failure detail." }],
          assumptions: [{ id: "fixture", label: "Fixture", value: "Deterministic", source: "system" }],
        },
      },
    ],
  };
}
