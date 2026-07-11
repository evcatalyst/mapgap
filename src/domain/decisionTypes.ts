import type {
  LatLng,
  MobilityMode,
  RoutingProvider,
  ScenarioId,
  TransportMode,
} from "../types";

export type AnchorCategory =
  | "home"
  | "work"
  | "family"
  | "school"
  | "healthcare"
  | "transit"
  | "daily-life"
  | "civic-asset"
  | "custom";

export type AmenityCategory =
  | "coffee"
  | "restaurant"
  | "grocery"
  | "laundromat"
  | "library"
  | "school"
  | "hospital"
  | "clinic"
  | "childcare"
  | "park"
  | "transit";

export type ConstraintPriority = "required" | "preferred" | "optional";

export type ScoreBand = "excellent" | "good" | "mixed" | "poor" | "failed";

export type HouseholdProfile = {
  id: string;
  name: string;
  scenarioId: ScenarioId;
  regionLabel: string;
  anchors: AnchorLocation[];
  constraints: DecisionConstraint[];
  weights: ScoreWeights;
};

export type AnchorLocation = LatLng & {
  id: string;
  name: string;
  category: AnchorCategory;
  address?: string;
  priority: ConstraintPriority;
};

export type CandidateHome = LatLng & {
  id: string;
  label: string;
  source: "grid" | "user" | "listing" | "import";
  score?: ScoreBreakdown;
};

export type CandidateZone = CandidateHome;

export type CommuteConstraint = {
  type: "commute";
  anchorId: string;
  maxMinutes: number;
  priority: ConstraintPriority;
  transportMode: TransportMode;
  mobilityMode: MobilityMode;
};

export type AmenityRequirement = {
  type: "amenity";
  category: AmenityCategory;
  maxMinutes: number;
  minimumCount: number;
  priority: ConstraintPriority;
  transportMode: TransportMode;
  mobilityMode: MobilityMode;
};

export type SchoolConstraint = {
  type: "school";
  category: "public-district" | "private" | "program" | "custom";
  maxMinutes?: number;
  priority: ConstraintPriority;
  notes?: string;
};

export type JobConstraint = {
  type: "job";
  titleQuery: string;
  minimumSalary?: number;
  maxCommuteMinutes: number;
  priority: ConstraintPriority;
  transportMode: TransportMode;
};

export type HealthcareConstraint = {
  type: "healthcare";
  anchorId?: string;
  maxMinutes: number;
  onCall: boolean;
  priority: ConstraintPriority;
  transportMode: TransportMode;
};

export type CivicAssetConstraint = {
  type: "civic-asset";
  assetCategories: AnchorCategory[];
  maxMinutes: number;
  minimumCapacity?: number;
  priority: ConstraintPriority;
};

export type DecisionConstraint =
  | CommuteConstraint
  | AmenityRequirement
  | SchoolConstraint
  | JobConstraint
  | HealthcareConstraint
  | CivicAssetConstraint;

export type ScoreWeights = {
  commute: number;
  anchors: number;
  amenities: number;
  schools: number;
  healthcare: number;
  affordability: number;
  civicCapacity: number;
  frictionPenalty: number;
};

export type ScoreBreakdown = {
  total: number;
  band: ScoreBand;
  components: Array<{
    key: keyof ScoreWeights;
    label: string;
    value: number;
    explanation: string;
  }>;
  failedConstraints: Array<{
    constraintType: DecisionConstraint["type"];
    label: string;
    explanation: string;
  }>;
  assumptions: ScenarioAssumption[];
};

export type ScenarioAssumption = {
  id: string;
  label: string;
  value: string;
  source: "user" | "osm" | "routing-provider" | "census" | "import" | "system";
};

export type ScenarioReport = {
  id: string;
  profileId: string;
  generatedAt: string;
  routingProvider: RoutingProvider;
  candidates: CandidateHome[];
  assumptions: ScenarioAssumption[];
};

export type DecisionBrief = ScenarioReport & {
  title: string;
  summary: string;
  sources: Array<{
    label: string;
    url?: string;
    updatedAt?: string;
  }>;
  caveats: string[];
};
