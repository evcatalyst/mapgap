import type {
  CandidateHome,
  DecisionConstraint,
  HouseholdProfile,
  ScoreBreakdown,
} from "../domain/decisionTypes";
import { ROUTING_PROVIDER_LABELS, TRANSPORT_LABELS } from "../constants";
import type {
  AppSettings,
  IsochroneCollection,
  MapPoint,
  PoiLayer,
} from "../types";

type DecisionMemoInput = {
  profile: HouseholdProfile;
  candidates: CandidateHome[];
  poiLayers: PoiLayer[];
  points: MapPoint[];
  isochrones: IsochroneCollection;
  settings: AppSettings;
  generatedAt?: Date;
};

export function buildDecisionMemoMarkdown({
  profile,
  candidates,
  poiLayers,
  points,
  isochrones,
  settings,
  generatedAt = new Date(),
}: DecisionMemoInput) {
  const visiblePoiLayers = poiLayers.filter((layer) => layer.visible);
  const importedAssets = points.filter(hasAssetMetadata);
  const importedCapacity = importedAssets.reduce((sum, point) => sum + (point.capacity || 0), 0);
  const importedAnnualCost = importedAssets.reduce((sum, point) => sum + (point.annualCost || 0), 0);
  const utilizationRecords = importedAssets.filter((point) => point.utilization).length;
  const fundingSources = new Set(importedAssets.map((point) => point.fundingSource).filter(Boolean));
  const topCandidates = candidates.slice(0, 5);
  const sourceLabels = Array.from(new Set(visiblePoiLayers.map((layer) => layer.source))).sort();
  const hasRoutedCandidateEvidence = candidates.some((candidate) =>
    candidate.score?.assumptions.some(
      (assumption) => assumption.source === "routing-provider",
    ),
  );

  return [
    "# MapGap Decision Memo",
    "",
    `Generated: ${generatedAt.toLocaleString()}`,
    `Profile: ${profile.name}`,
    `Region: ${profile.regionLabel}`,
    `Scenario: ${profile.scenarioId}`,
    "",
    "## Executive Summary",
    "",
    topCandidates.length > 0
      ? `MapGap scored ${candidates.length} candidate zone${
          candidates.length === 1 ? "" : "s"
        } using the active profile, anchors, visible POI layers, and current map assumptions. The top candidate is ${
          topCandidates[0]?.label
        } with a score of ${topCandidates[0]?.score?.total ?? 0}/100.`
      : "No candidate zones have been generated yet. Generate candidate zones before using this memo as a shortlist.",
    "",
    "## Profile Inputs",
    "",
    `- Anchors: ${profile.anchors.length}`,
    `- Constraints: ${profile.constraints.length}`,
    `- Editable map locations: ${points.length}`,
    `- Imported civic assets: ${importedAssets.length}`,
    `- Imported asset capacity: ${importedCapacity || "not provided"}`,
    `- Imported annual operating cost: ${
      importedAnnualCost ? formatCurrency(importedAnnualCost) : "not provided"
    }`,
    `- Utilization records: ${utilizationRecords || "not provided"}`,
    `- Funding sources: ${fundingSources.size || "not provided"}`,
    `- Visible POI layers: ${visiblePoiLayers.length}`,
    `- Isochrone rings: ${isochrones.length}`,
    `- Travel mode: ${TRANSPORT_LABELS[settings.transportMode]}`,
    `- Routing provider: ${ROUTING_PROVIDER_LABELS[settings.routingProvider]}`,
    "",
    "## Anchors",
    "",
    ...listOrFallback(
      profile.anchors.map(
        (anchor) =>
          `- ${anchor.name} (${anchor.category}, ${anchor.priority}) at ${formatCoordinate(
            anchor.lat,
            anchor.lng,
          )}`,
      ),
      "- No anchors are defined.",
    ),
    "",
    "## Constraints",
    "",
    ...listOrFallback(
      profile.constraints.map((constraint) => `- ${formatConstraint(constraint, profile)}`),
      "- No constraints are defined.",
    ),
    "",
    "## Candidate Shortlist",
    "",
    ...candidateSection(topCandidates),
    "",
    "## Imported Asset Inventory",
    "",
    ...assetInventorySection(importedAssets),
    "",
    "## POI Evidence",
    "",
    ...listOrFallback(
      visiblePoiLayers.map(
        (layer) =>
          `- ${layer.label}: ${layer.points.length} place${
            layer.points.length === 1 ? "" : "s"
          } from ${layer.source}${layer.truncated ? " (truncated)" : ""}`,
      ),
      "- No visible POI layers are active.",
    ),
    "",
    "## Sources And Caveats",
    "",
    `- Routing: ${ROUTING_PROVIDER_LABELS[settings.routingProvider]}`,
    `- POIs: ${sourceLabels.length > 0 ? sourceLabels.join(", ") : "none in this memo"}`,
    `- Imported assets: ${importedAssets.length > 0 ? "user CSV or manual map entries" : "none in this memo"}`,
    "- Candidate scoring uses a viewport grid and transparent component weights, not parcel or listing inventory.",
    hasRoutedCandidateEvidence
      ? "- Candidate scoring includes generated routed profile-anchor or imported-asset contours where available; dimensions without generated contours still use proxy distances."
      : "- Candidate scoring currently uses straight-line distance proxies for anchors, amenities, healthcare, commute, and civic asset reach.",
    "- Heatmaps and isochrones remain the source of truth for routed access claims.",
    "- School quality, affordability, demographic overlays, asset utilization, and grant sufficiency are not yet authoritative in this memo.",
    "- Use this as a decision-support artifact, not as legal, medical, real estate, financial, or grant-compliance advice.",
    "",
  ].join("\n");
}

function assetInventorySection(assets: MapPoint[]) {
  if (assets.length === 0) {
    return ["No imported civic assets with audit metadata are active."];
  }

  return assets.slice(0, 12).map((asset) => {
    const details = [
      asset.assetType || "asset",
      asset.capacity !== undefined ? `capacity ${asset.capacity}` : undefined,
      asset.hoursOpen ? `hours ${asset.hoursOpen}` : undefined,
      asset.utilization ? `utilization ${asset.utilization}` : undefined,
      asset.staffing ? `staffing ${asset.staffing}` : undefined,
      asset.annualCost !== undefined ? `annual cost ${formatCurrency(asset.annualCost)}` : undefined,
      asset.fundingSource ? `funding ${asset.fundingSource}` : undefined,
      asset.address,
    ]
      .filter(Boolean)
      .join(", ");

    return `- ${asset.name}${details ? ` (${details})` : ""} at ${formatCoordinate(
      asset.lat,
      asset.lng,
    )}`;
  });
}

function candidateSection(candidates: CandidateHome[]) {
  if (candidates.length === 0) {
    return ["No candidate zones generated."];
  }

  return candidates.flatMap((candidate, index) => [
    `### ${index + 1}. ${candidate.label}`,
    "",
    `- Score: ${candidate.score?.total ?? 0}/100 (${candidate.score?.band || "unscored"})`,
    `- Location: ${formatCoordinate(candidate.lat, candidate.lng)}`,
    ...scoreComponentLines(candidate.score),
    ...failedConstraintLines(candidate.score),
    ...assumptionLines(candidate.score),
    "",
  ]);
}

function scoreComponentLines(score?: ScoreBreakdown) {
  if (!score) {
    return ["- No score components available."];
  }

  return score.components
    .filter((component) => component.value > 0)
    .slice(0, 5)
    .map((component) => `- ${component.label}: ${component.value}/100 - ${component.explanation}`);
}

function failedConstraintLines(score?: ScoreBreakdown) {
  if (!score?.failedConstraints.length) {
    return ["- Required constraints flagged: none"];
  }

  return [
    `- Required constraints flagged: ${score.failedConstraints.length}`,
    ...score.failedConstraints.map((item) => `  - ${item.label}: ${item.explanation}`),
  ];
}

function assumptionLines(score?: ScoreBreakdown) {
  if (!score?.assumptions.length) {
    return ["- Evidence assumptions: none recorded"];
  }

  return [
    "- Evidence assumptions:",
    ...score.assumptions
      .slice(0, 6)
      .map((assumption) => `  - ${assumption.label} (${assumption.source}): ${assumption.value}`),
  ];
}

function listOrFallback(items: string[], fallback: string) {
  return items.length > 0 ? items : [fallback];
}

function formatConstraint(constraint: DecisionConstraint, profile: HouseholdProfile) {
  switch (constraint.type) {
    case "commute": {
      const anchor = profile.anchors.find((item) => item.id === constraint.anchorId);
      return `${anchor?.name || "Commute anchor"} within ${constraint.maxMinutes} min by ${
        TRANSPORT_LABELS[constraint.transportMode]
      } (${constraint.priority})`;
    }
    case "amenity":
      return `${constraint.minimumCount} ${constraint.category} within ${constraint.maxMinutes} min (${constraint.priority})`;
    case "school":
      return `${constraint.category} school fit${
        constraint.maxMinutes ? ` within ${constraint.maxMinutes} min` : ""
      } (${constraint.priority})`;
    case "job":
      return `${constraint.titleQuery} jobs within ${constraint.maxCommuteMinutes} min${
        constraint.minimumSalary ? `, minimum salary ${constraint.minimumSalary}` : ""
      } (${constraint.priority})`;
    case "healthcare":
      return `${constraint.onCall ? "On-call " : ""}healthcare within ${
        constraint.maxMinutes
      } min (${constraint.priority})`;
    case "civic-asset":
      return `Existing civic asset reach within ${constraint.maxMinutes} min${
        constraint.minimumCapacity ? `, capacity ${constraint.minimumCapacity}+` : ""
      } (${constraint.priority})`;
    default:
      return "Unknown constraint";
  }
}

function formatCoordinate(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function hasAssetMetadata(point: MapPoint) {
  return Boolean(
    point.assetType ||
      point.capacity !== undefined ||
      point.hoursOpen ||
      point.utilization ||
      point.staffing ||
      point.annualCost !== undefined ||
      point.fundingSource,
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
