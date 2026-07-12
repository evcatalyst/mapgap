import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {
  addDataToMap,
  layerToggleVisibility,
  mapStyleChange,
  removeDataset,
  replaceDataInMap,
  setMapSplitMode,
  toggleLayerForMap,
  toggleSplitMapViewport,
  wrapTo,
} from "@kepler.gl/actions";
import {KeplerGl} from "@kepler.gl/components";
import {useDispatch, useSelector} from "react-redux";
import {
  MAPGAP_ANALYSIS_DATASET_IDS,
  MAPGAP_DATASET_IDS,
  analysisBundleUsage,
  type AnalysisFeatureCollectionV1,
  type MapGapAnalysisBundleV1,
  type MapGapProjectV1,
} from "@mapgap/project-contract";
import {
  getCivicCapacityProjectFixture,
  getRelocationProjectFixture,
} from "@mapgap/project-contract/fixtures";
import {getComparisonAnalysisBundleFixture} from "@mapgap/project-contract/analysis-fixtures";
import {
  analysisBundleToKeplerDatasets,
  findAnalysisFeature,
  getAnalysisLayerAvailability,
  getInitialSelection,
  selectionToKeplerDataset,
  sharedSelectionToCanonical,
  type CanonicalSelection,
} from "./adapters/analysis-to-datasets";
import {projectToEvidenceSummary, projectToKeplerDatasets} from "./adapters/project-to-datasets";
import {
  COMPARISON_PRESENTATION_DATASET_IDS,
  getComparisonLayerRegistry,
  getComparisonMapConfig,
  getWideSplitMapMasks,
  type ComparisonPaneRole,
} from "./map/comparison-config";
import {
  extractSharedSelection,
  planComparisonTransition,
  type ComparisonLayout,
  type KeplerComparisonState,
} from "./map/comparison-runtime";
import {TOKEN_FREE_MAP_STYLE_ID, TOKEN_FREE_MAP_STYLES} from "./map/token-free-style";
import {qualifyComparisonViewport} from "./scale";
import {v3Store, type V3ReduxState} from "./store";
import "./styles.css";

const KEPLER_ID = "mapgap-v3-comparison";
const V2_HANDOFF_URL = import.meta.env.VITE_MAPGAP_V2_URL || "https://mapgap-access.netlify.app/v2";
const BASEMAP_LOAD_TIMEOUT_MS = 12_000;

const HIDDEN_MAP_CONTROLS = Object.fromEntries(
  ["visibleLayers", "mapLegend", "toggle3d", "splitMap", "mapDraw", "mapLocale", "effect", "annotation", "aiAssistant"].map(
    (control) => [control, {show: false, active: false, disableClose: false, activeMapIndex: 0}],
  ),
);
const MAPGAP_UI_STATE = {mapControls: HIDDEN_MAP_CONTROLS};

type PresetId = "relocation" | "civic";
type DrawerSnap = "peek" | "open";

type PresetDefinition = {
  label: string;
  shortLabel: string;
  question: string;
  detail: string;
  getProject: () => MapGapProjectV1;
};

const PRESETS: Record<PresetId, PresetDefinition> = {
  civic: {
    label: "Civic access + housing context",
    shortLabel: "Civic + housing",
    question: "Where does routed access collide with housing pressure?",
    detail: "Compare the tuned routed surface with bounded ACS housing indicators joined to TIGER tract geometry.",
    getProject: getCivicCapacityProjectFixture,
  },
  relocation: {
    label: "Relocation decision comparison",
    shortLabel: "Relocation",
    question: "Which candidate still works after the route network is applied?",
    detail: "Compare routed constraints with candidate, anchor, and nearby-place intelligence from the portable project.",
    getProject: getRelocationProjectFixture,
  },
};

export default function ComparisonWorkbench() {
  const dispatch = useDispatch();
  const [presetId, setPresetId] = useState<PresetId>(() => getInitialPreset());
  const [focusPane, setFocusPane] = useState<ComparisonPaneRole>("access");
  const [drawerSnap, setDrawerSnap] = useState<DrawerSnap>("peek");
  const [keplerReady, setKeplerReady] = useState(false);
  const [basemapReady, setBasemapReady] = useState(false);
  const [basemapError, setBasemapError] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const [loadedRevision, setLoadedRevision] = useState(0);
  const [mapCameras, setMapCameras] = useState<Record<number, CameraState>>({});
  const [mapContainerRef, mapSize] = useElementSize();
  const webglSupported = supportsWebGl();

  const preset = PRESETS[presetId];
  const project = useMemo(() => preset.getProject(), [preset]);
  const analysisBundle = useMemo<MapGapAnalysisBundleV1>(
    () => getComparisonAnalysisBundleFixture(presetId),
    [presetId],
  );
  const simulateHousingFailure = presetId === "civic" && typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("failSource") === "housing";
  const analysisProjection = useMemo(() => {
    if (simulateHousingFailure) return {datasets: [], error: new Error("Simulated housing source outage")};
    try {
      return {datasets: analysisBundleToKeplerDatasets(analysisBundle), error: null as Error | null};
    } catch (error) {
      return {datasets: [], error: error instanceof Error ? error : new Error("Analysis source failed")};
    }
  }, [analysisBundle, simulateHousingFailure]);
  const availability = useMemo(() => !analysisProjection.error
    ? getAnalysisLayerAvailability(analysisBundle)
    : {selection: true}, [analysisBundle, analysisProjection.error]);
  const hasHousing = availability.housingAreas === true;
  const initialSelection = useMemo(() => getInitialSelection(project), [project]);
  const [selection, setSelection] = useState<CanonicalSelection>(initialSelection);
  const projectDatasets = useMemo(() => projectToKeplerDatasets(project), [project]);
  const evidence = useMemo(() => projectToEvidenceSummary(project), [project]);
  const usage = useMemo(() => analysisBundleUsage(analysisBundle), [analysisBundle]);
  const qualification = useMemo(() => qualifyComparisonViewport({
    width: mapSize.width,
    height: mapSize.height,
    devicePixelRatio: typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2),
  }), [mapSize.height, mapSize.width]);
  const isDual = qualification.mode === "dual";
  const targetLayout: ComparisonLayout = isDual ? "dual" : focusPane === "access" ? "single-access" : "single-intelligence";
  const targetLayoutRef = useRef(targetLayout);
  targetLayoutRef.current = targetLayout;

  const clicked = useSelector((state: V3ReduxState) =>
    (state.keplerGl as Record<string, {visState?: {clicked?: unknown}} | undefined>)[KEPLER_ID]?.visState?.clicked,
  );

  const mapRefs = useRef(new Map<number, MapLibreLike>());
  const listenerCleanups = useRef(new Map<number, () => void>());
  const readyMapIndexes = useRef(new Set<number>());
  const basemapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapStyleSelected = useRef(false);
  const previousDualMode = useRef(isDual);

  const comparisonMasks = useMemo(() => {
    const registry = getComparisonLayerRegistry(presetId, project, availability);
    const [access, intelligence] = getWideSplitMapMasks(registry);
    return {access: access.layers, intelligence: intelligence.layers};
  }, [availability, presetId, project]);

  const applyLayout = useCallback((layout: ComparisonLayout) => {
    const keplerInstances = v3Store.getState().keplerGl as Record<string, unknown>;
    const instance = keplerInstances[KEPLER_ID] as KeplerComparisonState | undefined;
    if (!instance?.visState?.layers?.length) return;
    const intents = planComparisonTransition(instance, layout, comparisonMasks);
    for (const intent of intents) {
      if (intent.kind === "set-global-layer-visibility") {
        dispatch(wrapTo(KEPLER_ID, layerToggleVisibility(intent.layerId, intent.isVisible)));
      } else if (intent.kind === "set-map-split-mode") {
        dispatch(wrapTo(KEPLER_ID, setMapSplitMode({mapSplitMode: intent.mapSplitMode as never})));
      } else {
        dispatch(wrapTo(KEPLER_ID, toggleLayerForMap(intent.mapIndex, intent.layerId)));
      }
    }
    if (layout === "dual") {
      dispatch(wrapTo(KEPLER_ID, toggleSplitMapViewport({isViewportSynced: true, isZoomLocked: true})));
    }
  }, [comparisonMasks, dispatch]);

  const captureMapRef = useCallback((mapRef: {getMap?: () => MapLibreLike} | null, mapIndex = 0) => {
    const previousCleanup = listenerCleanups.current.get(mapIndex);
    if (!mapRef?.getMap) {
      previousCleanup?.();
      listenerCleanups.current.delete(mapIndex);
      mapRefs.current.delete(mapIndex);
      readyMapIndexes.current.delete(mapIndex);
      return;
    }
    const map = mapRef.getMap();
    if (mapRefs.current.get(mapIndex) === map) return;
    previousCleanup?.();
    mapRefs.current.set(mapIndex, map);
    const checkReady = () => {
      const center = map.getCenter?.();
      const zoom = map.getZoom?.();
      if (center && typeof zoom === "number") {
        setMapCameras((current) => {
          const previous = current[mapIndex];
          if (previous?.longitude === center.lng && previous.latitude === center.lat && previous.zoom === zoom) {
            return current;
          }
          return {...current, [mapIndex]: {longitude: center.lng, latitude: center.lat, zoom}};
        });
      }
      const hasSources = Object.keys(map.getStyle?.()?.sources ?? {}).length > 0;
      if (!hasSources || !map.isStyleLoaded?.() || !map.areTilesLoaded?.()) return;
      readyMapIndexes.current.add(mapIndex);
      const requiredIndexes = isDual ? [0, 1] : [0];
      if (requiredIndexes.every((index) => readyMapIndexes.current.has(index))) {
        if (basemapTimeout.current) clearTimeout(basemapTimeout.current);
        basemapTimeout.current = null;
        setBasemapError(false);
        setBasemapReady(true);
      }
    };
    const handleError = () => {
      if (!map.isStyleLoaded?.()) setBasemapError(true);
    };
    map.on?.("idle", checkReady);
    map.on?.("sourcedata", checkReady);
    map.on?.("error", handleError);
    checkReady();
    listenerCleanups.current.set(mapIndex, () => {
      map.off?.("idle", checkReady);
      map.off?.("sourcedata", checkReady);
      map.off?.("error", handleError);
    });
  }, [isDual]);

  useEffect(() => {
    setSelection(initialSelection);
    setDrawerSnap("peek");
  }, [initialSelection]);

  useEffect(() => () => {
    listenerCleanups.current.forEach((cleanup) => cleanup());
    if (basemapTimeout.current) clearTimeout(basemapTimeout.current);
  }, []);

  useEffect(() => {
    if (!keplerReady) return;
    setBasemapReady(false);
    setBasemapError(false);
    setMapCameras({});
    readyMapIndexes.current.clear();
    if (basemapTimeout.current) clearTimeout(basemapTimeout.current);
    basemapTimeout.current = setTimeout(() => setBasemapError(true), BASEMAP_LOAD_TIMEOUT_MS);
    if (!mapStyleSelected.current) {
      dispatch(wrapTo(KEPLER_ID, mapStyleChange(TOKEN_FREE_MAP_STYLE_ID)));
      mapStyleSelected.current = true;
    }
    const removeIds = [
      ...Object.values(MAPGAP_DATASET_IDS),
      ...Object.values(MAPGAP_ANALYSIS_DATASET_IDS),
      COMPARISON_PRESENTATION_DATASET_IDS.selection,
    ];
    removeIds.forEach((dataId) => dispatch(wrapTo(KEPLER_ID, removeDataset(dataId))));
    const loadMode = targetLayoutRef.current === "dual"
      ? "compare"
      : targetLayoutRef.current === "single-access" ? "access" : "intelligence";
    const config = getComparisonMapConfig(presetId, project, availability, loadMode);
    dispatch(wrapTo(KEPLER_ID, addDataToMap({
      datasets: [
        ...projectDatasets,
        ...analysisProjection.datasets,
        selectionToKeplerDataset(initialSelection),
      ],
      options: {centerMap: true, readOnly: true, autoCreateLayers: false},
      config: config as never,
      info: {
        title: preset.label,
        description: "MapGap V3 synchronized access and location-intelligence comparison.",
      },
    })));
    setLoadedRevision((value) => value + 1);
  }, [
    analysisProjection.datasets,
    availability,
    dispatch,
    initialSelection,
    keplerReady,
    preset.label,
    presetId,
    project,
    projectDatasets,
  ]);

  useEffect(() => {
    if (!loadedRevision) return;
    applyLayout(targetLayout);
  }, [applyLayout, loadedRevision, targetLayout]);

  useEffect(() => {
    if (!loadedRevision || previousDualMode.current === isDual) return;
    previousDualMode.current = isDual;
    setBasemapReady(false);
    if (!isDual && readyMapIndexes.current.has(0)) {
      setBasemapReady(true);
      return;
    }
    if (basemapTimeout.current) clearTimeout(basemapTimeout.current);
    basemapTimeout.current = setTimeout(() => setBasemapError(true), BASEMAP_LOAD_TIMEOUT_MS);
  }, [isDual, loadedRevision]);

  useEffect(() => {
    if (!loadedRevision) return;
    dispatch(wrapTo(KEPLER_ID, replaceDataInMap({
      datasetToReplaceId: COMPARISON_PRESENTATION_DATASET_IDS.selection,
      datasetToUse: selectionToKeplerDataset(selection),
      options: {centerMap: false, keepExistingConfig: true, autoCreateLayers: false},
    })));
    applyLayout(targetLayoutRef.current);
  }, [applyLayout, dispatch, loadedRevision, selection]);

  useEffect(() => {
    const shared = extractSharedSelection({clicked});
    if (!shared || shared.layerId?.includes("presentation-selection")) return;
    const resolved = findAnalysisFeature(analysisBundle, shared.id);
    setSelection((current) => resolved ?? sharedSelectionToCanonical(shared, current));
    setDrawerSnap("open");
  }, [analysisBundle, clicked]);

  useEffect(() => {
    const canvases = document.querySelectorAll(".map-workbench canvas");
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglLost(true);
    };
    canvases.forEach((canvas) => canvas.addEventListener("webglcontextlost", handleContextLost));
    return () => canvases.forEach((canvas) => canvas.removeEventListener("webglcontextlost", handleContextLost));
  }, [loadedRevision, isDual]);

  function selectPreset(nextPreset: PresetId) {
    if (nextPreset === presetId) return;
    setPresetId(nextPreset);
    window.history.replaceState(null, "", `#${nextPreset}`);
  }

  function selectEvidence(next: CanonicalSelection) {
    setSelection(next);
    setDrawerSnap("open");
  }

  function zoomMap(direction: "in" | "out") {
    const options = {duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160};
    const map = mapRefs.current.get(0) ?? mapRefs.current.values().next().value;
    if (direction === "in") map?.zoomIn?.(options);
    else map?.zoomOut?.(options);
  }

  if (!webglSupported || webglLost) return <RecoveryScreen contextLost={webglLost} />;

  return (
    <main className={`v3-shell ${isDual ? "is-dual" : "is-single"}`}>
      <header className="v3-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div><p className="eyebrow">V3 comparison alpha</p><h1>MapGap <span>Analyst</span></h1></div>
        </div>
        <nav className="scenario-tabs" aria-label="Comparison stories">
          {(Object.entries(PRESETS) as Array<[PresetId, PresetDefinition]>).map(([id, option]) => (
            <button key={id} type="button" className={presetId === id ? "selected" : ""}
              aria-pressed={presetId === id} onClick={() => selectPreset(id)}>{option.shortLabel}</button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="sync-status"><i />{isDual ? "Cameras linked" : "State preserved"}</span>
          <a className="handoff-link" href={V2_HANDOFF_URL}>Open V2 <span aria-hidden="true">↗</span></a>
        </div>
      </header>

      <section ref={mapContainerRef} className="map-workbench" aria-label="MapGap comparison map" data-testid="map-workbench">
        <KeplerGl
          id={KEPLER_ID}
          mapboxApiAccessToken=""
          mapStyles={TOKEN_FREE_MAP_STYLES as never}
          mapStylesReplaceDefault
          initialUiState={MAPGAP_UI_STATE}
          getMapboxRef={captureMapRef as never}
          width={mapSize.width}
          height={mapSize.height}
          readOnly
          appName="MapGap V3 Comparison"
          onKeplerGlInitialized={() => setKeplerReady(true)}
        />

        {!basemapReady && !basemapError && <div className="map-loading" aria-hidden="true"><span /><p>Composing both evidence maps…</p></div>}
        {basemapError && <div className="map-error" role="alert" data-testid="basemap-error"><strong>Basemap unavailable</strong><span>The project and analysis evidence remain unchanged.</span><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}

        <div className="map-story-card">
          <p className="map-question">{preset.label}</p>
          <h2>{preset.question}</h2>
          <p>{preset.detail}</p>
        </div>

        {isDual ? (
          <div className="pane-chrome" aria-label="Comparison pane labels">
            <PaneHeader role="access" eyebrow="01 · Routed evidence" title="Access heat" meta="V2 access-surface contract" />
            <PaneHeader role="intelligence" eyebrow="02 · Context lens" title="Location intelligence" meta={hasHousing ? "ACS housing · TIGER geometry" : "Candidates · nearby places"} />
            <span className="pane-divider" aria-hidden="true" />
          </div>
        ) : (
          <nav className="focus-switcher" aria-label="Map focus">
            <button type="button" aria-pressed={focusPane === "access"} className={focusPane === "access" ? "selected" : ""} onClick={() => setFocusPane("access")}>Access</button>
            <button type="button" aria-pressed={focusPane === "intelligence"} className={focusPane === "intelligence" ? "selected" : ""} onClick={() => setFocusPane("intelligence")}>Intelligence</button>
          </nav>
        )}

        {analysisProjection.error && (isDual || focusPane === "intelligence") && (
          <div className="source-error" role="status" data-testid="housing-source-error">
            <strong>Housing context unavailable</strong>
            <span>Access evidence is still live; this source failed independently.</span>
          </div>
        )}

        <div className="source-rail" aria-label="Active sources">
          <span className="source-chip access"><i />Routed bands</span>
          {hasHousing && !analysisProjection.error && <span className="source-chip housing"><i />Housing 2024</span>}
          <span className="source-chip"><i />{presetId === "civic" ? "Capacity" : "Candidates"}</span>
        </div>
        <div className="map-navigation" aria-label="Map zoom controls">
          <button type="button" aria-label="Zoom in" onClick={() => zoomMap("in")}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomMap("out")}>−</button>
        </div>

        <div className="comparison-legends" aria-hidden="true">
          <div><strong>Access</strong><span className="heat-ramp" /><small>near</small><small>gap</small></div>
          {hasHousing && <div><strong>Rent burden</strong><span className="housing-ramp" /><small>lower</small><small>high</small></div>}
        </div>

        <EvidenceDrawer
          snap={drawerSnap}
          setSnap={setDrawerSnap}
          presetId={presetId}
          project={project}
          analysisBundle={analysisProjection.error ? null : analysisBundle}
          selection={selection}
          evidence={evidence}
          usage={analysisProjection.error ? null : usage}
          onSelect={selectEvidence}
        />

        <p className="map-attribution" data-testid="map-attribution">
          <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a><span>·</span>
          <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a><span>·</span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Data from OpenStreetMap</a>
        </p>
        <span className="sr-only" role="status" data-testid="kepler-mounted">{keplerReady ? "Kepler comparison workbench mounted" : "Mounting Kepler comparison workbench"}</span>
        <span className="sr-only" role="status" data-testid="basemap-ready">{basemapReady ? `${isDual ? 2 : 1} map canvas basemap ready` : "Basemap tiles loading"}</span>
        <span className="sr-only" data-testid="comparison-layout" data-layout={targetLayout} data-pane-width={qualification.paneWidth}>{targetLayout}</span>
        <span className="sr-only" data-testid="camera-sync" data-camera-count={Object.keys(mapCameras).length}
          data-camera-delta={cameraDelta(mapCameras)}>{cameraDelta(mapCameras)}</span>
      </section>
    </main>
  );
}

function PaneHeader({role, eyebrow, title, meta}: {role: ComparisonPaneRole; eyebrow: string; title: string; meta: string}) {
  return <section className={`pane-header ${role}`} data-testid={`${role}-pane-header`}><p>{eyebrow}</p><h3>{title}</h3><span>{meta}</span></section>;
}

function EvidenceDrawer({
  snap,
  setSnap,
  presetId,
  project,
  analysisBundle,
  selection,
  evidence,
  usage,
  onSelect,
}: {
  snap: DrawerSnap;
  setSnap: (snap: DrawerSnap) => void;
  presetId: PresetId;
  project: MapGapProjectV1;
  analysisBundle: MapGapAnalysisBundleV1 | null;
  selection: CanonicalSelection;
  evidence: ReturnType<typeof projectToEvidenceSummary>;
  usage: ReturnType<typeof analysisBundleUsage> | null;
  onSelect: (selection: CanonicalSelection) => void;
}) {
  const housingFeatures = analysisBundle?.datasets.find((dataset) =>
    dataset.descriptor.id === MAPGAP_ANALYSIS_DATASET_IDS.housingAreas && dataset.descriptor.representation.kind === "inline-geojson",
  )?.data as AnalysisFeatureCollectionV1 | undefined;
  const selectionFacts = getSelectionFacts(selection.properties);

  return (
    <aside className={`evidence-drawer ${snap}`} aria-label="Shared comparison evidence" data-testid="evidence-drawer">
      <button className="drawer-handle" type="button" aria-expanded={snap === "open"} onClick={() => setSnap(snap === "open" ? "peek" : "open")}
        aria-label={snap === "open" ? "Collapse evidence drawer" : "Expand evidence drawer"}><span /></button>
      <div className="drawer-summary">
        <div className="selection-identity"><p className="panel-kicker">Shared selection · {selection.datasetId}</p><h2>{selection.label}</h2></div>
        <div className="fact-strip">
          {selectionFacts.map((fact) => <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}
          <div><span>{presetId === "civic" ? "Known capacity" : "Route passes"}</span><strong>{presetId === "civic" ? evidence.totalCapacity : evidence.passedCandidateCount}</strong></div>
        </div>
        <button className="drawer-toggle" type="button" onClick={() => setSnap(snap === "open" ? "peek" : "open")}>{snap === "open" ? "Hide details" : "Compare evidence"}</button>
      </div>
      <div className="drawer-details">
        <section>
          <p className="section-label">Decision evidence</p>
          <div className="evidence-choices">
            {(presetId === "relocation" ? project.candidates : project.civic.assets).map((item) => {
              const candidate = "label" in item;
              const next: CanonicalSelection = {
                id: item.id,
                label: candidate ? item.label : item.name,
                datasetId: candidate ? MAPGAP_DATASET_IDS.candidates : MAPGAP_DATASET_IDS.assets,
                geometry: item.geometry,
                properties: candidate
                  ? {id: item.id, label: item.label, totalScore: item.score?.total, failedConstraints: item.score?.failedConstraints.map((entry) => entry.label).join(", ")}
                  : {id: item.id, name: item.name, capacity: item.capacity, utilizationPercent: item.utilizationRate === undefined ? null : Math.round(item.utilizationRate * 100)},
              };
              return <button key={item.id} type="button" className={selection.id === item.id ? "selected" : ""} onClick={() => onSelect(next)}><strong>{next.label}</strong><span>{candidate ? `${item.score?.total ?? "—"}/100` : `${item.capacity ?? "—"} capacity`}</span></button>;
            })}
          </div>
        </section>
        <section>
          <p className="section-label">Housing lens</p>
          {housingFeatures ? <div className="evidence-choices housing">
            {housingFeatures.features.map((feature) => {
              const id = String(feature.properties.geoid);
              const next = findAnalysisFeature(analysisBundle!, id)!;
              return <button key={id} type="button" className={selection.id === id ? "selected" : ""} onClick={() => onSelect(next)}><strong>{String(feature.properties.name)}</strong><span>${String(feature.properties.medianGrossRent)} median rent · {String(feature.properties.rentBurdenPercent)}% burden</span></button>;
            })}
          </div> : <p className="empty-lens">No housing layer is attached to this story. Candidate and nearby-place context remain available.</p>}
        </section>
        <section className="method-panel">
          <p className="section-label">Lineage + scale</p>
          <p>Access and context remain separate inputs. Housing never changes the routed score.</p>
          <dl><div><dt>Datasets</dt><dd>{usage?.datasets ?? project.views?.v3?.datasetIds.length ?? 0}</dd></div><div><dt>Coordinates</dt><dd>{usage?.coordinates ?? "Project"}</dd></div><div><dt>Join</dt><dd>{analysisBundle?.joins[0]?.method ?? "None"}</dd></div></dl>
          <small>{analysisBundle ? "ACS estimates include sampling error. Context is area-level, never person-level." : "Portable project evidence only."}</small>
        </section>
      </div>
    </aside>
  );
}

function getSelectionFacts(properties: Readonly<Record<string, unknown>>) {
  const candidates = [
    ["Access score", properties.totalScore],
    ["Median rent", typeof properties.medianGrossRent === "number" ? `$${properties.medianGrossRent}` : undefined],
    ["Rent burden", typeof properties.rentBurdenPercent === "number" ? `${properties.rentBurdenPercent}%` : undefined],
    ["Capacity", properties.capacity],
    ["Travel time", typeof properties.minutes === "number" ? `${properties.minutes} min` : undefined],
  ] as const;
  const facts = candidates.filter((entry) => entry[1] !== undefined && entry[1] !== null).slice(0, 2)
    .map(([label, value]) => ({label, value: String(value)}));
  return facts.length ? facts : [{label: "Evidence ID", value: String(properties.geoid ?? properties.id ?? "Selected")}];
}

function RecoveryScreen({contextLost}: {contextLost: boolean}) {
  return <main className="recovery-screen" role="alert"><p className="eyebrow">MapGap V3 recovery</p><h1>{contextLost ? "The map graphics context was lost." : "This browser cannot start the comparison canvas."}</h1><p>The portable project is unchanged. Continue in V2 while the graphics surface recovers.</p><a className="handoff-link" href={V2_HANDOFF_URL}>Open V2</a></main>;
}

function useElementSize() {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState(() => ({
    width: typeof window === "undefined" ? 960 : Math.max(320, window.innerWidth),
    height: typeof window === "undefined" ? 640 : Math.max(480, window.innerHeight - 68),
  }));
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({width: Math.max(320, Math.round(rect.width)), height: Math.max(480, Math.round(rect.height))});
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function supportsWebGl() {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch { return false; }
}

function getInitialPreset(): PresetId {
  if (typeof window === "undefined") return "civic";
  return window.location.hash === "#relocation" ? "relocation" : "civic";
}

type MapLibreLike = {
  getStyle?: () => {sources?: Record<string, unknown>};
  isStyleLoaded?: () => boolean;
  areTilesLoaded?: () => boolean;
  getCenter?: () => {lng: number; lat: number};
  getZoom?: () => number;
  zoomIn?: (options?: {duration?: number}) => void;
  zoomOut?: (options?: {duration?: number}) => void;
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
};

type CameraState = {longitude: number; latitude: number; zoom: number};

function cameraDelta(cameras: Record<number, CameraState>) {
  const left = cameras[0];
  const right = cameras[1];
  if (!left || !right) return 0;
  return Math.max(
    Math.abs(left.longitude - right.longitude),
    Math.abs(left.latitude - right.latitude),
    Math.abs(left.zoom - right.zoom),
  );
}
