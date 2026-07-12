import {
  MAPGAP_ANALYSIS_DATASET_IDS,
  type MapGapProjectV1,
} from "@mapgap/project-contract";
import {getStoryLayers, getStoryMapConfig, type StoryId} from "./story-config";

/**
 * Stable dataset identifiers for the additive analysis bundle. These remain
 * outside mapgap-project/v1: the portable project is decision truth while the
 * analysis bundle is replaceable presentation context.
 */
export const ANALYSIS_BUNDLE_DATASET_IDS = {
  accessSurface: MAPGAP_ANALYSIS_DATASET_IDS.accessSurface,
  housingAreas: MAPGAP_ANALYSIS_DATASET_IDS.housingAreas,
  housingCandidates: MAPGAP_ANALYSIS_DATASET_IDS.housingCandidates,
} as const;

/** App-owned presentation state; never persisted into either portable contract. */
export const COMPARISON_PRESENTATION_DATASET_IDS = {
  selection: "mapgap-presentation-selection-v1",
} as const;

export const COMPARISON_LAYER_IDS = {
  accessSurface: "mapgap-analysis-access-surface",
  housingAreas: "mapgap-analysis-housing-areas",
  housingCandidates: "mapgap-analysis-housing-candidates",
  selection: "mapgap-presentation-selection",
} as const;

export type ComparisonPaneRole = "access" | "intelligence";
export type ComparisonViewMode = "compare" | ComparisonPaneRole;

export type AnalysisLayerAvailability = Partial<
  Record<keyof typeof ANALYSIS_BUNDLE_DATASET_IDS | "selection", boolean>
>;

export type ComparisonLayerRegistration = {
  id: string;
  dataId: string;
  label: string;
  paneRoles: readonly ComparisonPaneRole[];
  source: "portable-project" | "analysis-bundle" | "presentation";
};

export type SplitMapMask = {
  id: ComparisonPaneRole;
  layers: Record<string, boolean>;
};

type AnalysisLayerDefinition = {
  id: string;
  dataId: string;
  availabilityKey: keyof typeof ANALYSIS_BUNDLE_DATASET_IDS | "selection";
  label: string;
  paneRoles: readonly ComparisonPaneRole[];
  color: [number, number, number];
  strokeColor: [number, number, number];
  opacity: number;
  radius?: number;
  radiusField?: {name: string; type: "integer"};
  colorField: {name: string; type: "string"};
  colorRange: string[];
  tooltipFields: string[];
  source?: "analysis-bundle" | "presentation";
};

const ANALYSIS_LAYERS: readonly AnalysisLayerDefinition[] = [
  {
    id: COMPARISON_LAYER_IDS.accessSurface,
    dataId: ANALYSIS_BUNDLE_DATASET_IDS.accessSurface,
    availabilityKey: "accessSurface",
    label: "Routed access surface",
    paneRoles: ["access"],
    color: [37, 99, 235],
    strokeColor: [30, 64, 175],
    opacity: 0.32,
    colorField: {name: "accessBand", type: "string"},
    colorRange: ["#dbeafe", "#93c5fd", "#60a5fa", "#2563eb", "#1e3a8a"],
    tooltipFields: ["label", "minutes", "mobilityMode", "routingProvider", "generatedAt"],
  },
  {
    id: COMPARISON_LAYER_IDS.housingAreas,
    dataId: ANALYSIS_BUNDLE_DATASET_IDS.housingAreas,
    availabilityKey: "housingAreas",
    label: "Housing affordability context",
    paneRoles: ["intelligence"],
    color: [217, 119, 6],
    strokeColor: [146, 64, 14],
    opacity: 0.44,
    colorField: {name: "rentBurdenBand", type: "string"},
    colorRange: ["#fef3c7", "#fde68a", "#fbbf24", "#f97316", "#b91c1c"],
    tooltipFields: ["name", "geoid", "medianGrossRent", "rentBurdenPercent", "sourceVintage"],
  },
  {
    id: COMPARISON_LAYER_IDS.housingCandidates,
    dataId: ANALYSIS_BUNDLE_DATASET_IDS.housingCandidates,
    availabilityKey: "housingCandidates",
    label: "Housing candidates",
    paneRoles: ["intelligence"],
    color: [5, 150, 105],
    strokeColor: [255, 255, 255],
    opacity: 0.92,
    radius: 17,
    radiusField: {name: "units", type: "integer"},
    colorField: {name: "affordabilityBand", type: "string"},
    colorRange: ["#047857", "#f59e0b", "#be123c", "#64748b"],
    tooltipFields: ["name", "units", "monthlyRent", "affordabilityBand", "sourceVintage"],
  },
  {
    id: COMPARISON_LAYER_IDS.selection,
    dataId: COMPARISON_PRESENTATION_DATASET_IDS.selection,
    availabilityKey: "selection",
    label: "Shared selection",
    paneRoles: ["access", "intelligence"],
    color: [215, 255, 111],
    strokeColor: [13, 40, 49],
    opacity: 0.18,
    radius: 24,
    colorField: {name: "selectionKind", type: "string"},
    colorRange: ["#d7ff6f"],
    tooltipFields: ["label", "selectionKind"],
    source: "presentation",
  },
];

const STORY_PANE_ROLES: Record<StoryId, Record<string, readonly ComparisonPaneRole[]>> = {
  relocation: {
    "mapgap-relocation-access": ["access"],
    "mapgap-relocation-candidates": ["access", "intelligence"],
    "mapgap-relocation-anchors": ["access"],
    "mapgap-relocation-pois": ["intelligence"],
  },
  civic: {
    "mapgap-civic-access": ["access"],
    "mapgap-civic-underserved": ["access"],
    "mapgap-civic-assets": ["intelligence"],
    "mapgap-civic-anchor": ["access", "intelligence"],
  },
};

/**
 * Returns every renderable layer with an explicit semantic pane assignment.
 * A layer must be registered before it can appear in either comparison pane.
 */
export function getComparisonLayerRegistry(
  storyId: StoryId,
  project: MapGapProjectV1,
  availability: AnalysisLayerAvailability = {},
): ComparisonLayerRegistration[] {
  const storyRegistrations = getStoryLayers(storyId, project).map((layer) => {
    const paneRoles = STORY_PANE_ROLES[storyId][layer.id];
    if (!paneRoles) {
      throw new Error(`Comparison pane role is missing for story layer ${layer.id}.`);
    }
    return {
      id: layer.id,
      dataId: layer.dataId,
      label: layer.label,
      paneRoles,
      source: "portable-project" as const,
    };
  });

  const analysisRegistrations = ANALYSIS_LAYERS
    .filter((layer) => availability[layer.availabilityKey] === true)
    .map((layer) => ({
      id: layer.id,
      dataId: layer.dataId,
      label: layer.label,
      paneRoles: layer.paneRoles,
      source: layer.source ?? "analysis-bundle" as const,
    }));

  return [...storyRegistrations, ...analysisRegistrations];
}

/**
 * Kepler splitMaps is a positive visibility mask. Emit every layer in both
 * masks (including false values) so a newly added context layer cannot leak
 * into the access pane through Kepler defaults.
 */
export function getWideSplitMapMasks(
  registrations: readonly ComparisonLayerRegistration[],
): [SplitMapMask, SplitMapMask] {
  return (["access", "intelligence"] as const).map((role) => ({
    id: role,
    layers: Object.fromEntries(
      registrations.map((layer) => [layer.id, layer.paneRoles.includes(role)]),
    ),
  })) as [SplitMapMask, SplitMapMask];
}

/** Visibility for the single-canvas iPad portrait/phone modes. */
export function getFocusModeLayerVisibility(
  registrations: readonly ComparisonLayerRegistration[],
  mode: ComparisonViewMode,
): Record<string, boolean> {
  return Object.fromEntries(
    registrations.map((layer) => [
      layer.id,
      mode === "compare" || layer.paneRoles.includes(mode),
    ]),
  );
}

/**
 * Produces a complete addDataToMap config for either synchronized wide compare
 * or a single-canvas focus mode. Datasets are supplied separately by adapters.
 */
export function getComparisonMapConfig(
  storyId: StoryId,
  project: MapGapProjectV1,
  availability: AnalysisLayerAvailability,
  mode: ComparisonViewMode,
) {
  const storyConfig = getStoryMapConfig(storyId, project);
  const registrations = getComparisonLayerRegistry(storyId, project, availability);
  const visibility = getFocusModeLayerVisibility(registrations, mode);
  const analysisLayers = ANALYSIS_LAYERS
    .filter((layer) => availability[layer.availabilityKey] === true)
    .map(toAnalysisKeplerLayer);
  const layers = [...storyConfig.config.visState.layers, ...analysisLayers].map((layer) => ({
    ...layer,
    config: {
      ...layer.config,
      isVisible: visibility[layer.id] ?? false,
    },
  }));
  const storyFields = storyConfig.config.visState.interactionConfig.tooltip.fieldsToShow;
  const analysisFields = Object.fromEntries(
    ANALYSIS_LAYERS
      .filter((layer) => availability[layer.availabilityKey] === true)
      .map((layer) => [
        layer.dataId,
        layer.tooltipFields.map((name) => ({name, format: null})),
      ]),
  );

  return {
    ...storyConfig,
    config: {
      ...storyConfig.config,
      visState: {
        ...storyConfig.config.visState,
        layers,
        splitMaps: mode === "compare" ? getWideSplitMapMasks(registrations) : [],
        interactionConfig: {
          ...storyConfig.config.visState.interactionConfig,
          tooltip: {
            ...storyConfig.config.visState.interactionConfig.tooltip,
            fieldsToShow: {...storyFields, ...analysisFields},
          },
        },
      },
      mapState: {
        ...storyConfig.config.mapState,
        isSplit: mode === "compare",
        isViewportSynced: true,
        isZoomLocked: mode === "compare",
        mapSplitMode: mode === "compare" ? "DUAL_MAP" : "SINGLE_MAP",
      },
    },
  };
}

function toAnalysisKeplerLayer(layer: AnalysisLayerDefinition) {
  return {
    id: layer.id,
    type: "geojson",
    config: {
      dataId: layer.dataId,
      label: layer.label,
      color: layer.color,
      columns: {geojson: "_geojson"},
      isVisible: true,
      visConfig: {
        opacity: layer.opacity,
        thickness: 1.5,
        strokeColor: layer.strokeColor,
        radius: layer.radius ?? 10,
        sizeRange: [0, 10],
        radiusRange: layer.radiusField ? [8, 30] : [0, 50],
        colorRange: {
          name: layer.label,
          type: "custom",
          category: "Custom",
          colors: layer.colorRange,
        },
        heightRange: [0, 500],
        elevationScale: 5,
        stroked: true,
        filled: true,
        enable3d: false,
        wireframe: false,
      },
    },
    visualChannels: {
      colorField: layer.colorField,
      colorScale: "ordinal",
      sizeField: null,
      sizeScale: "linear",
      strokeColorField: null,
      strokeColorScale: "quantile",
      heightField: null,
      heightScale: "linear",
      radiusField: layer.radiusField ?? null,
      radiusScale: layer.radiusField ? "sqrt" : "linear",
    },
  };
}
