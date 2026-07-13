import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {
  MAPGAP_ANALYSIS_DATASET_IDS,
  MAPGAP_DATASET_IDS,
  analysisBundleUsage,
  type AnalysisFeatureCollectionV1,
  type MapGapAnalysisBundleV1,
  type MapGapProjectV1,
} from "@mapgap/project-contract";
import {getComparisonAnalysisBundleFixture} from "@mapgap/project-contract/analysis-fixtures";
import {getCivicCapacityProjectFixture, getRelocationProjectFixture} from "@mapgap/project-contract/fixtures";
import type {IntelligenceFieldV1, IntelligenceGeometryTypeV1} from "@mapgap/project-contract/intelligence";
import {
  assertIntelligenceViewV1,
  type MapGapIntelligenceViewV1,
} from "@mapgap/project-contract/intelligence";
import {
  analysisBundleToRenderDatasets,
  findAnalysisFeature,
  getInitialSelection,
  type CanonicalSelection,
} from "./adapters/analysis-to-datasets";
import {projectToDatasets, projectToEvidenceSummary} from "./adapters/project-to-datasets";
import {
  V2_READY_SCHEMA,
  validateV2ContextEvent,
  type V2Context,
} from "./bridge/v2-context";
import {
  isPickableMark,
  type IntelligenceLayerState,
  type IntelligenceSource,
  type RenderCollection,
} from "./map/intelligence-layers";
import {IntelligenceMap} from "./map/IntelligenceMap";
import {IntelligenceErrorBoundary} from "./runtime/IntelligenceErrorBoundary";
import {makePortableIntelligenceView} from "./intelligence-view";
import {countGeoJsonCoordinatePairs, qualifyComparisonViewport, selectScaleStrategy} from "./scale";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

type PresetId = "civic" | "relocation";
type FocusSurface = "mapgap" | "intelligence";

const V2_URL = safeV2Url(import.meta.env.VITE_MAPGAP_V2_URL || "https://mapgap-access.netlify.app/v2");
const V2_ORIGIN = new URL(V2_URL).origin;

const PRESETS: Record<PresetId, {label: string; question: string; getProject: () => MapGapProjectV1}> = {
  civic: {label: "Civic + housing", question: "Where do capacity and housing pressure compound access gaps?", getProject: getCivicCapacityProjectFixture},
  relocation: {label: "Relocation", question: "Which location works when daily life and context are considered together?", getProject: getRelocationProjectFixture},
};

type WorkspaceSession = {
  presetId: PresetId;
  project: MapGapProjectV1;
  analysisBundle: MapGapAnalysisBundleV1;
  sources: IntelligenceSource[];
  layerMetadata: IntelligenceLayerState[];
  view: MapGapIntelligenceViewV1;
  selection: CanonicalSelection;
};

function createWorkspaceSession(presetId: PresetId): WorkspaceSession {
  const project = PRESETS[presetId].getProject();
  const analysisBundle = getComparisonAnalysisBundleFixture(presetId);
  const housingFailed = presetId === "civic"
    && new URLSearchParams(location.search).get("failSource") === "housing";
  const {sources, initialLayers} = createWorkspaceModel(
    presetId,
    project,
    analysisBundle,
    housingFailed,
  );
  const selection = getInitialSelection(project);
  const view = makePortableIntelligenceView({
    id: `mapgap-v3-${presetId}`,
    title: PRESETS[presetId].question,
    sources,
    layers: initialLayers,
    selection,
    linkedToV2: true,
    viewport: presetId === "civic"
      ? {longitude: -73.778, latitude: 42.668, zoom: 11.2, bearing: 0, pitch: 0}
      : {longitude: -74.075, latitude: 40.7255, zoom: 11.1, bearing: 0, pitch: 0},
  });
  return {presetId, project, analysisBundle, sources, layerMetadata: initialLayers, view, selection};
}

function resolveRuntimeLayers(
  view: MapGapIntelligenceViewV1,
  metadata: IntelligenceLayerState[],
): IntelligenceLayerState[] {
  return [...view.layers]
    .sort((left, right) => left.order - right.order)
    .flatMap((portable) => {
      const source = metadata.find((entry) => entry.id === portable.id);
      if (!source) return [];
      const minimum = portable.filters.find((entry) => entry.operator === "gte");
      const color = portable.encodings.color;
      const weight = portable.encodings.weight;
      return [{
        ...source,
        mark: portable.mark as IntelligenceLayerState["mark"],
        visible: portable.visible,
        opacity: portable.opacity,
        colorField: color?.kind === "field" ? color.field : undefined,
        weightField: weight?.kind === "field" ? weight.field : undefined,
        filterField: minimum?.field,
        filterValue: minimum && minimum.operator === "gte" && typeof minimum.value === "number"
          ? minimum.value
          : source.filterValue,
        legend: {...source.legend, title: portable.legend.title},
      }];
    });
}

function cloneView(view: MapGapIntelligenceViewV1): MapGapIntelligenceViewV1 {
  return JSON.parse(JSON.stringify(view)) as MapGapIntelligenceViewV1;
}

export default function ComparisonWorkbench() {
  const [session, setSession] = useState(() => createWorkspaceSession(
    location.hash === "#relocation" ? "relocation" : "civic",
  ));
  const [focus, setFocus] = useState<FocusSurface>("mapgap");
  const [shellRef, size] = useElementSize();
  const qualification = qualifyComparisonViewport({
    width: size.width,
    height: size.height,
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  });
  const wide = qualification.mode === "dual" && size.height >= 620;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const revisionRef = useRef(0);
  const v2SelectedPointRef = useRef<string | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [v2Context, setV2Context] = useState<V2Context | null>(null);
  const {presetId, project, analysisBundle, sources, layerMetadata, view: portableView, selection} = session;
  const layers = useMemo(
    () => resolveRuntimeLayers(portableView, layerMetadata),
    [layerMetadata, portableView],
  );
  const activeLayerId = portableView.workspace.activeLayerId ?? layers[0]?.id ?? "";
  const panelOpen = portableView.workspace.layerPanel === "open";
  const cameraLinked = portableView.link?.mode !== "none";

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin === V2_ORIGIN && event.source === iframeRef.current?.contentWindow && isReadyMessage(event.data)) {
        // A framed V2 navigation starts a fresh publisher whose revisions begin
        // at one. Reset the previous document's epoch before accepting context.
        revisionRef.current = 0;
        setV2Context(null);
        setBridgeReady(true);
        if (v2SelectedPointRef.current) {
          v2SelectedPointRef.current = null;
          restoreProjectSelection();
        }
        return;
      }
      const result = validateV2ContextEvent({event, expectedOrigin: V2_ORIGIN, expectedSource: iframeRef.current?.contentWindow ?? null, lastRevision: revisionRef.current});
      if (!result.ok) return;
      revisionRef.current = result.value.revision;
      setV2Context(result.value.context);
      const selected = result.value.context.selectedPointId;
      if (selected) {
        const point = result.value.context.servicePoints.find((entry) => entry.id === selected);
        if (point) {
          v2SelectedPointRef.current = selected;
          selectEntity({
            id: point.id,
            label: point.name,
            datasetId: "mapgap-v2-live-service-points",
            geometry: {type: "Point", coordinates: [point.location.lng, point.location.lat]},
            properties: {id: point.id, name: point.name, category: point.category, source: point.source, address: point.address ?? null},
          });
        } else if (v2SelectedPointRef.current) {
          v2SelectedPointRef.current = null;
          restoreProjectSelection();
        }
      } else if (v2SelectedPointRef.current) {
        v2SelectedPointRef.current = null;
        restoreProjectSelection();
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  function selectPreset(next: PresetId) {
    if (next === presetId) return;
    setSession((current) => {
      const nextSession = createWorkspaceSession(next);
      nextSession.view.link = current.view.link ? {...current.view.link} : undefined;
      return {...nextSession, view: assertIntelligenceViewV1(nextSession.view)};
    });
    history.replaceState(null, "", `${location.pathname}${location.search}#${next}`);
  }

  function updateLayer(id: string, update: Partial<IntelligenceLayerState>) {
    setSession((current) => {
      const view = cloneView(current.view);
      const layer = view.layers.find((entry) => entry.id === id);
      const metadata = current.layerMetadata.find((entry) => entry.id === id);
      if (!layer || !metadata) return current;
      if (typeof update.visible === "boolean") layer.visible = update.visible;
      if (typeof update.opacity === "number") {
        layer.opacity = update.opacity;
        layer.encodings.opacity = {kind: "value", value: update.opacity};
      }
      if (update.mark && metadata.supportedMarks.includes(update.mark)) {
        layer.mark = update.mark;
        layer.pickable = isPickableMark(update.mark);
        layer.selectable = isPickableMark(update.mark);
        if (!layer.selectable && view.activeSelection?.layerId === layer.id) {
          delete view.activeSelection.layerId;
        }
      }
      if (typeof update.filterValue === "number") {
        const filter = layer.filters.find((entry) => entry.operator === "gte");
        if (filter && filter.operator === "gte") filter.value = update.filterValue;
      }
      return {...current, view: assertIntelligenceViewV1(view)};
    });
  }

  function moveLayer(id: string, direction: -1 | 1) {
    setSession((current) => {
      const view = cloneView(current.view);
      const ordered = [...view.layers].sort((left, right) => left.order - right.order);
      const index = ordered.findIndex((entry) => entry.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return current;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      ordered.forEach((entry, order) => { entry.order = order; });
      view.layers = ordered;
      return {...current, view: assertIntelligenceViewV1(view)};
    });
  }

  function setActiveLayerId(id: string) {
    updatePortableView((view) => { view.workspace.activeLayerId = id; });
  }

  function setPanelOpen(open: boolean) {
    updatePortableView((view) => { view.workspace.layerPanel = open ? "open" : "closed"; });
  }

  function setCameraLinked(linked: boolean) {
    updatePortableView((view) => {
      view.link = {target: "mapgap-v2", mode: linked ? "camera" : "none", direction: "from-target"};
    });
  }

  function setIntelligenceViewport(viewport: NonNullable<MapGapIntelligenceViewV1["viewport"]>) {
    updatePortableView((view) => { view.viewport = viewport; });
  }

  function updatePortableView(update: (view: MapGapIntelligenceViewV1) => void) {
    setSession((current) => {
      const view = cloneView(current.view);
      update(view);
      return {...current, view: assertIntelligenceViewV1(view)};
    });
  }

  function selectEntity(next: CanonicalSelection) {
    setSession((current) => {
      const view = cloneView(current.view);
      const sourceExists = view.sources.some((source) => source.id === next.datasetId);
      if (sourceExists) {
        view.activeSelection = {
          sourceId: next.datasetId,
          entityId: next.id,
          layerId: view.layers.find((layer) => layer.sourceId === next.datasetId)?.id,
        };
      } else {
        delete view.activeSelection;
      }
      return {...current, selection: next, view: assertIntelligenceViewV1(view)};
    });
  }

  function restoreProjectSelection() {
    setSession((current) => {
      const selection = getInitialSelection(current.project);
      const view = cloneView(current.view);
      const sourceExists = view.sources.some((source) => source.id === selection.datasetId);
      if (sourceExists) {
        view.activeSelection = {
          sourceId: selection.datasetId,
          entityId: selection.id,
          layerId: view.layers.find((layer) => layer.sourceId === selection.datasetId)?.id,
        };
      } else {
        delete view.activeSelection;
      }
      return {...current, selection, view: assertIntelligenceViewV1(view)};
    });
  }

  function resetBridgeForFrameLoad() {
    revisionRef.current = 0;
    setBridgeReady(false);
    setV2Context(null);
    if (v2SelectedPointRef.current) {
      v2SelectedPointRef.current = null;
      restoreProjectSelection();
    }
  }

  const intelligence = (
    <IntelligenceErrorBoundary resetKey={presetId}><IntelligenceWorkbench
      presetId={presetId}
      question={PRESETS[presetId].question}
      sources={sources}
      layers={layers}
      selection={selection}
      activeLayerId={activeLayerId}
      setActiveLayerId={setActiveLayerId}
      panelOpen={panelOpen}
      setPanelOpen={setPanelOpen}
      cameraLinked={cameraLinked}
      setCameraLinked={setCameraLinked}
      linkedBbox={cameraLinked ? v2Context?.bbox ?? null : null}
      viewport={portableView.viewport!}
      setViewport={setIntelligenceViewport}
      bridgeReady={bridgeReady}
      context={v2Context}
      onSelect={selectEntity}
      updateLayer={updateLayer}
      moveLayer={moveLayer}
      project={project}
      analysisBundle={analysisBundle}
    /></IntelligenceErrorBoundary>
  );

  return (
    <main
      ref={shellRef}
      className={`v3-shell ${wide ? "is-split" : "is-focus"}`}
      data-testid="v3-shell"
      data-intelligence-schema={portableView.schemaVersion}
      data-intelligence-viewport={portableView.viewport ? [portableView.viewport.longitude, portableView.viewport.latitude, portableView.viewport.zoom].map((value) => value.toFixed(5)).join(",") : ""}
    >
      <header className="app-header">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">M</span><div><span>MapGap V3</span><strong>Access × Intelligence</strong></div></div>
        <nav aria-label="Decision story" className="scenario-tabs">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => <button key={id} type="button" aria-pressed={presetId === id} onClick={() => selectPreset(id)}>{PRESETS[id].label}</button>)}
        </nav>
        <span className="alpha-badge">Direct-stack alpha</span>
      </header>

      {!wide && <nav className="surface-switch" aria-label="Workspace surface">
        <button type="button" aria-pressed={focus === "mapgap"} onClick={() => setFocus("mapgap")}>MapGap</button>
        <button type="button" aria-pressed={focus === "intelligence"} onClick={() => setFocus("intelligence")}>Intelligence</button>
      </nav>}

      <section className="workspace" aria-label="MapGap V3 workspace" data-layout={wide ? "split" : `focus-${focus}`} data-testid="comparison-layout">
        <div className={!wide && focus !== "mapgap" ? "preserved-surface is-hidden" : "preserved-surface"} aria-hidden={!wide && focus !== "mapgap"}>
          <V2Surface iframeRef={iframeRef} bridgeReady={bridgeReady} onFrameLoad={resetBridgeForFrameLoad} />
        </div>
        {(wide || focus === "intelligence") && intelligence}
      </section>
      <span className="sr-only" data-testid="surface-mount-count">{wide ? 2 : 1} heavyweight surface mounted</span>
    </main>
  );
}

function V2Surface({iframeRef, bridgeReady, onFrameLoad}: {iframeRef: React.RefObject<HTMLIFrameElement | null>; bridgeReady: boolean; onFrameLoad: () => void}) {
  return <section className="surface v2-surface" data-testid="v2-surface">
    <header className="surface-header"><div><span>01 · Primary experience</span><h1>MapGap V2</h1></div><p>Search · Walk/Drive heat · routes · evidence</p><a href={V2_URL} target="_blank" rel="noreferrer">Open alone ↗</a></header>
    <iframe
      ref={iframeRef}
      onLoad={onFrameLoad}
      className="v2-frame"
      src={V2_URL}
      title="MapGap V2 access map"
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
      allow="clipboard-write; geolocation 'none'; camera 'none'; microphone 'none'"
      referrerPolicy="strict-origin-when-cross-origin"
    />
    <span className={`bridge-indicator ${bridgeReady ? "ready" : "waiting"}`} role="status"><i />{bridgeReady ? "Context bridge ready" : "V2 independent · awaiting context"}</span>
  </section>;
}

function IntelligenceWorkbench(props: {
  presetId: PresetId;
  question: string;
  sources: IntelligenceSource[];
  layers: IntelligenceLayerState[];
  selection: CanonicalSelection;
  activeLayerId: string;
  setActiveLayerId: (id: string) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  cameraLinked: boolean;
  setCameraLinked: (linked: boolean) => void;
  linkedBbox: [number, number, number, number] | null;
  viewport: NonNullable<MapGapIntelligenceViewV1["viewport"]>;
  setViewport: (viewport: NonNullable<MapGapIntelligenceViewV1["viewport"]>) => void;
  bridgeReady: boolean;
  context: V2Context | null;
  onSelect: (selection: CanonicalSelection) => void;
  updateLayer: (id: string, update: Partial<IntelligenceLayerState>) => void;
  moveLayer: (id: string, direction: -1 | 1) => void;
  project: MapGapProjectV1;
  analysisBundle: MapGapAnalysisBundleV1;
}) {
  const {sources, layers, selection} = props;
  const activeLayer = layers.find((entry) => entry.id === props.activeLayerId) ?? layers[0];
  const activeSource = sources.find((entry) => entry.id === activeLayer?.sourceId);
  const visibleCount = layers.filter((layer) => layer.visible && sources.find((source) => source.id === layer.sourceId)?.status === "ready").length;
  const evidence = projectToEvidenceSummary(props.project);
  const usage = analysisBundleUsage(props.analysisBundle);

  return <section className="surface intelligence-surface" data-testid="intelligence-surface">
    <header className="surface-header intelligence-header">
      <div><span>02 · Context workbench</span><h1>Location intelligence</h1></div>
      <p>{props.question}</p>
      <div className="intelligence-actions">
        <button type="button" aria-pressed={props.cameraLinked && props.bridgeReady} onClick={() => props.setCameraLinked(!props.cameraLinked)}>{props.cameraLinked ? props.bridgeReady ? "Linked to V2" : "Link V2 when ready" : "Independent camera"}</button>
        <button type="button" aria-expanded={props.panelOpen} onClick={() => props.setPanelOpen(!props.panelOpen)}>Layers {visibleCount}/{layers.length}</button>
      </div>
    </header>
    <div className="intelligence-body">
      <IntelligenceMap sources={sources} layers={layers} selection={selection} onSelect={props.onSelect} linkedBbox={props.linkedBbox} presetId={props.presetId} viewport={props.viewport} onViewportChange={props.setViewport} />

      {props.panelOpen && <aside className="control-panel" aria-label="Intelligence controls" data-testid="intelligence-controls">
        <section className="source-tray"><header><div><span>Source tray</span><strong>{sources.filter((source) => source.status === "ready").length} connected</strong></div><small>Failures remain isolated</small></header>
          <div className="source-list">{sources.map((source) => <button type="button" key={source.id} className={activeSource?.id === source.id ? "active" : ""} onClick={() => {
            const layer = layers.find((entry) => entry.sourceId === source.id);
            if (layer) props.setActiveLayerId(layer.id);
          }}><i className={source.status} /><span><strong>{source.label}</strong><small>{source.status === "ready" ? `${source.data?.features.length ?? 0} features` : source.error}</small></span></button>)}</div>
        </section>

        <section className="layer-registry"><header><span>Layer registry</span><strong>{visibleCount} overlays visible</strong></header>
          <ol>{layers.map((layer, index) => <li key={layer.id} className={activeLayer?.id === layer.id ? "active" : ""}>
            <button className="layer-name" type="button" onClick={() => props.setActiveLayerId(layer.id)}><span className="order-number">{index + 1}</span><span><strong>{layer.label}</strong><small>{layer.mark}</small></span></button>
            <div className="layer-actions">
              <button type="button" aria-label={`Move ${layer.label} up`} disabled={index === 0} onClick={() => props.moveLayer(layer.id, -1)}>↑</button>
              <button type="button" aria-label={`Move ${layer.label} down`} disabled={index === layers.length - 1} onClick={() => props.moveLayer(layer.id, 1)}>↓</button>
              <label className="visibility"><input type="checkbox" checked={layer.visible} onChange={(event) => props.updateLayer(layer.id, {visible: event.target.checked})}/><span>Show</span></label>
            </div>
          </li>)}</ol>
        </section>

        {activeLayer && activeSource && <section className="layer-editor" data-testid="layer-editor">
          <header><span>Style + filter</span><strong>{activeLayer.label}</strong></header>
          <label>Visualization<select value={activeLayer.mark} onChange={(event) => props.updateLayer(activeLayer.id, {mark: event.target.value as IntelligenceLayerState["mark"]})}>{activeLayer.supportedMarks.map((mark) => <option key={mark} value={mark}>{markLabel(mark)}</option>)}</select></label>
          <label>Opacity <output>{Math.round(activeLayer.opacity * 100)}%</output><input type="range" min="0.1" max="1" step="0.05" value={activeLayer.opacity} onChange={(event) => props.updateLayer(activeLayer.id, {opacity: Number(event.target.value)})}/></label>
          {activeLayer.filterField && <label>Minimum {fieldLabel(activeLayer.filterField)} <output>{activeLayer.filterValue}</output><input type="range" min={activeLayer.filterMin} max={activeLayer.filterMax} step="1" value={activeLayer.filterValue} onChange={(event) => props.updateLayer(activeLayer.id, {filterValue: Number(event.target.value)})}/></label>}
          <div className="legend"><span style={{background: `linear-gradient(90deg, ${activeLayer.legend.colors.join(",")})`}}/><div><small>{activeLayer.legend.low}</small><strong>{activeLayer.legend.title}</strong><small>{activeLayer.legend.high}</small></div></div>
        </section>}

        {activeSource && <details className="provenance" open><summary>Provenance</summary><dl><div><dt>Publisher</dt><dd>{activeSource.provenance.publisher}</dd></div><div><dt>Vintage</dt><dd>{activeSource.provenance.vintage}</dd></div><div><dt>License</dt><dd>{activeSource.provenance.license}</dd></div></dl><p>{activeSource.provenance.note}</p></details>}
      </aside>}

      <aside className="selection-card" aria-label="Shared selection" data-testid="shared-selection"><span>Shared selection</span><strong>{selection.label}</strong><p>{selectionSummary(selection)}</p></aside>
      <div className="map-status" role="status"><span>{visibleCount} overlays</span><span>{props.context ? `${props.context.heatmapMode} context · rev ${props.context.selectedPointId ? "selected" : "live"}` : props.bridgeReady ? "Waiting for V2 viewport" : "Fixture extent"}</span><span>{evidence.totalCapacity || evidence.candidateCount} decision records · {usage.datasets} analysis datasets</span></div>
    </div>
  </section>;
}

function createWorkspaceModel(presetId: PresetId, project: MapGapProjectV1, bundle: MapGapAnalysisBundleV1, housingFailed: boolean) {
  const projectDatasets = new Map(projectToDatasets(project).map((entry) => [entry.id, entry]));
  const analysisDatasets = new Map(analysisBundleToRenderDatasets(bundle).map((entry) => [entry.id, entry]));
  const projectSource = (id: string, label: string, description: string, geometry: "point" | "area"): IntelligenceSource => {
    const dataset = projectDatasets.get(id as never);
    const first = dataset?.featureCollection.features[0]?.properties;
    const data = (dataset?.featureCollection ?? null) as RenderCollection | null;
    const schema = describeCollection(data, geometry);
    const scale = qualifyInlineCollection(data);
    return {
      id,
      label,
      description,
      geometry,
      data: scale.ready ? data : null,
      reference: {kind: "project-dataset", datasetId: id},
      ...schema,
      status: dataset && scale.ready ? "ready" : "failed",
      error: dataset ? scale.error : "Source not present",
      provenance: {publisher: String(first?.provenanceLabel ?? "MapGap portable project"), vintage: String(first?.provenanceUpdatedAt ?? "Project fixture"), license: "Portable project terms", note: "Decision evidence remains independent from contextual scoring."},
    };
  };
  const analysisSource = (id: string, label: string, description: string): IntelligenceSource => {
    const dataset = analysisDatasets.get(id);
    const provenance = dataset?.provenance;
    const firstSource = provenance?.sources[0];
    const failed = housingFailed && id === MAPGAP_ANALYSIS_DATASET_IDS.housingAreas;
    const data = dataset ? dataset.featureCollection as RenderCollection : null;
    const scale = qualifyInlineCollection(data);
    return {
      id,
      label,
      description,
      geometry: "area",
      data: !failed && scale.ready ? data : null,
      reference: {kind: "analysis-dataset", datasetId: id},
      fields: dataset?.fields.map((field) => ({name: field.name, label: field.label, type: field.type, nullable: field.nullable})) ?? [],
      geometryTypes: dataset?.geometryTypes as IntelligenceGeometryTypeV1[] ?? ["Polygon"],
      status: failed || !dataset || !scale.ready ? "failed" : "ready",
      error: failed ? "Housing source unavailable" : !dataset ? "Source not attached" : scale.error,
      provenance: {publisher: firstSource?.publisher ?? "MapGap", vintage: formatVintage(firstSource?.vintage), license: firstSource?.license.name ?? "Unknown", note: provenance?.caveat ?? "Area context is not a routed-access claim."},
    };
  };

  if (presetId === "civic") {
    const sources = [
      analysisSource(MAPGAP_ANALYSIS_DATASET_IDS.housingAreas, "Housing context", "ACS measures joined to TIGER tracts"),
      projectSource(MAPGAP_DATASET_IDS.assets, "Civic capacity", "Facilities, capacity and utilization", "point"),
      projectSource(MAPGAP_DATASET_IDS.underserved, "Underserved proxy", "Deterministic service-gap evidence", "area"),
    ];
    const initialLayers: IntelligenceLayerState[] = [
      layer("housing-burden", sources[0], "Rent burden", "choropleth", ["choropleth"], "rentBurdenPercent", undefined, "rentBurdenPercent", 0, 65, 0, ["Lower", "Higher"]),
      layer("civic-capacity", sources[1], "Facility capacity", "symbol", ["symbol", "heat", "hex", "grid", "h3"], "capacity", "capacity", "capacity", 0, 60, 0, ["Lower", "Higher"]),
      layer("underserved-proxy", sources[2], "Underserved proxy", "choropleth", ["choropleth"], "underservedScore", undefined, "underservedScore", 0, 100, 0, ["Served", "Underserved"]),
    ];
    return {sources, initialLayers};
  }
  const sources = [
    projectSource(MAPGAP_DATASET_IDS.candidates, "Candidate decisions", "Scored relocation candidates", "point"),
    projectSource(MAPGAP_DATASET_IDS.pois, "Nearby places", "Daily-life OpenStreetMap evidence", "point"),
    projectSource(MAPGAP_DATASET_IDS.points, "Profile anchors", "Work and household anchors", "point"),
  ];
  const initialLayers: IntelligenceLayerState[] = [
    layer("relocation-candidates", sources[0], "Candidate score", "symbol", ["symbol", "heat", "hex", "grid", "h3"], "totalScore", "totalScore", "totalScore", 0, 100, 0, ["Low", "High"]),
    layer("nearby-places", sources[1], "Nearby-place density", "heat", ["symbol", "heat", "hex", "grid", "h3"], undefined, undefined, undefined, 0, 1, 0, ["Sparse", "Dense"]),
    layer("profile-anchors", sources[2], "Profile anchors", "symbol", ["symbol", "heat", "hex", "grid", "h3"], undefined, undefined, undefined, 0, 1, 0, ["Anchor", "Anchor"]),
  ];
  return {sources, initialLayers};
}

function layer(id: string, source: IntelligenceSource, label: string, mark: IntelligenceLayerState["mark"], supportedMarks: IntelligenceLayerState["supportedMarks"], colorField: string | undefined, weightField: string | undefined, filterField: string | undefined, filterMin: number, filterMax: number, filterValue: number, labels: [string, string]): IntelligenceLayerState {
  return {id, sourceId: source.id, label, mark, supportedMarks, visible: true, opacity: .76, colorField, weightField, filterField, filterMin, filterMax, filterValue, legend: {title: label, low: labels[0], high: labels[1], colors: ["#bff2e8", "#be3048"]}};
}

function formatVintage(value: MapGapAnalysisBundleV1["datasets"][number]["provenance"]["sources"][number]["vintage"] | undefined) {
  if (!value) return "Unknown";
  return value.kind === "as-of" ? value.date : `${value.startYear}–${value.endYear}`;
}

function fieldLabel(field: string) {
  return field.replace(/([A-Z])/g, " $1").toLowerCase();
}

function markLabel(mark: IntelligenceLayerState["mark"]) {
  return ({choropleth: "Choropleth", symbol: "Proportional symbols", heat: "Density heat", hex: "Hex aggregation", grid: "Grid aggregation", h3: "Stable H3 cells", isochrone: "Routed isochrone", path: "Route path", trip: "Temporal trip"})[mark];
}

function selectionSummary(selection: CanonicalSelection) {
  const properties = selection.properties;
  const facts = [properties.totalScore !== undefined ? `Score ${properties.totalScore}/100` : null, properties.capacity !== undefined ? `${properties.capacity} capacity` : null, properties.rentBurdenPercent !== undefined ? `${properties.rentBurdenPercent}% rent burden` : null, properties.source ? `Source ${properties.source}` : null].filter(Boolean);
  return facts.join(" · ") || selection.datasetId;
}

function describeCollection(data: RenderCollection | null, fallback: "point" | "area") {
  const values = new Map<string, unknown[]>();
  const geometryTypes = new Set<IntelligenceGeometryTypeV1>();
  for (const feature of data?.features ?? []) {
    const geometryType = feature.geometry.type as IntelligenceGeometryTypeV1;
    if (["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"].includes(geometryType)) {
      geometryTypes.add(geometryType);
    }
    for (const [key, value] of Object.entries(feature.properties ?? {})) {
      if (value === null || value === undefined || typeof value === "object") continue;
      const entries = values.get(key) ?? [];
      entries.push(value);
      values.set(key, entries);
    }
  }
  if (!geometryTypes.size) geometryTypes.add(fallback === "point" ? "Point" : "Polygon");
  const featureCount = data?.features.length ?? 0;
  const fields: IntelligenceFieldV1[] = [...values.entries()].map(([name, entries]) => ({
    name,
    label: fieldLabel(name),
    type: entries.every((value) => typeof value === "number" && Number.isInteger(value))
      ? "integer"
      : entries.every((value) => typeof value === "number")
        ? "number"
        : entries.every((value) => typeof value === "boolean")
          ? "boolean"
          : "string",
    nullable: entries.length !== featureCount,
  }));
  return {fields, geometryTypes: [...geometryTypes]};
}

function qualifyInlineCollection(data: RenderCollection | null): {ready: boolean; error?: string} {
  if (!data) return {ready: false, error: "Source not attached"};
  const serialized = JSON.stringify(data);
  const strategy = selectScaleStrategy({
    featureCount: data.features.length,
    byteCount: new TextEncoder().encode(serialized).byteLength,
    coordinateCount: countGeoJsonCoordinatePairs(data),
  });
  return strategy.kind === "direct-geojson"
    ? {ready: true}
    : {ready: false, error: strategy.kind === "arrow-or-query" ? "Source requires the query/Arrow adapter" : "Source requires the tiled adapter"};
}

function isReadyMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2 && record.schema === V2_READY_SCHEMA && record.contextSchema === "mapgap.v2.context/v1";
}

function safeV2Url(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.origin !== "https://mapgap-access.netlify.app" || url.pathname !== "/v2" || url.search || url.hash) throw new Error("VITE_MAPGAP_V2_URL must be the approved MapGap V2 route.");
  return url.href.replace(/\/$/, "");
}

function useElementSize() {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState({width: innerWidth, height: innerHeight});
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => { const rect = element.getBoundingClientRect(); setSize({width: rect.width, height: rect.height}); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
