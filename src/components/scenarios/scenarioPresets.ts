import type { ScenarioPreset } from "../../types";

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "real-estate-dev",
    title: "Real Estate Dev",
    subtitle: "Site reach and overlap",
    description: "Compare drive, bike, and walk access across candidate sites.",
    settings: {
      selectedScenario: "real-estate-dev",
      hasCompletedFirstRun: true,
      mobilityMode: "bike",
      transportMode: "cycling-regular",
      routingProvider: "ors",
      isochroneMode: "overlap",
      preset: "balanced",
      timeMinutes: 20,
      timeBuckets: [5, 10, 15, 20, 25, 30],
      ringSpacingMinutes: 5,
      opacity: 0.32,
      labelDensity: "medium",
      layoutMode: "split",
    },
  },
  {
    id: "home-seeker",
    title: "Home Seeker",
    subtitle: "Daily-life accessibility",
    description: "Find nearby places that are practical for walking, strollers, or slower pace.",
    settings: {
      selectedScenario: "home-seeker",
      hasCompletedFirstRun: true,
      mobilityMode: "stroller",
      transportMode: "foot-walking",
      routingProvider: "ors",
      isochroneMode: "individual",
      preset: "compact",
      timeMinutes: 15,
      timeBuckets: [5, 10, 15],
      ringSpacingMinutes: 5,
      opacity: 0.3,
      labelDensity: "low",
      layoutMode: "map-first",
    },
  },
  {
    id: "urban-planner",
    title: "Urban Planner",
    subtitle: "Coverage and equity gaps",
    description: "Analyze walking and biking coverage where hills change real access.",
    settings: {
      selectedScenario: "urban-planner",
      hasCompletedFirstRun: true,
      mobilityMode: "walk",
      transportMode: "foot-walking",
      routingProvider: "ors",
      isochroneMode: "overlap",
      preset: "spacious",
      timeMinutes: 30,
      timeBuckets: [5, 10, 15, 20, 25, 30],
      ringSpacingMinutes: 5,
      opacity: 0.36,
      labelDensity: "high",
      layoutMode: "split",
    },
  },
];

export function getScenarioPreset(id: ScenarioPreset["id"]) {
  return SCENARIO_PRESETS.find((scenario) => scenario.id === id);
}
