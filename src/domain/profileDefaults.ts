import { DEFAULT_CENTER } from "../constants";
import type { ScenarioId } from "../types";
import type {
  AmenityRequirement,
  AnchorLocation,
  CivicAssetConstraint,
  CommuteConstraint,
  DecisionConstraint,
  HealthcareConstraint,
  HouseholdProfile,
  JobConstraint,
  SchoolConstraint,
  ScoreWeights,
} from "./decisionTypes";

const DEFAULT_WEIGHTS: ScoreWeights = {
  commute: 28,
  anchors: 18,
  amenities: 18,
  schools: 10,
  healthcare: 10,
  affordability: 8,
  civicCapacity: 0,
  frictionPenalty: 8,
};

const CIVIC_WEIGHTS: ScoreWeights = {
  commute: 8,
  anchors: 12,
  amenities: 12,
  schools: 0,
  healthcare: 8,
  affordability: 0,
  civicCapacity: 44,
  frictionPenalty: 16,
};

function anchor(
  id: string,
  name: string,
  category: AnchorLocation["category"],
  lat: number,
  lng: number,
  priority: AnchorLocation["priority"] = "preferred",
  address?: string,
): AnchorLocation {
  return { id, name, category, lat, lng, priority, address };
}

function commute(
  anchorId: string,
  maxMinutes: number,
  priority: CommuteConstraint["priority"] = "required",
  transportMode: CommuteConstraint["transportMode"] = "driving-car",
): CommuteConstraint {
  return {
    type: "commute",
    anchorId,
    maxMinutes,
    priority,
    transportMode,
    mobilityMode: transportMode === "cycling-regular" ? "bike" : "walk",
  };
}

function amenity(
  category: AmenityRequirement["category"],
  maxMinutes: number,
  minimumCount: number,
  priority: AmenityRequirement["priority"] = "preferred",
): AmenityRequirement {
  return {
    type: "amenity",
    category,
    maxMinutes,
    minimumCount,
    priority,
    transportMode: "foot-walking",
    mobilityMode: "walk",
  };
}

function school(
  category: SchoolConstraint["category"],
  priority: SchoolConstraint["priority"] = "preferred",
  maxMinutes?: number,
  notes?: string,
): SchoolConstraint {
  return { type: "school", category, priority, maxMinutes, notes };
}

function healthcare(
  maxMinutes: number,
  priority: HealthcareConstraint["priority"] = "preferred",
  anchorId?: string,
  onCall = false,
): HealthcareConstraint {
  return {
    type: "healthcare",
    anchorId,
    maxMinutes,
    onCall,
    priority,
    transportMode: "driving-car",
  };
}

function job(
  titleQuery: string,
  maxCommuteMinutes: number,
  priority: JobConstraint["priority"] = "preferred",
  minimumSalary?: number,
): JobConstraint {
  return {
    type: "job",
    titleQuery,
    minimumSalary,
    maxCommuteMinutes,
    priority,
    transportMode: "driving-car",
  };
}

function civicAsset(
  maxMinutes: number,
  priority: CivicAssetConstraint["priority"] = "required",
  minimumCapacity?: number,
): CivicAssetConstraint {
  return {
    type: "civic-asset",
    assetCategories: ["civic-asset"],
    maxMinutes,
    minimumCapacity,
    priority,
  };
}

function profile(
  scenarioId: ScenarioId,
  name: string,
  regionLabel: string,
  anchors: AnchorLocation[],
  constraints: DecisionConstraint[],
  weights: ScoreWeights,
): HouseholdProfile {
  return {
    id: `${scenarioId}-profile`,
    name,
    scenarioId,
    regionLabel,
    anchors,
    constraints,
    weights,
  };
}

export function makeScenarioProfile(scenarioId: ScenarioId): HouseholdProfile {
  switch (scenarioId) {
    case "dual-career":
      return profile(
        scenarioId,
        "Dual-career household",
        "Capital Region, NY",
        [
          anchor("work-a", "Albany job anchor", "work", 42.6526, -73.7562, "required"),
          anchor("work-b", "Schenectady job anchor", "work", 42.8142, -73.9396, "required"),
          anchor("family", "Family anchor", "family", DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
        ],
        [
          commute("work-a", 30),
          commute("work-b", 30),
          job("professional services", 30, "preferred"),
          amenity("coffee", 10, 1),
        ],
        { ...DEFAULT_WEIGHTS, commute: 38, anchors: 20, amenities: 12 },
      );
    case "hospital-on-call":
      return profile(
        scenarioId,
        "Hospital on-call household",
        "Capital Region, NY",
        [
          anchor("hospital", "Albany Medical Center", "healthcare", 42.6539, -73.7767, "required"),
          anchor("family", "Family anchor", "family", DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
        ],
        [
          healthcare(20, "required", "hospital", true),
          amenity("restaurant", 15, 2),
          amenity("coffee", 8, 1),
        ],
        { ...DEFAULT_WEIGHTS, healthcare: 30, commute: 22, amenities: 14 },
      );
    case "school-fit":
      return profile(
        scenarioId,
        "School-first household",
        "Capital Region, NY",
        [
          anchor("school", "Preferred school area", "school", 42.7798, -73.8457, "required"),
          anchor("work", "Work anchor", "work", 42.6526, -73.7562),
        ],
        [
          school("public-district", "required"),
          school("private", "preferred", 20),
          commute("work", 30),
          job("education or healthcare", 30, "optional"),
        ],
        { ...DEFAULT_WEIGHTS, schools: 30, commute: 22, amenities: 12 },
      );
    case "workforce-access":
      return profile(
        scenarioId,
        "Workforce access audit",
        "Capital Region, NY",
        [
          anchor("training", "Training site", "civic-asset", 42.6517, -73.7551, "required"),
          anchor("jobs", "Employment center", "work", 42.8142, -73.9396),
          anchor("library", "Library/computer lab", "civic-asset", 42.6522, -73.7659),
        ],
        [
          civicAsset(20, "required", 25),
          commute("jobs", 30, "preferred", "foot-walking"),
          job("training-aligned openings", 30, "preferred"),
        ],
        CIVIC_WEIGHTS,
      );
    case "asset-audit":
      return profile(
        scenarioId,
        "Existing asset audit",
        "Albany, NY",
        [
          anchor("library", "Existing library", "civic-asset", 42.6519, -73.7556, "required"),
          anchor("training", "Training computer lab", "civic-asset", 42.6428, -73.7557, "required"),
          anchor("proposed", "Proposed service area", "custom", 42.6681, -73.7536),
        ],
        [civicAsset(15, "required", 20), amenity("transit", 10, 1, "preferred")],
        CIVIC_WEIGHTS,
      );
    case "laundromat-walkability":
      return profile(
        scenarioId,
        "Laundromat walkability test",
        "Jersey City, NJ",
        [
          anchor("neighborhood", "Neighborhood focus", "home", 40.7282, -74.0776, "required"),
        ],
        [amenity("laundromat", 10, 1, "required")],
        { ...CIVIC_WEIGHTS, amenities: 44, civicCapacity: 22, frictionPenalty: 18 },
      );
    case "real-estate-dev":
      return profile(
        scenarioId,
        "Site reach comparison",
        "Capital Region, NY",
        [
          anchor("parcel", "Candidate parcel", "custom", DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, "required"),
          anchor("labor", "Labor shed anchor", "work", 42.6526, -73.7562),
        ],
        [commute("labor", 30, "preferred", "driving-car"), amenity("transit", 15, 1)],
        { ...DEFAULT_WEIGHTS, commute: 30, anchors: 22, civicCapacity: 8 },
      );
    case "home-seeker":
      return profile(
        scenarioId,
        "Home seeker profile",
        "Capital Region, NY",
        [
          anchor("home", "Candidate home area", "home", DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, "required"),
          anchor("work", "Work anchor", "work", 42.6526, -73.7562),
        ],
        [
          commute("work", 30),
          job("target occupation", 30, "preferred"),
          amenity("coffee", 10, 1),
          amenity("restaurant", 15, 2),
        ],
        DEFAULT_WEIGHTS,
      );
    case "urban-planner":
      return profile(
        scenarioId,
        "Coverage and equity gap audit",
        "Capital Region, NY",
        [
          anchor("service", "Public service anchor", "civic-asset", DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, "required"),
          anchor("transit", "Transit connection", "transit", 42.6526, -73.7562),
        ],
        [civicAsset(20), amenity("library", 20, 1), amenity("transit", 10, 1)],
        CIVIC_WEIGHTS,
      );
    case "relocation-household":
    default:
      return profile(
        "relocation-household",
        "Capital Region relocation",
        "Capital Region, NY",
        [
          anchor("work", "Prospective job anchor", "work", 42.6526, -73.7562, "required"),
          anchor("family", "Family anchor", "family", DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          anchor("hospital", "Hospital access", "healthcare", 42.6539, -73.7767),
          anchor("school", "School preference", "school", 42.7798, -73.8457),
        ],
        [
          commute("work", 30),
          job("professional role", 30, "preferred"),
          amenity("coffee", 8, 1),
          amenity("restaurant", 15, 2),
          healthcare(25, "preferred", "hospital"),
          school("public-district", "preferred"),
        ],
        DEFAULT_WEIGHTS,
      );
  }
}
