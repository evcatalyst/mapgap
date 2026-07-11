import { ChevronDown, ListChecks, MapPin, Route, SlidersHorizontal, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { POINT_COLORS } from "../../constants";
import type {
  AnchorLocation,
  DecisionConstraint,
  HouseholdProfile,
  ScoreWeights,
} from "../../domain/decisionTypes";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { MapPoint, MobilityMode, TransportMode } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Slider } from "../ui/slider";

const weightControls: Array<{ key: keyof ScoreWeights; label: string }> = [
  { key: "commute", label: "Commute" },
  { key: "anchors", label: "Anchors" },
  { key: "amenities", label: "Daily life" },
  { key: "schools", label: "Schools" },
  { key: "healthcare", label: "Healthcare" },
  { key: "affordability", label: "Affordability" },
  { key: "civicCapacity", label: "Civic capacity" },
  { key: "frictionPenalty", label: "Friction" },
];

const categoryLabels: Record<AnchorLocation["category"], string> = {
  home: "Home",
  work: "Work",
  family: "Family",
  school: "School",
  healthcare: "Care",
  transit: "Transit",
  "daily-life": "Daily life",
  "civic-asset": "Asset",
  custom: "Custom",
};

const priorityVariant: Record<AnchorLocation["priority"], "danger" | "warning" | "outline"> = {
  required: "danger",
  preferred: "warning",
  optional: "outline",
};

const scenarioLabels: Record<HouseholdProfile["scenarioId"], string> = {
  "real-estate-dev": "Site reach",
  "home-seeker": "Home",
  "urban-planner": "Planning",
  "relocation-household": "Relocation",
  "dual-career": "Dual career",
  "hospital-on-call": "On-call",
  "school-fit": "School fit",
  "workforce-access": "Workforce",
  "asset-audit": "Asset audit",
  "laundromat-walkability": "Laundromats",
};

function formatConstraint(
  constraint: DecisionConstraint,
  profile: HouseholdProfile,
) {
  switch (constraint.type) {
    case "commute": {
      const anchor = profile.anchors.find((item) => item.id === constraint.anchorId);
      return `${anchor?.name || "Anchor"} max ${constraint.maxMinutes} min`;
    }
    case "amenity":
      return `${constraint.minimumCount}+ ${constraint.category} within ${constraint.maxMinutes} min`;
    case "school":
      return `${constraint.category.replace("-", " ")}${constraint.maxMinutes ? ` within ${constraint.maxMinutes} min` : ""}`;
    case "job":
      return `${constraint.titleQuery} jobs within ${constraint.maxCommuteMinutes} min`;
    case "healthcare":
      return `${constraint.onCall ? "On-call" : "Healthcare"} max ${constraint.maxMinutes} min`;
    case "civic-asset":
      return `Existing asset reach max ${constraint.maxMinutes} min`;
    default:
      return "Constraint";
  }
}

type ProfilePanelProps = {
  compact?: boolean;
};

export function ProfilePanel({ compact = false }: ProfilePanelProps) {
  const profile = useMapIsoStore((state) => state.decisionProfile);
  const settings = useMapIsoStore((state) => state.settings);
  const updateWeights = useMapIsoStore((state) => state.updateDecisionProfileWeights);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();
  const requiredCount = profile.constraints.filter((constraint) => constraint.priority === "required").length;
  const preferredCount = profile.constraints.filter((constraint) => constraint.priority === "preferred").length;
  const servicePlan = getProfileAnchorServicePlan(profile, settings.timeMinutes);

  const generateProfileAnchorServiceAreas = async () => {
    if (profile.anchors.length === 0) {
      toast.error("Add profile anchors before generating anchor service areas.");
      return;
    }

    await generateIsochrones({
      points: profile.anchors.map(anchorToPoint),
      settings: {
        ...settings,
        transportMode: servicePlan.transportMode,
        mobilityMode: servicePlan.mobilityMode,
        timeMinutes: servicePlan.maxMinutes,
        timeBuckets: makeServiceBuckets(servicePlan.maxMinutes),
        isochroneMode: "overlap",
      },
    });
  };

  if (compact) {
    return (
      <Card aria-labelledby="profile-panel-title" className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <CardTitle id="profile-panel-title">Profile</CardTitle>
            </div>
            <Badge variant="outline" className="shrink-0">
              {scenarioLabels[profile.scenarioId]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
              {profile.name}
            </p>
            <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {profile.regionLabel}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Badge variant="outline" className="min-w-0 justify-center">
              {profile.anchors.length} anchors
            </Badge>
            <Badge variant="danger" className="min-w-0 justify-center">
              {requiredCount} req
            </Badge>
            <Badge variant="warning" className="min-w-0 justify-center">
              {preferredCount} pref
            </Badge>
          </div>

          <details className="group rounded-md border border-neutral-200 dark:border-neutral-800">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              <span>View anchors and weights</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-neutral-500 transition group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-4 border-t border-neutral-200 p-3 dark:border-neutral-800">
              <ProfileDetails
                profile={profile}
                updateWeights={updateWeights}
                servicePlan={servicePlan}
                onGenerateServiceAreas={generateProfileAnchorServiceAreas}
                isGenerating={isGeneratingIsochrones}
              />
            </div>
          </details>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="profile-panel-title">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          <CardTitle id="profile-panel-title">Profile</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
                {profile.name}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {profile.regionLabel}
              </p>
            </div>
            <Badge variant="outline" className="max-w-[9rem] shrink-0 truncate">
              {profile.scenarioId}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Badge variant="outline" className="justify-center">
              {profile.anchors.length} anchors
            </Badge>
            <Badge variant="danger" className="justify-center">
              {requiredCount} req
            </Badge>
            <Badge variant="warning" className="justify-center">
              {preferredCount} pref
            </Badge>
          </div>
        </div>

        <ProfileDetails
          profile={profile}
          updateWeights={updateWeights}
          servicePlan={servicePlan}
          onGenerateServiceAreas={generateProfileAnchorServiceAreas}
          isGenerating={isGeneratingIsochrones}
        />
      </CardContent>
    </Card>
  );
}

function ProfileDetails({
  profile,
  updateWeights,
  servicePlan,
  onGenerateServiceAreas,
  isGenerating,
}: {
  profile: HouseholdProfile;
  updateWeights: (updates: Partial<ScoreWeights>) => void;
  servicePlan: ProfileAnchorServicePlan;
  onGenerateServiceAreas: () => void;
  isGenerating: boolean;
}) {
  return (
    <>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          Anchors
        </p>
        <div className="space-y-2">
          {profile.anchors.slice(0, 4).map((anchor) => (
            <div
              key={anchor.id}
              className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
                  {anchor.name}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {categoryLabels[anchor.category]}
                </p>
              </div>
              <Badge variant={priorityVariant[anchor.priority]} className="shrink-0">
                {anchor.priority}
              </Badge>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2 w-full"
          onClick={onGenerateServiceAreas}
          disabled={profile.anchors.length === 0 || isGenerating}
        >
          <Route className="h-4 w-4" aria-hidden="true" />
          Generate profile anchor service areas
        </Button>
        <p className="mt-1 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
          Uses {servicePlan.label} up to {servicePlan.maxMinutes} min for route-backed candidate evidence.
        </p>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
          Constraints
        </p>
        <div className="space-y-2">
          {profile.constraints.slice(0, 4).map((constraint, index) => (
            <div
              key={`${constraint.type}-${index}`}
              className="rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-neutral-800 dark:text-neutral-100">
                  {formatConstraint(constraint, profile)}
                </span>
                <Badge variant={priorityVariant[constraint.priority]} className="shrink-0">
                  {constraint.priority}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Score weights
        </p>
        <div className="space-y-3">
          {weightControls.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-600 dark:text-neutral-300">
                  {label}
                </span>
                <span className="font-mono text-neutral-500 dark:text-neutral-400">
                  {profile.weights[key]}
                </span>
              </span>
              <Slider
                min={0}
                max={50}
                step={1}
                value={profile.weights[key]}
                onChange={(event) => updateWeights({ [key]: Number(event.currentTarget.value) })}
                aria-label={`${label} score weight`}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

type ProfileAnchorServicePlan = {
  maxMinutes: number;
  transportMode: TransportMode;
  mobilityMode: MobilityMode;
  label: string;
};

function getProfileAnchorServicePlan(
  profile: HouseholdProfile,
  fallbackMinutes: number,
): ProfileAnchorServicePlan {
  const routeConstraints = profile.constraints.filter(
    (constraint) =>
      constraint.type === "commute" ||
      constraint.type === "healthcare" ||
      constraint.type === "civic-asset" ||
      constraint.type === "school",
  );
  const minutes = routeConstraints
    .map((constraint) => {
      if (constraint.type === "commute") {
        return constraint.maxMinutes;
      }

      if (constraint.type === "healthcare") {
        return constraint.maxMinutes;
      }

      if (constraint.type === "civic-asset") {
        return constraint.maxMinutes;
      }

      return constraint.maxMinutes;
    })
    .filter((value): value is number => Number.isFinite(value));
  const transportModes = routeConstraints.flatMap((constraint) => {
    if (constraint.type === "commute" || constraint.type === "healthcare") {
      return [constraint.transportMode];
    }

    return [];
  });
  const transportMode = transportModes.includes("driving-car")
    ? "driving-car"
    : transportModes.includes("cycling-regular")
      ? "cycling-regular"
      : "foot-walking";
  const mobilityMode: MobilityMode = transportMode === "cycling-regular" ? "bike" : "walk";

  return {
    maxMinutes: Math.max(5, Math.min(60, Math.max(...minutes, fallbackMinutes || 30))),
    transportMode,
    mobilityMode,
    label:
      transportMode === "driving-car"
        ? "driving"
        : transportMode === "cycling-regular"
          ? "cycling"
          : "walking",
  };
}

function anchorToPoint(anchor: AnchorLocation, index: number): MapPoint {
  return {
    id: anchor.id,
    name: anchor.name,
    address: anchor.address,
    lat: anchor.lat,
    lng: anchor.lng,
    color: POINT_COLORS[index % POINT_COLORS.length],
    createdAt: new Date().toISOString(),
  };
}

function makeServiceBuckets(maxMinutes: number) {
  const roundedMax = Math.max(5, Math.min(60, Math.ceil(maxMinutes / 5) * 5));
  const buckets: number[] = [];

  for (let minutes = 5; minutes <= Math.min(roundedMax, 30); minutes += 5) {
    buckets.push(minutes);
  }

  if (roundedMax > 30 && !buckets.includes(roundedMax)) {
    buckets.push(roundedMax);
  }

  return buckets;
}
