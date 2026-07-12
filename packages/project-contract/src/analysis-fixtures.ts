import {
  ANALYSIS_BUNDLE_SCHEMA_VERSION,
  MAPGAP_ANALYSIS_DATASET_IDS,
  assertAnalysisBundleV1,
  cloneAnalysisBundleV1,
  type AnalysisDatasetBudgetV1,
  type AnalysisFieldV1,
  type AnalysisJsonRecord,
  type AnalysisLicenseV1,
  type AnalysisPolygonGeometryV1,
  type AnalysisSensitivityV1,
  type AnalysisSourceV1,
  type MapGapAnalysisBundleV1,
  type MapGapAnalysisDatasetV1,
} from "@mapgap/project-contract/analysis";

const fixtureTimestamp = "2026-07-12T12:00:00.000Z";
const publicDomainLicense: AnalysisLicenseV1 = {
  name: "U.S. Government public domain",
  url: "https://www.census.gov/about/policies/copyright.html",
  attribution: "U.S. Census Bureau",
  redistribution: "allowed",
};
const fixtureLicense: AnalysisLicenseV1 = {
  name: "MapGap alpha fixture",
  url: "https://github.com/evcatalyst/mapgap",
  attribution: "MapGap deterministic alpha fixture",
  redistribution: "allowed",
};
const publicAggregateSensitivity: AnalysisSensitivityV1 = {
  classification: "public",
  containsPersonalData: false,
  containsPrecisePersonLocations: false,
  aggregationLevel: "census tract or coarser",
  retention: "public-data-no-contractual-limit",
  handlingNote: "Aggregate public data only; do not infer household- or person-level characteristics.",
};
const routedSurfaceSensitivity: AnalysisSensitivityV1 = {
  classification: "public",
  containsPersonalData: false,
  containsPrecisePersonLocations: false,
  aggregationLevel: "routed travel-time contour",
  retention: "public-data-no-contractual-limit",
  handlingNote: "Fixture contours are decision-support evidence, not observed person movements.",
};
const publicOpenDataGovernance = {
  sourceClass: "public-open-data" as const,
  permission: { status: "not-required" as const },
  authentication: {
    mode: "none" as const,
    credentialStorage: "none" as const,
    clientCredentialsProhibited: true as const,
  },
  retention: { mode: "unlimited-public" as const },
};
const mapgapDerivedGovernance = {
  ...publicOpenDataGovernance,
  sourceClass: "mapgap-derived" as const,
};
const generousFixtureBudget: AnalysisDatasetBudgetV1 = {
  maxFeatures: 8,
  maxRecords: 8,
  maxCoordinates: 300,
  maxEncodedBytes: 100_000,
};

const required = (
  name: string,
  label: string,
  type: AnalysisFieldV1["type"],
  unit: AnalysisFieldV1["unit"],
  description: string,
  sourceVariable?: string,
): AnalysisFieldV1 => ({
  name,
  label,
  type,
  unit,
  nullable: false,
  missing: { kind: "not-applicable", meaning: "This required field has no missing representation." },
  description,
  ...(sourceVariable ? { sourceVariable } : {}),
});

const nullable = (
  name: string,
  label: string,
  type: AnalysisFieldV1["type"],
  unit: AnalysisFieldV1["unit"],
  description: string,
  sourceVariable?: string,
): AnalysisFieldV1 => ({
  name,
  label,
  type,
  unit,
  nullable: true,
  missing: {
    kind: "null",
    meaning: "Null means the source estimate is unavailable, suppressed, or not statistically applicable; it is never zero.",
  },
  description,
  ...(sourceVariable ? { sourceVariable } : {}),
});

const accessFields: AnalysisFieldV1[] = [
  required("id", "Surface id", "string", "none", "Stable identifier for the access band."),
  required("accessBand", "Access band", "string", "category", "Ordered access category used for visual encoding."),
  required("minutes", "Travel time", "integer", "minutes", "Outer routed travel-time threshold for this band."),
  required("mobilityMode", "Mobility mode", "string", "category", "User-facing mobility mode used to calculate the contour."),
  required("routingProvider", "Routing provider", "string", "category", "Provider or graph implementation that produced the contour."),
];

const tigerFields: AnalysisFieldV1[] = [
  required("geoid", "Census geography id", "string", "geoid", "Full Census Reporter tract geography identifier."),
  required("name", "Tract name", "string", "none", "Human-readable Census tract name."),
  required("landAreaSquareMeters", "Land area", "integer", "count", "TIGER land area in square meters.", "ALAND"),
];

const acsFields: AnalysisFieldV1[] = [
  required("geoid", "Census geography id", "string", "geoid", "Full tract identifier used to join ACS and TIGER."),
  required("name", "Tract name", "string", "none", "Human-readable Census tract name."),
  nullable("housingUnits", "Housing units", "integer", "count", "Estimated total housing units.", "B25001_001E"),
  nullable("medianGrossRent", "Median gross rent", "integer", "usd-current", "Median gross rent in current dollars.", "B25064_001E"),
  nullable("rentBurdenPercent", "Rent burden", "number", "percent", "Share of computed renter households paying at least 30% of income toward gross rent.", "B25070_007E+B25070_008E+B25070_009E+B25070_010E"),
  nullable("vacancyPercent", "Vacancy", "number", "percent", "Vacant housing units divided by total housing units.", "B25002_003E/B25002_001E"),
  required("sourceVintage", "Source vintage", "string", "none", "ACS release period shown to analysts."),
];

const housingAreaFields: AnalysisFieldV1[] = [
  ...acsFields,
  required("rentBurdenBand", "Rent burden band", "string", "category", "Deterministic display class derived from rentBurdenPercent."),
];

const tigerSource: AnalysisSourceV1 = {
  id: "census-tiger-2023",
  publisher: "U.S. Census Bureau",
  title: "TIGER/Line 2023 census tract boundaries, Albany County extract",
  datasetId: "TIGER2023-TRACT-36001",
  url: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.2023.html",
  retrievedAt: fixtureTimestamp,
  vintage: { kind: "as-of", date: "2023-01-01" },
  license: publicDomainLicense,
};

const acsSource: AnalysisSourceV1 = {
  id: "census-acs-2024-5yr",
  publisher: "U.S. Census Bureau",
  title: "ACS 2024 5-year housing estimates, Albany County tract extract",
  datasetId: "acs2024_5yr",
  url: "https://www.census.gov/programs-surveys/acs/data.html",
  retrievedAt: fixtureTimestamp,
  vintage: { kind: "period", startYear: 2020, endYear: 2024 },
  license: publicDomainLicense,
};

const routeSource: AnalysisSourceV1 = {
  id: "mapgap-v2-access-surface-fixture",
  publisher: "MapGap",
  title: "Deterministic V2 routed access-surface fixture",
  datasetId: "mapgap-v2-access-surface-alpha",
  url: "https://github.com/evcatalyst/mapgap",
  retrievedAt: fixtureTimestamp,
  vintage: { kind: "as-of", date: "2026-07-12" },
  license: fixtureLicense,
};

const tracts: Array<{ geoid: string; name: string; landAreaSquareMeters: number; geometry: AnalysisPolygonGeometryV1 }> = [
  {
    geoid: "14000US36001000100",
    name: "Census Tract 1, Albany, NY",
    landAreaSquareMeters: 2_367_456,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-73.745419, 42.67113], [-73.74506, 42.672279], [-73.743117, 42.679323],
        [-73.741265, 42.678681], [-73.738519, 42.677895], [-73.736974, 42.677355],
        [-73.735153, 42.676873], [-73.732619, 42.67597], [-73.72619, 42.673994],
        [-73.723958, 42.67318], [-73.723263, 42.672879], [-73.724964, 42.670179],
        [-73.729127, 42.665052], [-73.730864, 42.663279], [-73.736364, 42.659179],
        [-73.739429, 42.656803], [-73.741511, 42.658004], [-73.741671, 42.65819],
        [-73.74283, 42.658936], [-73.74166, 42.660655], [-73.743899, 42.662171],
        [-73.743392, 42.663566], [-73.744124, 42.663822], [-73.744107, 42.663973],
        [-73.743362, 42.665549], [-73.744021, 42.666824], [-73.744516, 42.668107],
        [-73.745096, 42.669948], [-73.745489, 42.670923], [-73.745419, 42.67113],
      ]],
    },
  },
  {
    geoid: "14000US36001000201",
    name: "Census Tract 2.01, Albany, NY",
    landAreaSquareMeters: 615_867,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-73.7616, 42.658335], [-73.759932, 42.659968], [-73.761562, 42.660941],
        [-73.761101, 42.661338], [-73.760179, 42.662273], [-73.759101, 42.663258],
        [-73.759079, 42.66334], [-73.758664, 42.663708], [-73.755458, 42.66186],
        [-73.752749, 42.66025], [-73.750328, 42.658887], [-73.749265, 42.658246],
        [-73.749342, 42.658097], [-73.749412, 42.657812], [-73.749727, 42.656209],
        [-73.749944, 42.654679], [-73.750031, 42.654244], [-73.750045, 42.654009],
        [-73.750127, 42.65373], [-73.750223, 42.653544], [-73.750875, 42.652557],
        [-73.751621, 42.652998], [-73.753194, 42.654202], [-73.753571, 42.654455],
        [-73.754706, 42.655158], [-73.757608, 42.656822], [-73.758936, 42.657615],
        [-73.759491, 42.657123], [-73.759607, 42.65711], [-73.760862, 42.657704],
        [-73.761745, 42.658177], [-73.7616, 42.658335],
      ]],
    },
  },
];

const housingRows: AnalysisJsonRecord[] = [
  {
    geoid: "14000US36001000100",
    name: "Census Tract 1, Albany, NY",
    housingUnits: 1028,
    medianGrossRent: 1243,
    rentBurdenPercent: 56.14,
    vacancyPercent: 16.54,
    sourceVintage: "ACS 2024 5-year (2020–2024)",
  },
  {
    geoid: "14000US36001000201",
    name: "Census Tract 2.01, Albany, NY",
    housingUnits: 1691,
    medianGrossRent: 1091,
    rentBurdenPercent: 47.95,
    vacancyPercent: 21.41,
    sourceVintage: "ACS 2024 5-year (2020–2024)",
  },
];

const accessSurfaceDataset: MapGapAnalysisDatasetV1 = {
  descriptor: {
    id: MAPGAP_ANALYSIS_DATASET_IDS.accessSurface,
    label: "Routed access surface",
    description: "Nested fixture travel-time bands emitted in the V2-to-V3 access-surface shape.",
    role: "access-surface",
    primaryKey: "id",
    geometryTypes: ["Polygon"],
    fields: accessFields,
    unknownFields: "reject",
    representation: { kind: "inline-geojson", mediaType: "application/geo+json", coordinateReferenceSystem: "EPSG:4326" },
    budget: generousFixtureBudget,
  },
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "access-near-5",
        properties: { id: "access-near-5", accessBand: "near", minutes: 5, mobilityMode: "walk", routingProvider: "fixture-valhalla" },
        geometry: { type: "Polygon", coordinates: [[[-73.800, 42.658], [-73.785, 42.654], [-73.770, 42.661], [-73.773, 42.675], [-73.792, 42.676], [-73.803, 42.668], [-73.800, 42.658]]] },
      },
      {
        type: "Feature",
        id: "access-middle-10",
        properties: { id: "access-middle-10", accessBand: "middle", minutes: 10, mobilityMode: "walk", routingProvider: "fixture-valhalla" },
        geometry: { type: "Polygon", coordinates: [[[-73.811, 42.651], [-73.786, 42.642], [-73.758, 42.650], [-73.748, 42.670], [-73.764, 42.687], [-73.793, 42.689], [-73.814, 42.675], [-73.811, 42.651]]] },
      },
      {
        type: "Feature",
        id: "access-gap-15",
        properties: { id: "access-gap-15", accessBand: "gap", minutes: 15, mobilityMode: "walk", routingProvider: "fixture-valhalla" },
        geometry: { type: "Polygon", coordinates: [[[-73.824, 42.643], [-73.788, 42.631], [-73.745, 42.641], [-73.724, 42.670], [-73.748, 42.700], [-73.793, 42.704], [-73.828, 42.681], [-73.824, 42.643]]] },
      },
    ],
  },
  provenance: {
    sources: [routeSource],
    transforms: [{
      id: "normalize-v2-access-surface",
      description: "Map V2 routed rings to ordered, non-overlapping presentation bands while retaining minutes, mode, and provider.",
      inputSourceIds: [routeSource.id],
      outputFields: accessFields.map((field) => field.name),
      executedAt: fixtureTimestamp,
      software: "@mapgap/project-contract fixture builder",
    }],
    caveat: "Deterministic alpha geometry; production output must be generated from the active routing graph and parameters.",
  },
  checksum: { algorithm: "sha256", value: "9ff78490c5d24cc62022e2bbf0475c62266f98322b249cd4098efadbfea85d31", scope: "fixture-payload", canonicalization: "RFC8785" },
  sensitivity: routedSurfaceSensitivity,
  governance: mapgapDerivedGovernance,
};

const tigerDataset: MapGapAnalysisDatasetV1 = {
  descriptor: {
    id: MAPGAP_ANALYSIS_DATASET_IDS.tigerTracts,
    label: "TIGER tract boundaries",
    description: "Bounded two-tract TIGER 2023 geometry input retained for lineage and reproducible joining.",
    role: "source-geometry",
    primaryKey: "geoid",
    geometryTypes: ["Polygon"],
    fields: tigerFields,
    unknownFields: "reject",
    representation: { kind: "inline-geojson", mediaType: "application/geo+json", coordinateReferenceSystem: "EPSG:4326" },
    budget: generousFixtureBudget,
  },
  data: {
    type: "FeatureCollection",
    features: tracts.map((tract) => ({
      type: "Feature" as const,
      id: tract.geoid,
      geometry: tract.geometry,
      properties: { geoid: tract.geoid, name: tract.name, landAreaSquareMeters: tract.landAreaSquareMeters },
    })),
  },
  provenance: {
    sources: [tigerSource],
    transforms: [{
      id: "bounded-tiger-extract",
      description: "Select two Albany County tracts and retain published TIGER coordinate precision.",
      inputSourceIds: [tigerSource.id],
      outputFields: tigerFields.map((field) => field.name),
      executedAt: fixtureTimestamp,
    }],
  },
  checksum: { algorithm: "sha256", value: "1dff53bb3b25ffb98c567750b95028958926c9061a21bc2e9b1b2a4e817ff969", scope: "fixture-payload", canonicalization: "RFC8785" },
  sensitivity: publicAggregateSensitivity,
  governance: publicOpenDataGovernance,
};

const acsDataset: MapGapAnalysisDatasetV1 = {
  descriptor: {
    id: MAPGAP_ANALYSIS_DATASET_IDS.acsHousing,
    label: "ACS housing estimates",
    description: "Bounded tract housing estimates used by the location-intelligence comparison.",
    role: "source-table",
    primaryKey: "geoid",
    geometryTypes: [],
    fields: acsFields,
    unknownFields: "reject",
    representation: { kind: "inline-records", mediaType: "application/json" },
    budget: generousFixtureBudget,
  },
  data: housingRows,
  provenance: {
    sources: [acsSource],
    transforms: [{
      id: "derive-housing-indicators",
      description: "Select estimates and calculate vacancy and 30%-or-more gross-rent-burden shares; round display percentages to two decimals.",
      inputSourceIds: [acsSource.id],
      outputFields: acsFields.map((field) => field.name),
      executedAt: fixtureTimestamp,
    }],
    caveat: "ACS estimates carry sampling error. The fixture does not imply tract-level causation or person-level conditions.",
  },
  checksum: { algorithm: "sha256", value: "22600e11ab5ca1aa6775f0b42373d03191923ddb3c884d43ca411e67e5df6a8d", scope: "fixture-payload", canonicalization: "RFC8785" },
  sensitivity: publicAggregateSensitivity,
  governance: publicOpenDataGovernance,
};

const housingAreasDataset: MapGapAnalysisDatasetV1 = {
  descriptor: {
    id: MAPGAP_ANALYSIS_DATASET_IDS.housingAreas,
    label: "Housing location intelligence",
    description: "Render-ready materialization of ACS housing indicators joined to TIGER tract geometry.",
    role: "location-intelligence",
    primaryKey: "geoid",
    geometryTypes: ["Polygon"],
    fields: housingAreaFields,
    unknownFields: "reject",
    representation: { kind: "inline-geojson", mediaType: "application/geo+json", coordinateReferenceSystem: "EPSG:4326" },
    budget: generousFixtureBudget,
  },
  data: {
    type: "FeatureCollection",
    features: tracts.map((tract) => {
      const housing = housingRows.find((row) => row.geoid === tract.geoid)!;
      const burden = housing.rentBurdenPercent as number;
      return {
        type: "Feature" as const,
        id: tract.geoid,
        geometry: tract.geometry,
        properties: {
          ...housing,
          rentBurdenBand: burden >= 50 ? "high" : burden >= 40 ? "elevated" : "lower",
        },
      };
    }),
  },
  provenance: {
    sources: [tigerSource, acsSource],
    transforms: [{
      id: "materialize-housing-areas",
      description: "Left join TIGER tract geometry to ACS estimates by full GEOID and derive a deterministic rent-burden display band.",
      inputSourceIds: [tigerSource.id, acsSource.id],
      outputFields: housingAreaFields.map((field) => field.name),
      executedAt: fixtureTimestamp,
    }],
    caveat: "Context layer only. Housing indicators must not silently alter a MapGap routed-access score.",
  },
  checksum: { algorithm: "sha256", value: "f1144adff7fa0f31bf0d5dac19f7af5a23b6225eadfd5e6419169654fc7058ff", scope: "fixture-payload", canonicalization: "RFC8785" },
  sensitivity: publicAggregateSensitivity,
  governance: mapgapDerivedGovernance,
};

const albanyHousingComparison = assertAnalysisBundleV1({
  schemaVersion: ANALYSIS_BUNDLE_SCHEMA_VERSION,
  id: "mapgap-albany-access-housing-comparison-v1",
  label: "Albany access and housing comparison fixture",
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
  geography: {
    label: "Albany, New York bounded alpha extent",
    coordinateReferenceSystem: "EPSG:4326",
    boundingBox: [-73.84, 42.62, -73.70, 42.72],
  },
  datasets: [accessSurfaceDataset, tigerDataset, acsDataset, housingAreasDataset],
  joins: [{
    id: "join-tiger-acs-housing",
    label: "TIGER geometry to ACS housing estimates",
    left: { datasetId: MAPGAP_ANALYSIS_DATASET_IDS.tigerTracts, field: "geoid" },
    right: { datasetId: MAPGAP_ANALYSIS_DATASET_IDS.acsHousing, field: "geoid" },
    outputDatasetId: MAPGAP_ANALYSIS_DATASET_IDS.housingAreas,
    method: "attribute-equality",
    cardinality: "one-to-one",
    unmatched: "retain-null",
    description: "Materialize the analyst housing layer without hiding source-table or source-geometry lineage.",
  }],
  budget: {
    maxDatasets: 6,
    maxFeatures: 20,
    maxRecords: 10,
    maxCoordinates: 800,
    maxEncodedBytes: 400_000,
  },
});

const relocationAccessDataset = JSON.parse(JSON.stringify(accessSurfaceDataset)) as MapGapAnalysisDatasetV1;
relocationAccessDataset.descriptor.label = "Relocation routed access surface";
relocationAccessDataset.descriptor.description = "Jersey City fixture contour in the normalized V2-to-V3 access-surface shape.";
relocationAccessDataset.data = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    id: "relocation-within-30",
    properties: {
      id: "relocation-within-30",
      accessBand: "within-30",
      minutes: 30,
      mobilityMode: "walk",
      routingProvider: "fixture-valhalla",
    },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-74.096, 40.716], [-74.093, 40.712], [-74.088, 40.709], [-74.081, 40.710],
        [-74.076, 40.712], [-74.071, 40.711], [-74.066, 40.714], [-74.061, 40.717],
        [-74.058, 40.721], [-74.060, 40.725], [-74.057, 40.729], [-74.061, 40.733],
        [-74.066, 40.735], [-74.069, 40.740], [-74.075, 40.742], [-74.079, 40.738],
        [-74.084, 40.737], [-74.088, 40.734], [-74.093, 40.733], [-74.095, 40.728],
        [-74.099, 40.724], [-74.097, 40.720], [-74.096, 40.716],
      ]],
    },
  }],
};
relocationAccessDataset.provenance.caveat = "Relocation fixture only; production contours must retain the active routing graph and request parameters.";
relocationAccessDataset.checksum.value = "e27778c10b2a29b7be5bedfcaa8d6462ce98c6345c28aa1eb18d530e1741d9cc";

const relocationAccessComparison = assertAnalysisBundleV1({
  schemaVersion: ANALYSIS_BUNDLE_SCHEMA_VERSION,
  id: "mapgap-relocation-access-comparison-v1",
  label: "Jersey City relocation access comparison fixture",
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
  geography: {
    label: "Jersey City bounded alpha extent",
    coordinateReferenceSystem: "EPSG:4326",
    boundingBox: [-74.11, 40.70, -74.04, 40.75],
  },
  datasets: [relocationAccessDataset],
  joins: [],
  budget: {
    maxDatasets: 2,
    maxFeatures: 8,
    maxRecords: 0,
    maxCoordinates: 200,
    maxEncodedBytes: 120_000,
  },
});

export function getAlbanyHousingAnalysisBundleFixture(): MapGapAnalysisBundleV1 {
  return cloneAnalysisBundleV1(albanyHousingComparison);
}

export function getCivicAnalysisBundleFixture(): MapGapAnalysisBundleV1 {
  return getAlbanyHousingAnalysisBundleFixture();
}

export type ComparisonAnalysisFixtureKey =
  | "civic"
  | "civic-capacity-gap-v1"
  | "relocation"
  | "relocation-routed-access-v1";

export function getComparisonAnalysisBundleFixture(
  storyIdOrProjectId: ComparisonAnalysisFixtureKey,
): MapGapAnalysisBundleV1 {
  if (storyIdOrProjectId === "civic" || storyIdOrProjectId === "civic-capacity-gap-v1") {
    return cloneAnalysisBundleV1(albanyHousingComparison);
  }
  return cloneAnalysisBundleV1(relocationAccessComparison);
}

export function getAccessSurfaceDatasetFixture(): MapGapAnalysisDatasetV1 {
  return JSON.parse(JSON.stringify(accessSurfaceDataset)) as MapGapAnalysisDatasetV1;
}

export function getHousingAreasDatasetFixture(): MapGapAnalysisDatasetV1 {
  return JSON.parse(JSON.stringify(housingAreasDataset)) as MapGapAnalysisDatasetV1;
}
