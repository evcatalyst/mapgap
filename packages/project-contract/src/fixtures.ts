import { assertProjectV1, cloneProjectV1, type MapGapProjectV1 } from "./index";

const fixtureTimestamp = "2026-07-11T12:00:00.000Z";

const systemProvenance = {
  sourceType: "system" as const,
  label: "MapGap deterministic alpha fixture",
  updatedAt: fixtureTimestamp,
  confidence: "medium" as const,
};

const relocationProject = assertProjectV1({
  schemaVersion: "mapgap-project/v1",
  id: "relocation-routed-access-v1",
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
  scenario: { id: "dual-career", label: "Dual-career routed access comparison" },
  routing: {
    provider: "valhalla",
    transportMode: "foot-walking",
    mobilityMode: "walk",
    timeMinutes: 30,
    generatedAt: fixtureTimestamp,
  },
  profile: {
    id: "dual-career-profile",
    name: "Two anchors, one routed commute limit",
    scenarioId: "dual-career",
    regionLabel: "Jersey City pilot fixture",
    anchors: [
      {
        id: "anchor-work",
        name: "Work anchor",
        category: "work",
        priority: "required",
        geometry: { type: "Point", coordinates: [-74.0776, 40.7282] },
      },
      {
        id: "anchor-family",
        name: "Family anchor",
        category: "family",
        priority: "preferred",
        geometry: { type: "Point", coordinates: [-74.0704, 40.7151] },
      },
    ],
    constraints: [
      {
        type: "commute",
        anchorId: "anchor-work",
        maxMinutes: 30,
        priority: "required",
        transportMode: "foot-walking",
        mobilityMode: "walk",
      },
    ],
    weights: {
      commute: 0.4,
      anchors: 0.2,
      amenities: 0.2,
      schools: 0,
      healthcare: 0,
      affordability: 0,
      civicCapacity: 0,
      frictionPenalty: 0.2,
    },
  },
  points: [
    {
      id: "anchor-work",
      name: "Work anchor",
      geometry: { type: "Point", coordinates: [-74.0776, 40.7282] },
      color: "#2563eb",
      provenance: {
        sourceType: "user",
        label: "MapGap relocation profile",
        updatedAt: fixtureTimestamp,
        confidence: "high",
      },
    },
    {
      id: "anchor-family",
      name: "Family anchor",
      geometry: { type: "Point", coordinates: [-74.0704, 40.7151] },
      color: "#9333ea",
      provenance: {
        sourceType: "user",
        label: "MapGap relocation profile",
        updatedAt: fixtureTimestamp,
        confidence: "high",
      },
    },
  ],
  poiLayers: [
    {
      id: "poi-groceries",
      label: "Groceries",
      category: "grocery",
      query: "grocery",
      source: "open-data",
      visible: true,
      createdAt: fixtureTimestamp,
      points: [
        {
          id: "grocery-1",
          name: "Fixture Market",
          geometry: { type: "Point", coordinates: [-74.0812, 40.7211] },
          category: "grocery",
          source: "open-data",
          sourceId: "fixture-market-1",
          provenance: {
            sourceType: "open-data",
            label: "Fixture open-data grocery source",
            datasetId: "fixture-market-1",
            updatedAt: fixtureTimestamp,
            confidence: "medium",
          },
        },
      ],
    },
  ],
  isochrones: [
    {
      id: "iso-work-30",
      pointId: "anchor-work",
      pointName: "Work anchor",
      color: "#2563eb",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-74.094, 40.711],
            [-74.056, 40.711],
            [-74.056, 40.733],
            [-74.070, 40.742],
            [-74.094, 40.733],
            [-74.094, 40.711],
          ],
        ],
      },
      timeMinutes: 30,
      bucketMinutes: 30,
      adjustedMinutes: 30,
      effortScore: 0,
      mobilityMode: "walk",
      transportMode: "foot-walking",
      routingProvider: "valhalla",
      isochroneMode: "individual",
      generatedAt: fixtureTimestamp,
      provenance: {
        sourceType: "routing-provider",
        label: "Valhalla fixture route contour",
        updatedAt: fixtureTimestamp,
        confidence: "medium",
      },
    },
  ],
  candidates: [
    {
      id: "candidate-proximity-only",
      label: "Nearby but fails routed commute",
      source: "listing",
      geometry: { type: "Point", coordinates: [-74.051, 40.735] },
      rank: 2,
      score: {
        total: 42,
        band: "failed",
        components: [
          {
            key: "commute",
            label: "Commute fit",
            value: 20,
            explanation: "Direct proximity looks close, but the 30-minute routed contour does not contain this candidate.",
          },
          {
            key: "amenities",
            label: "Daily-life fit",
            value: 88,
            explanation: "The candidate retains nearby grocery access.",
          },
        ],
        failedConstraints: [
          {
            constraintType: "commute",
            label: "Required work commute",
            explanation: "Fails the 30-minute routed walking access constraint despite short straight-line proximity.",
          },
        ],
        assumptions: [
          {
            id: "routed-evidence",
            label: "Routed access",
            value: "Fixture Valhalla 30-minute contour.",
            source: "routing-provider",
          },
        ],
      },
      provenance: {
        sourceType: "import",
        label: "Fixture listing import",
        updatedAt: fixtureTimestamp,
        confidence: "medium",
      },
    },
    {
      id: "candidate-routed-pass",
      label: "Less proximate but routed-access pass",
      source: "listing",
      geometry: { type: "Point", coordinates: [-74.087, 40.721] },
      rank: 1,
      score: {
        total: 87,
        band: "excellent",
        components: [
          {
            key: "commute",
            label: "Commute fit",
            value: 95,
            explanation: "The candidate sits inside the same 30-minute routed contour.",
          },
          {
            key: "amenities",
            label: "Daily-life fit",
            value: 78,
            explanation: "One visible grocery source supports the score.",
          },
        ],
        failedConstraints: [],
        assumptions: [
          {
            id: "routed-evidence",
            label: "Routed access",
            value: "Fixture Valhalla 30-minute contour.",
            source: "routing-provider",
          },
        ],
      },
      provenance: {
        sourceType: "import",
        label: "Fixture listing import",
        updatedAt: fixtureTimestamp,
        confidence: "medium",
      },
    },
  ],
  civic: { assets: [], underservedAreas: [] },
  provenance: [systemProvenance],
});

const civicCapacityProject = assertProjectV1({
  schemaVersion: "mapgap-project/v1",
  id: "civic-capacity-gap-v1",
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
  scenario: { id: "asset-audit", label: "Civic capacity and underserved-area analysis" },
  routing: {
    provider: "valhalla",
    transportMode: "foot-walking",
    mobilityMode: "walk",
    timeMinutes: 15,
    generatedAt: fixtureTimestamp,
  },
  points: [
    {
      id: "computer-lab",
      name: "Northside Computer Lab",
      geometry: { type: "Point", coordinates: [-73.792, 42.665] },
      color: "#0f766e",
      provenance: {
        sourceType: "import",
        label: "Partner facilities CSV",
        datasetId: "capital-region-facilities-2026-q2",
        updatedAt: fixtureTimestamp,
        confidence: "medium",
      },
    },
    {
      id: "library",
      name: "Eastside Library",
      geometry: { type: "Point", coordinates: [-73.776, 42.674] },
      color: "#7c3aed",
      provenance: {
        sourceType: "open-data",
        label: "Municipal library inventory",
        datasetId: "library-inventory-2026",
        updatedAt: fixtureTimestamp,
        confidence: "high",
      },
    },
  ],
  poiLayers: [],
  isochrones: [
    {
      id: "iso-computer-lab-15",
      pointId: "computer-lab",
      pointName: "Northside Computer Lab",
      color: "#0f766e",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-73.806, 42.654],
            [-73.779, 42.654],
            [-73.779, 42.677],
            [-73.806, 42.677],
            [-73.806, 42.654],
          ],
        ],
      },
      timeMinutes: 15,
      bucketMinutes: 15,
      adjustedMinutes: 15,
      effortScore: 0,
      mobilityMode: "walk",
      transportMode: "foot-walking",
      routingProvider: "valhalla",
      isochroneMode: "individual",
      generatedAt: fixtureTimestamp,
      provenance: {
        sourceType: "routing-provider",
        label: "Valhalla fixture 15-minute contour",
        updatedAt: fixtureTimestamp,
        confidence: "medium",
      },
    },
  ],
  candidates: [],
  civic: {
    assets: [
      {
        id: "computer-lab",
        pointId: "computer-lab",
        name: "Northside Computer Lab",
        assetType: "computer-lab",
        geometry: { type: "Point", coordinates: [-73.792, 42.665] },
        capacity: 24,
        utilizationRate: 0.67,
        sourceUtilization: "16 / 24",
        hoursOpen: "Mon–Sat 09:00–18:00",
        staffing: "2 staff",
        provenance: {
          sourceType: "import",
          label: "Partner facilities CSV",
          datasetId: "capital-region-facilities-2026-q2",
          updatedAt: fixtureTimestamp,
          confidence: "medium",
        },
      },
      {
        id: "library",
        pointId: "library",
        name: "Eastside Library",
        assetType: "library",
        geometry: { type: "Point", coordinates: [-73.776, 42.674] },
        capacity: 48,
        utilizationRate: 0.33,
        sourceUtilization: "16 / 48",
        hoursOpen: "Mon–Thu 10:00–20:00",
        staffing: "4 staff",
        provenance: {
          sourceType: "open-data",
          label: "Municipal library inventory",
          datasetId: "library-inventory-2026",
          updatedAt: fixtureTimestamp,
          confidence: "high",
        },
      },
    ],
    underservedAreas: [
      {
        id: "underserved-east-corridor",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-73.772, 42.661],
              [-73.758, 42.661],
              [-73.758, 42.675],
              [-73.772, 42.675],
              [-73.772, 42.661],
            ],
          ],
        },
        underservedScore: 82,
        reachableCapacity: 0,
        evidence: [
          "Outside the fixture 15-minute routed service contour.",
          "Capacity proxy is zero for the selected service time.",
          "This is a deterministic alpha proxy, not a demographic need finding.",
        ],
        provenance: {
          sourceType: "system",
          label: "MapGap deterministic underserved-capacity proxy",
          updatedAt: fixtureTimestamp,
          confidence: "medium",
          note: "Use public need data before making a funding or siting claim.",
        },
      },
    ],
  },
  provenance: [systemProvenance],
});

export function getRelocationProjectFixture(): MapGapProjectV1 {
  return cloneProjectV1(relocationProject);
}

export function getCivicCapacityProjectFixture(): MapGapProjectV1 {
  return cloneProjectV1(civicCapacityProject);
}
