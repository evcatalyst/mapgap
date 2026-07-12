/**
 * Presentation policy for the V3 scale tiers. It prevents a caller from
 * accidentally hydrating a national dataset as a million-feature GeoJSON
 * object in React/Redux state.
 */
export type ScaleStrategy =
  | { kind: "direct-geojson"; maximumFeatures: 50_000 }
  | { kind: "arrow-or-query"; maximumFeatures: 1_000_000 }
  | { kind: "tiled"; maximumFeatures: number };

export type DatasetScaleEnvelope = {
  featureCount: number;
  /** Serialized bytes before Kepler/deck.gl creates column and GPU buffers. */
  byteCount?: number;
  /** Total coordinate pairs; complex polygons can be expensive with few features. */
  coordinateCount?: number;
};

export const SCALE_LIMITS = {
  directGeojson: {
    features: 50_000,
    bytes: 24 * 1024 * 1024,
    coordinates: 2_000_000,
  },
  arrowOrQuery: {
    features: 1_000_000,
    bytes: 256 * 1024 * 1024,
    coordinates: 12_000_000,
  },
} as const;

export function selectScaleStrategy(input: number | DatasetScaleEnvelope): ScaleStrategy {
  const envelope = typeof input === "number" ? {featureCount: input} : input;
  validateCount(envelope.featureCount, "featureCount");
  if (envelope.byteCount !== undefined) validateCount(envelope.byteCount, "byteCount");
  if (envelope.coordinateCount !== undefined) validateCount(envelope.coordinateCount, "coordinateCount");

  if (
    envelope.featureCount <= SCALE_LIMITS.directGeojson.features &&
    (envelope.byteCount ?? 0) <= SCALE_LIMITS.directGeojson.bytes &&
    (envelope.coordinateCount ?? 0) <= SCALE_LIMITS.directGeojson.coordinates
  ) {
    return { kind: "direct-geojson", maximumFeatures: 50_000 };
  }
  if (
    envelope.featureCount <= SCALE_LIMITS.arrowOrQuery.features &&
    (envelope.byteCount ?? 0) <= SCALE_LIMITS.arrowOrQuery.bytes &&
    (envelope.coordinateCount ?? 0) <= SCALE_LIMITS.arrowOrQuery.coordinates
  ) {
    return { kind: "arrow-or-query", maximumFeatures: 1_000_000 };
  }
  return { kind: "tiled", maximumFeatures: Number.POSITIVE_INFINITY };
}

export type ComparisonViewportQualification = {
  mode: "dual" | "single";
  paneWidth: number;
  estimatedFramebufferBytes: number;
  reason: "qualified" | "pane-width" | "framebuffer-budget";
};

export type ComparisonViewportInput = {
  width: number;
  height: number;
  devicePixelRatio?: number;
  /** Two deck canvases plus color, picking, and depth buffers. */
  framebufferBudgetBytes?: number;
};

export const COMPARISON_VIEWPORT_LIMITS = {
  minimumPaneWidth: 480,
  defaultFramebufferBudgetBytes: 192 * 1024 * 1024,
  buffersPerCanvas: 4,
  bytesPerPixel: 4,
} as const;

/**
 * Container-driven dual-canvas gate used for desktop and iPad landscape. It
 * intentionally ignores user-agent strings: rotation and split-screen resize
 * can change the answer without changing the device.
 */
export function qualifyComparisonViewport({
  width,
  height,
  devicePixelRatio = 1,
  framebufferBudgetBytes = COMPARISON_VIEWPORT_LIMITS.defaultFramebufferBudgetBytes,
}: ComparisonViewportInput): ComparisonViewportQualification {
  validateCount(width, "width");
  validateCount(height, "height");
  validateCount(devicePixelRatio, "devicePixelRatio");
  validateCount(framebufferBudgetBytes, "framebufferBudgetBytes");

  const paneWidth = width / 2;
  const estimatedFramebufferBytes = Math.ceil(
    width * height * devicePixelRatio ** 2 *
    COMPARISON_VIEWPORT_LIMITS.bytesPerPixel *
    COMPARISON_VIEWPORT_LIMITS.buffersPerCanvas,
  );
  if (paneWidth < COMPARISON_VIEWPORT_LIMITS.minimumPaneWidth) {
    return {mode: "single", paneWidth, estimatedFramebufferBytes, reason: "pane-width"};
  }
  if (estimatedFramebufferBytes > framebufferBudgetBytes) {
    return {mode: "single", paneWidth, estimatedFramebufferBytes, reason: "framebuffer-budget"};
  }
  return {mode: "dual", paneWidth, estimatedFramebufferBytes, reason: "qualified"};
}

export type ComparisonRuntimeBudget = {
  estimatedResidentBytes: number;
  maximumInitialTileRequests: number;
  qualified: boolean;
};

/**
 * Conservative qualification estimate: parsed GeoJSON commonly expands in
 * memory, while two synchronized basemaps should still share the browser HTTP
 * cache. Runtime smoke tests measure the real request count against this cap.
 */
export function estimateComparisonRuntimeBudget(
  datasets: readonly DatasetScaleEnvelope[],
  viewport: ComparisonViewportInput,
): ComparisonRuntimeBudget {
  const view = qualifyComparisonViewport(viewport);
  const parsedDatasetBytes = datasets.reduce((total, dataset) => {
    validateCount(dataset.featureCount, "featureCount");
    if (dataset.byteCount !== undefined) validateCount(dataset.byteCount, "byteCount");
    return total + (dataset.byteCount ?? dataset.featureCount * 320) * 3;
  }, 0);
  const estimatedResidentBytes = parsedDatasetBytes + view.estimatedFramebufferBytes;
  const maximumInitialTileRequests = view.mode === "dual" ? 96 : 56;
  return {
    estimatedResidentBytes,
    maximumInitialTileRequests,
    qualified: estimatedResidentBytes <= (viewport.framebufferBudgetBytes ?? COMPARISON_VIEWPORT_LIMITS.defaultFramebufferBudgetBytes) * 1.5,
  };
}

function validateCount(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
}
