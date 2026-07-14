import { expect, test } from "@playwright/test";
import { scoreCandidateHomes } from "../src/domain/candidateScoring";
import { makeScenarioProfile } from "../src/domain/profileDefaults";
import { buildDecisionMemoMarkdown } from "../src/lib/report";
import { useMapIsoStore } from "../src/store/useMapIsoStore";

test("listing candidates use the selected budget and expose over-budget failure", () => {
  const profile = makeScenarioProfile("relocation-household");
  const candidates = scoreCandidateHomes({
    candidates: [
      {
        id: "listing-over-budget",
        label: "Imported rental",
        source: "listing",
        lat: 42.67,
        lng: -73.78,
        price: 3_000,
        tenure: "rent",
        listingSource: "craigslist",
        listingSourceLabel: "Imported Craigslist",
        listingAccess: "user-provided",
      },
    ],
    profile,
    poiLayers: [],
    maxHousingPrice: 2_000,
  });

  const affordability = candidates[0].score?.components.find(
    (component) => component.key === "affordability",
  );

  expect(affordability?.value).toBe(0);
  expect(affordability?.explanation).toContain("50% above");
  expect(candidates[0].score?.failedConstraints).toContainEqual(
    expect.objectContaining({
      constraintType: "affordability",
      label: "Housing budget",
    }),
  );
  expect(candidates[0].score?.assumptions[0]).toMatchObject({
    source: "import",
    label: "Housing candidate",
  });
});

test("listing candidates within budget receive positive affordability evidence", () => {
  const profile = makeScenarioProfile("hospital-on-call");
  const candidates = scoreCandidateHomes({
    candidates: [
      {
        id: "listing-in-budget",
        label: "Live rental",
        source: "listing",
        lat: 42.65,
        lng: -73.77,
        price: 1_600,
        tenure: "rent",
        listingSource: "rentcast",
        listingSourceLabel: "RentCast",
        listingAccess: "live-api",
      },
    ],
    profile,
    poiLayers: [],
    maxHousingPrice: 2_000,
  });
  const affordability = candidates[0].score?.components.find(
    (component) => component.key === "affordability",
  );

  expect(affordability?.value).toBe(100);
  expect(affordability?.explanation).toContain("within the selected");
  expect(
    candidates[0].score?.failedConstraints.some(
      (failure) => failure.constraintType === "affordability",
    ),
  ).toBe(false);
  expect(candidates[0].score?.assumptions[0].source).toBe("listing-provider");
});

test("housing decision memo preserves listing provenance and illustrative caveats", () => {
  const profile = makeScenarioProfile("relocation-household");
  const candidates = scoreCandidateHomes({
    candidates: [
      {
        id: "listing-example",
        label: "Illustrative rental",
        source: "listing",
        lat: 42.65,
        lng: -73.77,
        address: "Example location in the current map view",
        price: 1_650,
        tenure: "rent",
        listingSource: "illustrative",
        listingSourceLabel: "Illustrative example",
        listingAccess: "illustrative",
      },
    ],
    profile,
    poiLayers: [],
    maxHousingPrice: 2_000,
  });
  const memo = buildDecisionMemoMarkdown({
    profile,
    candidates,
    poiLayers: [],
    points: [],
    isochrones: [],
    settings: useMapIsoStore.getState().settings,
    generatedAt: new Date("2026-07-14T12:00:00Z"),
  });

  expect(memo).toContain("MapGap scored 1 saved home");
  expect(memo).toContain("Housing price: $1,650 per month");
  expect(memo).toContain("Listing source: Illustrative example (illustrative)");
  expect(memo).toContain("not real or available properties");
});
