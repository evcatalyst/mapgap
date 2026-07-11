import type {
  AmenityRequirement,
  CandidateHome,
  DecisionConstraint,
  HouseholdProfile,
  ScoreBand,
  ScoreBreakdown,
  ScoreWeights,
} from "./decisionTypes";
import type {
  LatLng,
  IsochroneFeature,
  MapPoint,
  MobilityMode,
  PoiCategory,
  PoiLayer,
  PointOfInterest,
  TransportMode,
} from "../types";

type CandidateScoringInput = {
  bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
  profile: HouseholdProfile;
  poiLayers: PoiLayer[];
  points?: MapPoint[];
  isochrones?: IsochroneFeature[];
  limit?: number;
};

const AMENITY_TO_POI: Record<AmenityRequirement["category"], PoiCategory[]> = {
  coffee: ["coffee"],
  restaurant: ["restaurant"],
  grocery: ["grocery", "fresh-produce", "farmers-market", "butcher"],
  laundromat: ["laundry"],
  library: ["library"],
  school: ["school"],
  hospital: ["hospital"],
  clinic: ["hospital"],
  childcare: ["school"],
  park: ["park"],
  transit: ["transit"],
};

const COMPONENT_LABELS: Record<keyof ScoreWeights, string> = {
  commute: "Commute fit",
  anchors: "Anchor fit",
  amenities: "Daily-life fit",
  schools: "School fit",
  healthcare: "Healthcare fit",
  affordability: "Affordability proxy",
  civicCapacity: "Civic capacity",
  frictionPenalty: "Friction penalty",
};

export function generateCandidateHomes({
  bounds,
  profile,
  poiLayers,
  points = [],
  isochrones = [],
  limit = 12,
}: CandidateScoringInput): CandidateHome[] {
  const visiblePois = poiLayers.flatMap((layer) => (layer.visible ? layer.points : []));
  const civicAssets = points.filter(hasAssetMetadata);
  const candidates = makeViewportGrid(bounds).map((location, index) => {
    const routeEvidence = getRouteEvidence(location, isochrones, civicAssets, profile);
    const score = scoreCandidate(location, profile, visiblePois, civicAssets, routeEvidence);

    return {
      id: `candidate-${index + 1}-${location.lat.toFixed(5)}-${location.lng.toFixed(5)}`,
      label: `Candidate ${index + 1}`,
      source: "grid" as const,
      lat: location.lat,
      lng: location.lng,
      score,
    };
  });

  return candidates
    .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0))
    .slice(0, limit)
    .map((candidate, index) => ({
      ...candidate,
      label: `Candidate ${index + 1}`,
    }));
}

function makeViewportGrid(bounds: CandidateScoringInput["bounds"]) {
  const rows = 4;
  const columns = 4;
  const south = Math.min(bounds.south, bounds.north);
  const north = Math.max(bounds.south, bounds.north);
  const west = Math.min(bounds.west, bounds.east);
  const east = Math.max(bounds.west, bounds.east);
  const latSpan = north - south;
  const lngSpan = east - west;
  const points: LatLng[] = [];

  if (latSpan <= 0 || lngSpan <= 0) {
    return points;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      points.push({
        lat: south + latSpan * ((row + 0.5) / rows),
        lng: west + lngSpan * ((column + 0.5) / columns),
      });
    }
  }

  return points;
}

function scoreCandidate(
  candidate: LatLng,
  profile: HouseholdProfile,
  pois: PointOfInterest[],
  civicAssets: MapPoint[],
  routeEvidence: RouteEvidence,
): ScoreBreakdown {
  const componentScores: Record<keyof ScoreWeights, { score: number; explanation: string }> = {
    commute: scoreCommute(candidate, profile, routeEvidence),
    anchors: scoreAnchors(candidate, profile, routeEvidence),
    amenities: scoreAmenities(candidate, profile, pois),
    schools: scoreSchools(candidate, profile),
    healthcare: scoreHealthcare(candidate, profile, routeEvidence),
    affordability: {
      score: 50,
      explanation: "Affordability is a placeholder until parcel, listing, or rent data is connected.",
    },
    civicCapacity: scoreCivicCapacity(candidate, profile, civicAssets, routeEvidence),
    frictionPenalty: scoreFrictionPenalty(candidate, profile, pois),
  };

  let weightedTotal = 0;
  let activeWeight = 0;

  const components = (Object.keys(componentScores) as Array<keyof ScoreWeights>).map((key) => {
    const weight = profile.weights[key];
    const item = componentScores[key];

    if (key === "frictionPenalty") {
      weightedTotal -= item.score * weight;
      activeWeight += weight;
    } else if (weight > 0) {
      weightedTotal += item.score * weight;
      activeWeight += weight;
    }

    return {
      key,
      label: COMPONENT_LABELS[key],
      value: Math.round(item.score),
      explanation: item.explanation,
    };
  });

  const total = clamp(Math.round(weightedTotal / Math.max(1, activeWeight)), 0, 100);

  return {
    total,
    band: scoreBand(total),
    components,
    failedConstraints: findFailedConstraints(candidate, profile, pois, civicAssets, routeEvidence),
    assumptions: [
      {
        id: "candidate-grid",
        label: "Candidate grid",
        value: "Generated from the current viewport using a 4 x 4 grid.",
        source: "system",
      },
      {
        id: "straight-line-proxy",
        label: "Distance proxy",
        value:
          routeEvidence.anchors.contourCount > 0 || routeEvidence.assets.contourCount > 0
            ? "Generated route contours are used where available; remaining dimensions use distance proxies."
            : "Scores use straight-line distance until route-backed candidate scoring is available for this run.",
        source: "system",
      },
      {
        id: "routed-profile-contours",
        label: "Routed profile contours",
        value:
          routeEvidence.anchors.contourCount > 0
            ? `${routeEvidence.anchors.matchingContourCount} of ${routeEvidence.anchors.contourCount} generated profile anchor contour${
                routeEvidence.anchors.contourCount === 1 ? "" : "s"
              } contain this candidate.`
            : "No generated profile-anchor contours were available for this candidate run.",
        source: routeEvidence.anchors.contourCount > 0 ? "routing-provider" : "system",
      },
      {
        id: "visible-poi-layers",
        label: "POI evidence",
        value: `${pois.length} visible POI${pois.length === 1 ? "" : "s"} considered.`,
        source: pois.length > 0 ? "osm" : "system",
      },
      {
        id: "imported-assets",
        label: "Imported civic assets",
        value: `${civicAssets.length} imported asset${civicAssets.length === 1 ? "" : "s"} considered.`,
        source: civicAssets.length > 0 ? "import" : "system",
      },
      {
        id: "routed-asset-contours",
        label: "Routed asset contours",
        value:
          routeEvidence.assets.contourCount > 0
            ? `${routeEvidence.assets.matchingContourCount} of ${routeEvidence.assets.contourCount} generated asset contour${
                routeEvidence.assets.contourCount === 1 ? "" : "s"
              } contain this candidate.`
            : "No generated imported-asset contours were available for this candidate run.",
        source: routeEvidence.assets.contourCount > 0 ? "routing-provider" : "system",
      },
    ],
  };
}

function scoreCommute(candidate: LatLng, profile: HouseholdProfile, routeEvidence: RouteEvidence) {
  const constraints = profile.constraints.filter((constraint) => constraint.type === "commute");

  if (constraints.length === 0) {
    return {
      score: 60,
      explanation: "No commute constraint is active, so this uses a neutral score.",
    };
  }

  const scores = constraints.map((constraint) => {
    const anchor = profile.anchors.find((item) => item.id === constraint.anchorId);

    if (!anchor) {
      return 50;
    }

    const minutes = estimateTravelMinutes(
      distanceMeters(candidate, anchor),
      constraint.transportMode,
      constraint.mobilityMode,
    );

    return scoreThreshold(minutes, constraint.maxMinutes);
  });
  const routeScore = contourScore(routeEvidence.commute);
  const blendedScores = routeScore === undefined ? scores : [...scores, routeScore];

  return {
    score: average(blendedScores),
    explanation: `${constraints.length} commute constraint${
      constraints.length === 1 ? "" : "s"
    } scored with estimated travel time${
      routeScore !== undefined ? " and generated profile-anchor contours" : ""
    }.`,
  };
}

function scoreAnchors(candidate: LatLng, profile: HouseholdProfile, routeEvidence: RouteEvidence) {
  if (profile.anchors.length === 0) {
    return {
      score: 50,
      explanation: "No anchors are defined for this profile.",
    };
  }

  const proxyScores = profile.anchors.map((anchor) => {
    const km = distanceMeters(candidate, anchor) / 1000;
    const preferredKm = anchor.priority === "required" ? 8 : 14;
    return scoreThreshold(km, preferredKm);
  });
  const routeScore = contourScore(routeEvidence.anchors);
  const scores = routeScore === undefined ? proxyScores : [...proxyScores, routeScore];

  return {
    score: average(scores),
    explanation: `${profile.anchors.length} household or civic anchor${
      profile.anchors.length === 1 ? "" : "s"
    } scored by distance${routeScore !== undefined ? " and generated route contours" : ""}.`,
  };
}

function scoreAmenities(candidate: LatLng, profile: HouseholdProfile, pois: PointOfInterest[]) {
  const constraints = profile.constraints.filter((constraint) => constraint.type === "amenity");

  if (constraints.length === 0) {
    return {
      score: 55,
      explanation: "No daily-life amenity requirement is active.",
    };
  }

  const scores = constraints.map((constraint) => {
    const matches = countNearbyPois(candidate, pois, constraint);
    return clamp((matches / Math.max(1, constraint.minimumCount)) * 100, 0, 100);
  });

  return {
    score: average(scores),
    explanation: `${constraints.length} daily-life requirement${
      constraints.length === 1 ? "" : "s"
    } scored against visible POI layers.`,
  };
}

function scoreSchools(candidate: LatLng, profile: HouseholdProfile) {
  const constraints = profile.constraints.filter((constraint) => constraint.type === "school");
  const schoolAnchors = profile.anchors.filter((anchor) => anchor.category === "school");

  if (constraints.length === 0 && schoolAnchors.length === 0) {
    return {
      score: 50,
      explanation: "School quality and boundaries are not connected yet.",
    };
  }

  if (schoolAnchors.length === 0) {
    return {
      score: 55,
      explanation: "School preference exists, but no school anchor is available yet.",
    };
  }

  const scores = schoolAnchors.map((anchor) =>
    scoreThreshold(distanceMeters(candidate, anchor) / 1000, 10),
  );

  return {
    score: average(scores),
    explanation: `${schoolAnchors.length} school anchor${
      schoolAnchors.length === 1 ? "" : "s"
    } scored by distance.`,
  };
}

function scoreHealthcare(candidate: LatLng, profile: HouseholdProfile, routeEvidence: RouteEvidence) {
  const constraints = profile.constraints.filter((constraint) => constraint.type === "healthcare");

  if (constraints.length === 0) {
    return {
      score: 55,
      explanation: "No healthcare or on-call constraint is active.",
    };
  }

  const scores = constraints.map((constraint) => {
    const anchor = constraint.anchorId
      ? profile.anchors.find((item) => item.id === constraint.anchorId)
      : profile.anchors.find((item) => item.category === "healthcare");

    if (!anchor) {
      return 50;
    }

    const minutes = estimateTravelMinutes(
      distanceMeters(candidate, anchor),
      constraint.transportMode,
      "walk",
    );

    return scoreThreshold(minutes, constraint.maxMinutes);
  });
  const routeScore = contourScore(routeEvidence.healthcare);
  const blendedScores = routeScore === undefined ? scores : [...scores, routeScore];

  return {
    score: average(blendedScores),
    explanation: `${constraints.length} healthcare constraint${
      constraints.length === 1 ? "" : "s"
    } scored with estimated travel time${
      routeScore !== undefined ? " and generated healthcare anchor contours" : ""
    }.`,
  };
}

type RouteEvidence = {
  assets: RouteContourEvidence;
  anchors: RouteContourEvidence;
  commute: RouteContourEvidence;
  healthcare: RouteContourEvidence;
  byPointId: Record<string, RouteContourEvidence>;
};

type RouteContourEvidence = {
  contourCount: number;
  matchingContourCount: number;
  minBucketMinutes?: number;
};

function scoreCivicCapacity(
  candidate: LatLng,
  profile: HouseholdProfile,
  civicAssets: MapPoint[],
  routeEvidence: RouteEvidence,
) {
  const constraints = profile.constraints.filter((constraint) => constraint.type === "civic-asset");
  const civicAnchors = profile.anchors.filter((anchor) => anchor.category === "civic-asset");

  if (constraints.length === 0 && civicAnchors.length === 0 && civicAssets.length === 0) {
    return {
      score: 50,
      explanation: "No civic asset capacity constraint is active.",
    };
  }

  const anchorScores = civicAnchors.map((anchor) =>
    scoreThreshold(distanceMeters(candidate, anchor) / 1000, 8),
  );
  const assetScores = constraints.flatMap((constraint) => {
    const radiusMeters = metersPerMinute("foot-walking", "walk") * constraint.maxMinutes;
    const nearbyAssets = civicAssets.filter((asset) => distanceMeters(candidate, asset) <= radiusMeters);
    const nearbyCapacity = nearbyAssets.reduce((sum, asset) => sum + (asset.capacity || 0), 0);

    if (constraint.minimumCapacity) {
      return [clamp((nearbyCapacity / constraint.minimumCapacity) * 100, 0, 100)];
    }

    return [nearbyAssets.length > 0 ? 100 : 30];
  });
  const proxyScores = [...anchorScores, ...assetScores];
  const routeScore =
    routeEvidence.assets.contourCount > 0
      ? routeEvidence.assets.matchingContourCount > 0
        ? 100
        : 20
      : undefined;
  const scores = routeScore === undefined ? proxyScores : [...proxyScores, routeScore];

  return {
    score: scores.length > 0 ? average(scores) : 55,
    explanation: `${civicAnchors.length} profile civic anchor${
      civicAnchors.length === 1 ? "" : "s"
    } and ${civicAssets.length} imported asset${
      civicAssets.length === 1 ? "" : "s"
    } scored by distance, capacity${
      routeEvidence.assets.contourCount > 0
        ? `, and generated routed contours${
            routeEvidence.assets.minBucketMinutes
              ? ` within ${routeEvidence.assets.minBucketMinutes} min`
              : ""
          }`
        : ""
    }.`,
  };
}

function scoreFrictionPenalty(candidate: LatLng, profile: HouseholdProfile, pois: PointOfInterest[]) {
  const amenityConstraints = profile.constraints.filter((constraint) => constraint.type === "amenity");

  if (amenityConstraints.length === 0) {
    return {
      score: 0,
      explanation: "No amenity friction penalty is active.",
    };
  }

  const nearbyPois = pois.filter((poi) => distanceMeters(candidate, poi) <= 1600).length;
  const penalty = pois.length === 0 ? 45 : nearbyPois === 0 ? 30 : nearbyPois < 2 ? 12 : 0;

  return {
    score: penalty,
    explanation:
      penalty === 0
        ? "Visible POIs reduce friction risk for this proxy score."
        : "Limited visible POI evidence increases friction risk for this proxy score.",
  };
}

function getRouteEvidence(
  candidate: LatLng,
  isochrones: IsochroneFeature[],
  civicAssets: MapPoint[],
  profile: HouseholdProfile,
): RouteEvidence {
  const assetIds = new Set(civicAssets.map((asset) => asset.id));
  const anchorIds = new Set(profile.anchors.map((anchor) => anchor.id));
  const commuteAnchorIds = new Set(
    profile.constraints
      .filter((constraint): constraint is Extract<DecisionConstraint, { type: "commute" }> => constraint.type === "commute")
      .map((constraint) => constraint.anchorId),
  );
  const healthcareAnchorIds = new Set(
    profile.constraints
      .filter((constraint): constraint is Extract<DecisionConstraint, { type: "healthcare" }> => constraint.type === "healthcare")
      .flatMap((constraint) => {
        if (constraint.anchorId) {
          return [constraint.anchorId];
        }

        return profile.anchors
          .filter((anchor) => anchor.category === "healthcare")
          .map((anchor) => anchor.id);
      }),
  );
  const assetContours = isochrones.filter((feature) => assetIds.has(feature.properties.pointId));
  const anchorContours = isochrones.filter((feature) => anchorIds.has(feature.properties.pointId));
  const commuteContours = isochrones.filter((feature) =>
    commuteAnchorIds.has(feature.properties.pointId),
  );
  const healthcareContours = isochrones.filter((feature) =>
    healthcareAnchorIds.has(feature.properties.pointId),
  );
  const contourIds = new Set(isochrones.map((feature) => feature.properties.pointId));
  const byPointId = Array.from(contourIds).reduce<Record<string, RouteContourEvidence>>(
    (accumulator, pointId) => {
      accumulator[pointId] = summarizeContours(
        isochrones.filter((feature) => feature.properties.pointId === pointId),
        candidate,
      );
      return accumulator;
    },
    {},
  );

  return {
    assets: summarizeContours(assetContours, candidate),
    anchors: summarizeContours(anchorContours, candidate),
    commute: summarizeContours(commuteContours, candidate),
    healthcare: summarizeContours(healthcareContours, candidate),
    byPointId,
  };
}

function summarizeContours(features: IsochroneFeature[], candidate: LatLng): RouteContourEvidence {
  const matchingContours = features.filter((feature) => featureContainsPoint(feature, candidate));
  const matchingBuckets = matchingContours
    .map((feature) => feature.properties.bucketMinutes)
    .filter(Number.isFinite);

  return {
    contourCount: features.length,
    matchingContourCount: matchingContours.length,
    minBucketMinutes: matchingBuckets.length > 0 ? Math.min(...matchingBuckets) : undefined,
  };
}

function contourScore(evidence: RouteContourEvidence) {
  if (evidence.contourCount === 0) {
    return undefined;
  }

  return evidence.matchingContourCount > 0 ? 100 : 20;
}

function hasMatchingContourWithin(evidence: RouteContourEvidence | undefined, maxMinutes: number) {
  if (!evidence?.matchingContourCount) {
    return false;
  }

  return evidence.minBucketMinutes === undefined || evidence.minBucketMinutes <= maxMinutes;
}

function featureContainsPoint(feature: IsochroneFeature, point: LatLng) {
  if (feature.geometry.type === "Polygon") {
    return polygonContainsPoint(feature.geometry.coordinates, point);
  }

  return feature.geometry.coordinates.some((polygon) => polygonContainsPoint(polygon, point));
}

function polygonContainsPoint(polygon: number[][][], point: LatLng) {
  const [outerRing, ...holes] = polygon;

  if (!outerRing || !ringContainsPoint(outerRing, point)) {
    return false;
  }

  return !holes.some((hole) => ringContainsPoint(hole, point));
}

function ringContainsPoint(ring: number[][], point: LatLng) {
  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];

    if (
      yi === undefined ||
      xi === undefined ||
      yj === undefined ||
      xj === undefined
    ) {
      continue;
    }

    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function findFailedConstraints(
  candidate: LatLng,
  profile: HouseholdProfile,
  pois: PointOfInterest[],
  civicAssets: MapPoint[],
  routeEvidence: RouteEvidence,
) {
  const failures: ScoreBreakdown["failedConstraints"] = [];

  for (const constraint of profile.constraints) {
    if (constraint.priority !== "required") {
      continue;
    }

    const failure = explainRequiredFailure(
      candidate,
      profile,
      pois,
      civicAssets,
      routeEvidence,
      constraint,
    );

    if (failure) {
      failures.push(failure);
    }
  }

  return failures;
}

function explainRequiredFailure(
  candidate: LatLng,
  profile: HouseholdProfile,
  pois: PointOfInterest[],
  civicAssets: MapPoint[],
  routeEvidence: RouteEvidence,
  constraint: DecisionConstraint,
) {
  if (constraint.type === "amenity") {
    const matches = countNearbyPois(candidate, pois, constraint);

    if (matches < constraint.minimumCount) {
      return {
        constraintType: constraint.type,
        label: `${constraint.category} requirement`,
        explanation: `${matches} of ${constraint.minimumCount} required place${
          constraint.minimumCount === 1 ? "" : "s"
        } found inside the proxy radius.`,
      };
    }
  }

  if (constraint.type === "commute") {
    const anchor = profile.anchors.find((item) => item.id === constraint.anchorId);

    if (anchor) {
      const anchorEvidence = routeEvidence.byPointId[anchor.id];

      if (hasMatchingContourWithin(anchorEvidence, constraint.maxMinutes)) {
        return undefined;
      }

      const minutes = estimateTravelMinutes(
        distanceMeters(candidate, anchor),
        constraint.transportMode,
        constraint.mobilityMode,
      );

      if (minutes > constraint.maxMinutes) {
        return {
          constraintType: constraint.type,
          label: `${anchor.name} commute`,
          explanation: `Estimated ${Math.round(minutes)} min, above the ${constraint.maxMinutes} min requirement.`,
        };
      }
    }
  }

  if (constraint.type === "healthcare") {
    const anchor = constraint.anchorId
      ? profile.anchors.find((item) => item.id === constraint.anchorId)
      : profile.anchors.find((item) => item.category === "healthcare");

    if (anchor) {
      const anchorEvidence = routeEvidence.byPointId[anchor.id];

      if (hasMatchingContourWithin(anchorEvidence, constraint.maxMinutes)) {
        return undefined;
      }

      const minutes = estimateTravelMinutes(
        distanceMeters(candidate, anchor),
        constraint.transportMode,
        "walk",
      );

      if (minutes > constraint.maxMinutes) {
        return {
          constraintType: constraint.type,
          label: `${anchor.name} healthcare access`,
          explanation: `Estimated ${Math.round(minutes)} min, above the ${constraint.maxMinutes} min requirement.`,
        };
      }
    }
  }

  if (constraint.type === "civic-asset") {
    const radiusMeters = metersPerMinute("foot-walking", "walk") * constraint.maxMinutes;
    const nearbyAssets = civicAssets.filter((asset) => distanceMeters(candidate, asset) <= radiusMeters);
    const nearbyCapacity = nearbyAssets.reduce((sum, asset) => sum + (asset.capacity || 0), 0);

    if (constraint.minimumCapacity && nearbyCapacity < constraint.minimumCapacity) {
      return {
        constraintType: constraint.type,
        label: "Existing civic asset capacity",
        explanation: `Imported assets provide ${nearbyCapacity} of ${constraint.minimumCapacity} required capacity inside the proxy radius.`,
      };
    }

    if (!constraint.minimumCapacity && nearbyAssets.length === 0) {
      return {
        constraintType: constraint.type,
        label: "Existing civic asset reach",
        explanation: "No imported civic assets found inside the proxy radius.",
      };
    }
  }

  return undefined;
}

function countNearbyPois(
  candidate: LatLng,
  pois: PointOfInterest[],
  constraint: AmenityRequirement,
) {
  const categories = AMENITY_TO_POI[constraint.category] || [];
  const radius = Math.max(
    400,
    Math.min(
      4000,
      metersPerMinute(constraint.transportMode, constraint.mobilityMode) * constraint.maxMinutes,
    ),
  );

  return pois.filter(
    (poi) => categories.includes(poi.category) && distanceMeters(candidate, poi) <= radius,
  ).length;
}

function scoreThreshold(value: number, threshold: number) {
  if (threshold <= 0) {
    return 50;
  }

  if (value <= threshold) {
    return 100;
  }

  if (value >= threshold * 2.2) {
    return 0;
  }

  return clamp(100 - ((value - threshold) / (threshold * 1.2)) * 100, 0, 100);
}

function estimateTravelMinutes(
  meters: number,
  transportMode: TransportMode,
  mobilityMode: MobilityMode,
) {
  return meters / metersPerMinute(transportMode, mobilityMode);
}

function metersPerMinute(transportMode: TransportMode, mobilityMode: MobilityMode) {
  if (transportMode === "driving-car") {
    return 650;
  }

  if (transportMode === "cycling-regular" || mobilityMode === "bike") {
    return 250;
  }

  if (mobilityMode === "stroller") {
    return 65;
  }

  if (mobilityMode === "senior") {
    return 55;
  }

  return 80;
}

function distanceMeters(a: LatLng, b: LatLng) {
  const earthRadius = 6371000;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 50;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function scoreBand(score: number): ScoreBand {
  if (score >= 85) {
    return "excellent";
  }

  if (score >= 70) {
    return "good";
  }

  if (score >= 50) {
    return "mixed";
  }

  if (score >= 30) {
    return "poor";
  }

  return "failed";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
