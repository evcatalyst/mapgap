import type { MobilityMode, PoiCategory } from "../types";

export type AskMapGapIntent = {
  rawPrompt: string;
  category: PoiCategory;
  poiQuery: string;
  placeQuery?: string;
  maxMinutes?: number;
  mobilityMode: MobilityMode;
  shouldGenerate: boolean;
  sort: "name" | "rating";
  confidence: "high" | "medium" | "low";
  summary: string;
  steps: string[];
  enrichmentPlan: AskMapGapEnrichmentStep[];
};

export type AskMapGapEnrichmentStep = {
  id: string;
  label: string;
  value: string;
  source: "user" | "deterministic-parser" | "provider-data" | "routing-provider" | "future-llm" | "system";
  status: "ready" | "needs-review";
};

const CATEGORY_PATTERNS: Array<{
  category: PoiCategory;
  terms: RegExp[];
  label: string;
}> = [
  {
    category: "farmers-market",
    label: "farmers markets",
    terms: [/farmers?\s+markets?/, /greenmarkets?/],
  },
  {
    category: "fresh-produce",
    label: "fresh produce",
    terms: [/fresh\s+produce/, /produce\s+markets?/, /fruit\s+stands?/],
  },
  {
    category: "laundry",
    label: "laundry places",
    terms: [/laundromats?/, /laundr(?:y|ies)/, /wash\s*(?:and|&)?\s*fold/],
  },
  {
    category: "bookstore",
    label: "bookstores",
    terms: [/bookstores?/, /\bbooks?\b/],
  },
  {
    category: "butcher",
    label: "butchers",
    terms: [/butchers?/, /meat\s+markets?/],
  },
  {
    category: "grocery",
    label: "grocery stores",
    terms: [/grocer(?:y|ies)/, /supermarkets?/, /food\s+stores?/],
  },
  {
    category: "coffee",
    label: "coffee",
    terms: [/coffee/, /\bcafes?\b/],
  },
  {
    category: "restaurant",
    label: "restaurants",
    terms: [/restaurants?/, /\bdinner\b/, /\blunch\b/, /\bfood\b/],
  },
  {
    category: "hospital",
    label: "hospitals",
    terms: [/hospitals?/, /medical\s+centers?/],
  },
  {
    category: "school",
    label: "schools",
    terms: [/schools?/, /private\s+schools?/, /public\s+schools?/],
  },
  {
    category: "library",
    label: "libraries",
    terms: [/librar(?:y|ies)/, /computer\s+labs?/],
  },
  {
    category: "pharmacy",
    label: "pharmacies",
    terms: [/pharmac(?:y|ies)/, /drugstores?/],
  },
  {
    category: "park",
    label: "parks",
    terms: [/\bparks?\b/, /playgrounds?/],
  },
  {
    category: "transit",
    label: "transit",
    terms: [/transit/, /train\s+stations?/, /bus\s+stops?/, /subway/],
  },
];

const CATEGORY_CLEANUP = [
  /laundromats?/gi,
  /laundr(?:y|ies)/gi,
  /grocery\s+stores?/gi,
  /grocer(?:y|ies)/gi,
  /supermarkets?/gi,
  /bookstores?/gi,
  /farmers?\s+markets?/gi,
  /fresh\s+produce/gi,
  /produce\s+markets?/gi,
  /butchers?/gi,
  /coffee/gi,
  /\bcafes?\b/gi,
  /restaurants?/gi,
  /\bdinner\b/gi,
  /hospitals?/gi,
  /schools?/gi,
  /libraries/gi,
  /pharmac(?:y|ies)/gi,
  /\bparks?\b/gi,
  /transit/gi,
];

export function parseAskMapGapPrompt(prompt: string): AskMapGapIntent {
  const rawPrompt = prompt.trim();
  const normalized = rawPrompt.toLowerCase();
  const matchedCategory = findCategory(normalized);
  const category = matchedCategory?.category || "custom";
  const poiQuery = buildPoiQuery(rawPrompt, normalized, category);
  const placeQuery = extractPlaceQuery(rawPrompt);
  const maxMinutes = extractMinutes(normalized);
  const mobilityMode = extractMobilityMode(normalized);
  const shouldGenerate = shouldGenerateHeatmap(normalized, maxMinutes);
  const sort = /\b(top\s+rated|best|highest\s+rated)\b/.test(normalized) ? "rating" : "name";
  const categoryLabel = matchedCategory?.label || "places";
  const placeLabel = placeQuery ? `in ${placeQuery}` : "in this map view";
  const confidence = matchedCategory ? (placeQuery || category !== "custom" ? "high" : "medium") : "low";
  const steps = [
    placeQuery ? `Search ${placeQuery}` : "Use current map view",
    `Add ${categoryLabel}`,
    `${mobilityModeLabel(mobilityMode)}${maxMinutes ? ` within ${maxMinutes} min` : ""}`,
    shouldGenerate ? "Generate heatmap" : "Leave as POI layer",
  ];

  return {
    rawPrompt,
    category,
    poiQuery,
    placeQuery,
    maxMinutes,
    mobilityMode,
    shouldGenerate,
    sort,
    confidence,
    summary: `Find ${categoryLabel} ${placeLabel}${
      shouldGenerate ? " and generate access heat." : "."
    }`,
    steps,
    enrichmentPlan: buildEnrichmentPlan({
      rawPrompt,
      normalized,
      category,
      categoryLabel,
      poiQuery,
      placeQuery,
      maxMinutes,
      mobilityMode,
      shouldGenerate,
      sort,
      confidence,
    }),
  };
}

export function buildTimeBucketsForIntent(maxMinutes?: number) {
  if (!maxMinutes) {
    return undefined;
  }

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

function findCategory(normalized: string) {
  return CATEGORY_PATTERNS.find((candidate) =>
    candidate.terms.some((term) => term.test(normalized)),
  );
}

function buildPoiQuery(rawPrompt: string, normalized: string, category: PoiCategory) {
  if (category === "custom") {
    return rawPrompt;
  }

  const modifiers: string[] = [];

  if (/\b(top\s+rated|best|highest\s+rated)\b/.test(normalized)) {
    modifiers.push("top rated");
  }

  if (/\b(late|night|after\s+\d{1,2})\b/.test(normalized) && /dinner|restaurant|food/.test(normalized)) {
    modifiers.push("late dinner");
  }

  if (/\b(premium|specialty|high\s+quality|upscale)\b/.test(normalized)) {
    modifiers.push("premium");
  }

  return modifiers.join(" ");
}

function extractPlaceQuery(rawPrompt: string) {
  const match = rawPrompt.match(
    /\b(?:in|near|around)\s+([a-z0-9][a-z0-9\s.,'&-]{1,70}?)(?=\s+(?:with|where|that|and|then|within|under|using|by|but|to|from)\b|$)/i,
  );

  if (!match?.[1]) {
    return undefined;
  }

  const cleaned = CATEGORY_CLEANUP.reduce(
    (value, pattern) => value.replace(pattern, ""),
    match[1],
  )
    .replace(/\b(current|map|view|viewport|area)\b/gi, "")
    .replace(/[,.]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned.length >= 2 ? cleaned : undefined;
}

function extractMinutes(normalized: string) {
  const match = normalized.match(/\b(\d{1,2})\s*(?:minute|min)\b/);

  if (!match?.[1]) {
    return undefined;
  }

  const minutes = Number(match[1]);

  if (!Number.isFinite(minutes)) {
    return undefined;
  }

  return Math.max(5, Math.min(60, minutes));
}

function extractMobilityMode(normalized: string): MobilityMode {
  if (/\b(bike|bicycle|cycling)\b/.test(normalized)) {
    return "bike";
  }

  if (/\b(stroller|wheelchair|accessible)\b/.test(normalized)) {
    return "stroller";
  }

  if (/\b(senior|older adult|limited mobility)\b/.test(normalized)) {
    return "senior";
  }

  return "walk";
}

function shouldGenerateHeatmap(normalized: string, maxMinutes?: number) {
  return Boolean(
    maxMinutes ||
      /\b(generate|heat\s*map|heatmap|isochrone|access|reachable|walkable|coverage)\b/.test(
        normalized,
      ),
  );
}

function buildEnrichmentPlan({
  rawPrompt,
  normalized,
  category,
  categoryLabel,
  poiQuery,
  placeQuery,
  maxMinutes,
  mobilityMode,
  shouldGenerate,
  sort,
  confidence,
}: {
  rawPrompt: string;
  normalized: string;
  category: PoiCategory;
  categoryLabel: string;
  poiQuery: string;
  placeQuery?: string;
  maxMinutes?: number;
  mobilityMode: MobilityMode;
  shouldGenerate: boolean;
  sort: "name" | "rating";
  confidence: AskMapGapIntent["confidence"];
}): AskMapGapEnrichmentStep[] {
  const steps: AskMapGapEnrichmentStep[] = [
    {
      id: "intent-parser",
      label: "Intent parser",
      value:
        category === "custom"
          ? `No supported category matched with ${confidence} confidence.`
          : `Mapped "${rawPrompt}" to ${categoryLabel} with ${confidence} confidence.`,
      source: "deterministic-parser",
      status: category === "custom" ? "needs-review" : "ready",
    },
    {
      id: "place-scope",
      label: "Place scope",
      value: placeQuery
        ? `Resolve ${placeQuery} before searching places.`
        : "Use the current map viewport as the search boundary.",
      source: placeQuery ? "provider-data" : "user",
      status: "ready",
    },
    {
      id: "query-planner",
      label: "Query planner",
      value: `Search ${categoryLabel}${poiQuery ? ` with "${poiQuery}"` : ""}${
        sort === "rating" ? " and prefer rated results" : ""
      }.`,
      source: "deterministic-parser",
      status: category === "custom" ? "needs-review" : "ready",
    },
    {
      id: "routing-evidence",
      label: "Routing evidence",
      value: shouldGenerate
        ? `Generate ${mobilityModeLabel(mobilityMode).toLowerCase()} contours${
            maxMinutes ? ` up to ${maxMinutes} min` : ""
          } from provider geometry.`
        : "Keep results as a POI layer until access heat is requested.",
      source: shouldGenerate ? "routing-provider" : "deterministic-parser",
      status: "ready",
    },
  ];

  if (hasProfileSignals(normalized)) {
    steps.push({
      id: "profile-enrichment",
      label: "Profile enrichment",
      value:
        "Household, work, school, housing, or on-call language should become structured profile constraints before scoring.",
      source: "future-llm",
      status: "needs-review",
    });
  }

  steps.push({
    id: "evidence-authority",
    label: "Evidence authority",
    value: "Provider data, uploaded assets, and routed contours remain the source of truth.",
    source: "system",
    status: "ready",
  });

  return steps;
}

function hasProfileSignals(normalized: string) {
  return /\b(relocat|moving|move|home|house|housing|job|work|commute|spouse|wife|husband|family|kids?|children|school\s+district|on-?call|salary|budget|hospital\s+access)\b/.test(
    normalized,
  );
}

function mobilityModeLabel(mode: MobilityMode) {
  switch (mode) {
    case "bike":
      return "Bike access";
    case "stroller":
      return "Stroller access";
    case "senior":
      return "Senior access";
    default:
      return "Walk access";
  }
}
