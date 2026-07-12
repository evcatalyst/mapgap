/**
 * Framework-light planning for the Kepler comparison workspace.
 *
 * Kepler stores global layer visibility separately from its two per-map masks.
 * It also discards the masks when returning to a single map. Keeping the desired
 * masks outside Kepler lets responsive transitions rebuild the exact workspace
 * instead of depending on whatever visibility happened to survive the last mode.
 */

export const SINGLE_MAP = "SINGLE_MAP" as const;
export const DUAL_MAP = "DUAL_MAP" as const;
export const SWIPE_COMPARE = "SWIPE_COMPARE" as const;

export type KeplerMapSplitMode =
  | typeof SINGLE_MAP
  | typeof DUAL_MAP
  | typeof SWIPE_COMPARE;

export type ComparisonLayout = "single-access" | "single-intelligence" | "dual";

export type ComparisonPaneMasks = {
  access: Readonly<Record<string, boolean>>;
  intelligence: Readonly<Record<string, boolean>>;
};

export type KeplerComparisonState = {
  mapState: {
    isSplit: boolean;
    mapSplitMode: KeplerMapSplitMode;
  };
  visState: {
    layers: ReadonlyArray<{
      id: string;
      config: {isVisible: boolean};
    }>;
    splitMaps: ReadonlyArray<{
      id?: string;
      layers: Readonly<Record<string, boolean>>;
    }>;
    clicked?: unknown;
  };
};

export type ComparisonActionIntent =
  | {
      kind: "set-global-layer-visibility";
      layerId: string;
      isVisible: boolean;
    }
  | {
      kind: "set-map-split-mode";
      mapSplitMode: typeof SINGLE_MAP | typeof DUAL_MAP;
    }
  | {
      kind: "toggle-layer-for-map";
      mapIndex: 0 | 1;
      layerId: string;
    };

/**
 * Return the minimal ordered intents needed to reach a comparison layout.
 *
 * The order is part of the contract:
 * 1. make global visibility suitable for the destination;
 * 2. set/repair the map mode;
 * 3. reconcile the two explicit pane masks with toggle-only Kepler actions.
 */
export function planComparisonTransition(
  state: KeplerComparisonState,
  layout: ComparisonLayout,
  masks: ComparisonPaneMasks,
): ComparisonActionIntent[] {
  const managedLayerIds = sortedManagedLayerIds(masks);
  const loadedLayers = new Map(state.visState.layers.map((layer) => [layer.id, layer]));
  const loadedManagedLayerIds = managedLayerIds.filter((layerId) => loadedLayers.has(layerId));
  const targetMode = layout === "dual" ? DUAL_MAP : SINGLE_MAP;
  const globalVisibility = desiredGlobalVisibility(layout, masks, loadedManagedLayerIds);
  const visibilityIntents: ComparisonActionIntent[] = [];

  for (const layerId of loadedManagedLayerIds) {
    const isVisible = globalVisibility.get(layerId) ?? false;
    if (loadedLayers.get(layerId)?.config.isVisible !== isVisible) {
      visibilityIntents.push({kind: "set-global-layer-visibility", layerId, isVisible});
    }
  }

  let predictedMode = state.mapState.mapSplitMode;
  let predictedIsSplit = state.mapState.isSplit;
  let predictedSplitMaps = state.visState.splitMaps.map((splitMap) => ({
    layers: {...splitMap.layers},
  }));

  // Global visibility changes mutate split masks before the mode action runs:
  // hiding removes the layer; showing a missing layer adds it to both maps.
  for (const intent of visibilityIntents) {
    if (intent.kind !== "set-global-layer-visibility") continue;
    predictedSplitMaps = predictedSplitMaps.map((splitMap) => {
      const layers = {...splitMap.layers};
      if (!intent.isVisible) {
        delete layers[intent.layerId];
      } else if (!(intent.layerId in layers)) {
        layers[intent.layerId] = true;
      }
      return {layers};
    });
  }

  const modeIntents: ComparisonActionIntent[] = [];
  const coherent = isModeCoherent(predictedMode, predictedIsSplit, predictedSplitMaps.length);

  if (predictedMode === targetMode && !coherent) {
    // Kepler's set-mode updater returns early when the enum already matches.
    // Step through the opposite mode to repair inconsistent map/vis state.
    const repairMode = targetMode === DUAL_MAP ? SINGLE_MAP : DUAL_MAP;
    modeIntents.push({kind: "set-map-split-mode", mapSplitMode: repairMode});
    ({mode: predictedMode, isSplit: predictedIsSplit, splitMaps: predictedSplitMaps} =
      predictModeChange(repairMode, predictedMode, globalVisibility, loadedManagedLayerIds, predictedSplitMaps));
  }

  if (predictedMode !== targetMode) {
    modeIntents.push({kind: "set-map-split-mode", mapSplitMode: targetMode});
    ({mode: predictedMode, isSplit: predictedIsSplit, splitMaps: predictedSplitMaps} =
      predictModeChange(targetMode, predictedMode, globalVisibility, loadedManagedLayerIds, predictedSplitMaps));
  }

  if (targetMode === SINGLE_MAP) {
    return [...visibilityIntents, ...modeIntents];
  }

  const paneIntents: ComparisonActionIntent[] = [];
  const targetMasks = [masks.access, masks.intelligence] as const;
  for (const mapIndex of [0, 1] as const) {
    const currentMask = predictedSplitMaps[mapIndex]?.layers ?? {};
    for (const layerId of loadedManagedLayerIds) {
      const current = Boolean(currentMask[layerId]);
      const desired = Boolean(targetMasks[mapIndex][layerId]);
      if (current !== desired) {
        paneIntents.push({kind: "toggle-layer-for-map", mapIndex, layerId});
      }
    }
  }

  return [...visibilityIntents, ...modeIntents, ...paneIntents];
}

export type SharedMapSelection = {
  id: string;
  layerId?: string;
  coordinate?: readonly [number, number];
  geometry?: {
    type: string;
    coordinates?: unknown;
  };
  properties: Readonly<Record<string, unknown>>;
};

/**
 * Normalize Kepler's global `visState.clicked` value for the shared evidence
 * drawer and a selection overlay rendered in both panes.
 */
export function extractSharedSelection(
  visState: Pick<KeplerComparisonState["visState"], "clicked"> | null | undefined,
): SharedMapSelection | null {
  const clicked = asRecord(visState?.clicked);
  if (!clicked || clicked.picked === false) return null;

  const object = asRecord(clicked.object);
  if (!object) return null;
  const properties = asRecord(object.properties) ?? object;
  const idValue = properties.entityId ?? properties.id ?? object.entityId ?? object.id;
  if (typeof idValue !== "string" && typeof idValue !== "number") return null;

  const geometry = normalizeGeometry(object.geometry ?? object._geojson);
  const clickedCoordinate = normalizeCoordinate(clicked.coordinate);
  const geometryCoordinate = geometry?.type === "Point"
    ? normalizeCoordinate(geometry.coordinates)
    : undefined;
  const layer = asRecord(clicked.layer);

  return {
    id: String(idValue),
    ...(typeof layer?.id === "string" ? {layerId: layer.id} : {}),
    ...(clickedCoordinate ?? geometryCoordinate
      ? {coordinate: clickedCoordinate ?? geometryCoordinate}
      : {}),
    ...(geometry ? {geometry} : {}),
    properties: {...properties},
  };
}

function sortedManagedLayerIds(masks: ComparisonPaneMasks): string[] {
  return [...new Set([...Object.keys(masks.access), ...Object.keys(masks.intelligence)])]
    .sort((left, right) => left.localeCompare(right));
}

function desiredGlobalVisibility(
  layout: ComparisonLayout,
  masks: ComparisonPaneMasks,
  layerIds: readonly string[],
): Map<string, boolean> {
  return new Map(layerIds.map((layerId) => {
    const isVisible = layout === "single-access"
      ? Boolean(masks.access[layerId])
      : layout === "single-intelligence"
        ? Boolean(masks.intelligence[layerId])
        : Boolean(masks.access[layerId] || masks.intelligence[layerId]);
    return [layerId, isVisible];
  }));
}

function isModeCoherent(
  mode: KeplerMapSplitMode,
  isSplit: boolean,
  splitMapCount: number,
): boolean {
  return mode === SINGLE_MAP
    ? !isSplit && splitMapCount === 0
    : isSplit && splitMapCount === 2;
}

function predictModeChange(
  targetMode: typeof SINGLE_MAP | typeof DUAL_MAP,
  previousMode: KeplerMapSplitMode,
  globalVisibility: ReadonlyMap<string, boolean>,
  layerIds: readonly string[],
  currentSplitMaps: Array<{layers: Record<string, boolean>}>,
): {
  mode: typeof SINGLE_MAP | typeof DUAL_MAP;
  isSplit: boolean;
  splitMaps: Array<{layers: Record<string, boolean>}>;
} {
  if (targetMode === SINGLE_MAP) {
    return {mode: SINGLE_MAP, isSplit: false, splitMaps: []};
  }

  if (previousMode === SINGLE_MAP) {
    const leftLayers = Object.fromEntries(
      layerIds
        .filter((layerId) => globalVisibility.get(layerId))
        .map((layerId) => [layerId, true]),
    );
    return {
      mode: DUAL_MAP,
      isSplit: true,
      splitMaps: [{layers: leftLayers}, {layers: {}}],
    };
  }

  return {
    mode: DUAL_MAP,
    isSplit: true,
    splitMaps: currentSplitMaps.length === 2
      ? currentSplitMaps
      : [{layers: {}}, {layers: {}}],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeGeometry(value: unknown): SharedMapSelection["geometry"] | undefined {
  const geometry = asRecord(value);
  if (!geometry || typeof geometry.type !== "string") return undefined;
  return {
    type: geometry.type,
    ...(geometry.coordinates !== undefined ? {coordinates: geometry.coordinates} : {}),
  };
}

function normalizeCoordinate(value: unknown): readonly [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const longitude = value[0];
  const latitude = value[1];
  return typeof longitude === "number" && Number.isFinite(longitude)
    && typeof latitude === "number" && Number.isFinite(latitude)
    ? [longitude, latitude]
    : undefined;
}
