import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDataToMap, mapStyleChange, removeDataset, wrapTo } from "@kepler.gl/actions";
import { KeplerGl } from "@kepler.gl/components";
import { useDispatch } from "react-redux";
import {
  getCivicCapacityProjectFixture,
  getRelocationProjectFixture,
} from "@mapgap/project-contract/fixtures";
import type { MapGapProjectV1 } from "@mapgap/project-contract";
import { MAPGAP_DATASET_IDS } from "@mapgap/project-contract";
import { projectToEvidenceSummary, projectToKeplerDatasets } from "./adapters/project-to-datasets";
import {
  TOKEN_FREE_MAP_STYLE_ID,
  TOKEN_FREE_MAP_STYLES,
} from "./map/token-free-style";
import { getStoryLayers, getStoryMapConfig } from "./map/story-config";
import "./styles.css";

const KEPLER_ID = "mapgap-v3-alpha";
const V2_HANDOFF_URL = import.meta.env.VITE_MAPGAP_V2_URL || "https://mapgap-access.netlify.app/v2";
const BASEMAP_LOAD_TIMEOUT_MS = 12_000;

const HIDDEN_MAP_CONTROLS = Object.fromEntries(
  ["visibleLayers", "mapLegend", "toggle3d", "splitMap", "mapDraw", "mapLocale", "effect", "annotation", "aiAssistant"].map(
    (control) => [control, { show: false, active: false, disableClose: false, activeMapIndex: 0 }],
  ),
);

const MAPGAP_UI_STATE = {
  mapControls: {
    ...HIDDEN_MAP_CONTROLS,
    mapLegend: { ...HIDDEN_MAP_CONTROLS.mapLegend, disableEdit: true },
  },
};

type PresetId = "relocation" | "civic";

type PresetDefinition = {
  label: string;
  shortLabel: string;
  question: string;
  detail: string;
  outcome: string;
  outcomeDetail: string;
  getProject: () => MapGapProjectV1;
};

const PRESETS: Record<PresetId, PresetDefinition> = {
  relocation: {
    label: "Relocation: routed access vs proximity",
    shortLabel: "Relocation",
    question: "Which candidate actually works?",
    detail: "Compare a nearby candidate that fails the routed commute constraint with a lower-proximity candidate that passes.",
    outcome: "Routed access changes the winner.",
    outcomeDetail: "The 87/100 candidate passes the fixture commute boundary; the closer 42/100 candidate does not.",
    getProject: getRelocationProjectFixture,
  },
  civic: {
    label: "Civic: capacity and underserved proxy",
    shortLabel: "Civic access",
    question: "Where does service fall short?",
    detail: "Inspect facilities by capacity and utilization, routed service reach, and a transparent underserved-capacity proxy.",
    outcome: "The east corridor sits outside current reach.",
    outcomeDetail: "Two fixture assets provide 72 places, while the highlighted area has zero reachable capacity at 15 minutes.",
    getProject: getCivicCapacityProjectFixture,
  },
};

export default function App() {
  const dispatch = useDispatch();
  const [presetId, setPresetId] = useState<PresetId>(() => getInitialPreset());
  const [keplerReady, setKeplerReady] = useState(false);
  const [basemapReady, setBasemapReady] = useState(false);
  const [basemapError, setBasemapError] = useState(false);
  const [mapViewport, setMapViewport] = useState<{ longitude: number; latitude: number; zoom: number } | null>(null);
  const [webglLost, setWebglLost] = useState(false);
  const [status, setStatus] = useState("Preparing map evidence…");
  const [mapContainerRef, mapSize] = useElementSize();
  const webglSupported = supportsWebGl();
  const preset = PRESETS[presetId];
  const project = useMemo(() => preset.getProject(), [preset]);
  const datasets = useMemo(() => projectToKeplerDatasets(project), [project]);
  const evidence = useMemo(() => projectToEvidenceSummary(project), [project]);
  const storyLayers = useMemo(() => getStoryLayers(presetId, project), [presetId, project]);
  const storyConfig = useMemo(() => getStoryMapConfig(presetId, project), [presetId, project]);
  const mapListenerCleanup = useRef<(() => void) | null>(null);
  const basemapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMap = useRef<MapLibreLike | null>(null);
  const mapStyleSelected = useRef(false);

  const captureMapRef = useCallback((mapRef: { getMap?: () => MapLibreLike } | null) => {
    // Ignore stale null ref callbacks so they cannot detach the active map.
    if (!mapRef?.getMap) return;

    const map = mapRef.getMap();
    if (currentMap.current === map) return;
    mapListenerCleanup.current?.();
    mapListenerCleanup.current = null;
    currentMap.current = map;
    const checkReady = () => {
      const hasBasemapSources = Object.keys(map.getStyle?.()?.sources ?? {}).length > 0;
      if (hasBasemapSources && map.isStyleLoaded?.() && map.areTilesLoaded?.()) {
        const center = map.getCenter?.();
        const zoom = map.getZoom?.();
        if (center && typeof zoom === "number") {
          setMapViewport({ longitude: center.lng, latitude: center.lat, zoom });
        }
        if (basemapTimeout.current) clearTimeout(basemapTimeout.current);
        basemapTimeout.current = null;
        setBasemapError(false);
        setBasemapReady(true);
      }
    };
    const handleMapError = () => {
      if (!map.isStyleLoaded?.()) {
        if (basemapTimeout.current) clearTimeout(basemapTimeout.current);
        basemapTimeout.current = null;
        setBasemapError(true);
      }
    };
    map.on?.("idle", checkReady);
    map.on?.("sourcedata", checkReady);
    map.on?.("error", handleMapError);
    checkReady();
    mapListenerCleanup.current = () => {
      map.off?.("idle", checkReady);
      map.off?.("sourcedata", checkReady);
      map.off?.("error", handleMapError);
      if (currentMap.current === map) currentMap.current = null;
    };
  }, []);

  useEffect(() => () => {
    mapListenerCleanup.current?.();
    if (basemapTimeout.current) clearTimeout(basemapTimeout.current);
  }, []);

  useEffect(() => {
    if (!keplerReady) return;

    setBasemapReady(false);
    setBasemapError(false);
    setMapViewport(null);
    if (basemapTimeout.current) clearTimeout(basemapTimeout.current);
    basemapTimeout.current = setTimeout(() => setBasemapError(true), BASEMAP_LOAD_TIMEOUT_MS);
    if (!mapStyleSelected.current) {
      dispatch(wrapTo(KEPLER_ID, mapStyleChange(TOKEN_FREE_MAP_STYLE_ID)));
      mapStyleSelected.current = true;
    }
    for (const dataId of Object.values(MAPGAP_DATASET_IDS)) {
      dispatch(wrapTo(KEPLER_ID, removeDataset(dataId)));
    }
    dispatch(
      wrapTo(
        KEPLER_ID,
        addDataToMap({
          datasets,
          options: {
            centerMap: true,
            readOnly: true,
            autoCreateLayers: false,
          },
          config: storyConfig,
          info: {
            title: project.scenario.label || project.scenario.id,
            description: "MapGap portable-project fixture rendered by the V3 alpha adapter.",
          },
        }),
      ),
    );
    setStatus(`${storyLayers.length} evidence layers mapped from ${datasets.length} canonical datasets.`);
  }, [datasets, dispatch, keplerReady, project.scenario.id, project.scenario.label, storyConfig, storyLayers.length]);

  useEffect(() => {
    const canvas = document.querySelector(".map-workbench canvas");
    if (!canvas) return;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglLost(true);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    return () => canvas.removeEventListener("webglcontextlost", handleContextLost);
  }, [keplerReady, presetId]);

  function selectPreset(nextPreset: PresetId) {
    if (nextPreset === presetId) return;
    setStatus("Switching portable project fixture…");
    setPresetId(nextPreset);
    window.history.replaceState(null, "", `#${nextPreset}`);
  }

  function zoomMap(direction: "in" | "out") {
    const options = { duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180 };
    if (direction === "in") currentMap.current?.zoomIn?.(options);
    else currentMap.current?.zoomOut?.(options);
  }

  if (!webglSupported || webglLost) {
    return <RecoveryScreen contextLost={webglLost} />;
  }

  return (
    <main className="v3-shell">
      <header className="v3-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <p className="eyebrow">Public alpha · read-only fixtures</p>
            <h1>MapGap <span>V3 Analyst</span></h1>
          </div>
        </div>
        <p className="header-copy">See the decision the route network changes.</p>
        <a className="handoff-link" href={V2_HANDOFF_URL}>Open focused V2 <span aria-hidden="true">↗</span></a>
      </header>

      <section className="analysis-layout">
        <section ref={mapContainerRef} className="map-workbench" aria-label="Interactive MapGap decision map" data-testid="map-workbench">
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
            appName="MapGap V3 Preview"
            onKeplerGlInitialized={() => setKeplerReady(true)}
          />

          {basemapError ? (
            <div className="map-error" role="alert" data-testid="basemap-error">
              <p className="map-question">Basemap unavailable</p>
              <h2>Your decision evidence is still safe.</h2>
              <p>The public map service did not respond. Retry the map or continue in the focused V2 experience.</p>
              <div>
                <button type="button" onClick={() => window.location.reload()}>Retry map</button>
                <a href={V2_HANDOFF_URL}>Open focused V2</a>
              </div>
            </div>
          ) : !basemapReady && (
            <div className="map-loading" aria-hidden="true">
              <span />
              <p>Loading streets, water, and place labels…</p>
            </div>
          )}

          <div className="map-title-card">
            <p className="map-question">{preset.question}</p>
            <h2>{preset.outcome}</h2>
            <p>{preset.outcomeDetail}</p>
          </div>

          <nav className="scenario-switcher" aria-label="V3 preview scenarios">
            {(Object.entries(PRESETS) as Array<[PresetId, PresetDefinition]>).map(([id, option]) => (
              <button
                key={id}
                className={id === presetId ? "scenario-button selected" : "scenario-button"}
                type="button"
                aria-label={option.label}
                aria-pressed={id === presetId}
                onClick={() => selectPreset(id)}
              >
                {option.shortLabel}
              </button>
            ))}
          </nav>

          <div className="map-navigation" aria-label="Map zoom controls">
            <button type="button" aria-label="Zoom in" onClick={() => zoomMap("in")}>+</button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomMap("out")}>−</button>
          </div>

          <MapLegend layers={storyLayers} project={project} />

          <p className="map-attribution" data-testid="map-attribution">
            <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>
            <span>·</span>
            <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a>
            <span>·</span>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Data from OpenStreetMap</a>
          </p>

          <span className="sr-only" role="status" data-testid="kepler-mounted">
            {keplerReady ? `Kepler workbench mounted. ${status}` : "Mounting Kepler workbench"}
          </span>
          <span className="sr-only" role="status" data-testid="basemap-ready">
            {basemapReady ? "Basemap tiles ready" : "Basemap tiles loading"}
          </span>
          <span
            className="sr-only"
            data-testid="map-viewport"
            data-longitude={mapViewport?.longitude}
            data-latitude={mapViewport?.latitude}
            data-zoom={mapViewport?.zoom}
          >
            {mapViewport ? "Map viewport fitted" : "Map viewport fitting"}
          </span>
        </section>

        <aside className="evidence-panel" aria-label="MapGap decision evidence">
          <div className="evidence-heading">
            <p className="panel-kicker">Portable project · {project.schemaVersion}</p>
            <h2>{preset.label}</h2>
            <p>{preset.detail}</p>
          </div>

          <DecisionMetrics presetId={presetId} evidence={evidence} />

          {presetId === "relocation" ? <RelocationEvidence project={project} /> : <CivicEvidence project={project} />}

          <details className="method-note">
            <summary>Method &amp; map sources</summary>
            <p>MapGap keeps routed polygons, capacity, scores, and provenance in the portable project. Kepler renders a read-only presentation; it does not become project truth.</p>
            <p>The basemap is OpenFreeMap Liberty with OpenStreetMap-derived data. It needs no API token. This public service has no SLA, so a production rollout should pin or self-host approved map assets.</p>
          </details>
        </aside>
      </section>
    </main>
  );
}

function DecisionMetrics({ presetId, evidence }: { presetId: PresetId; evidence: ReturnType<typeof projectToEvidenceSummary> }) {
  const metrics = presetId === "relocation"
    ? [
        { label: "Route passes", value: evidence.passedCandidateCount },
        { label: "Constraint fails", value: evidence.failedCandidateCount },
        evidence.unscoredCandidateCount
          ? { label: "Not scored", value: evidence.unscoredCandidateCount }
          : { label: "Walking boundary", value: "30 min" },
      ]
    : [
        { label: evidence.unknownCapacityCount ? "Known capacity" : "Total capacity", value: evidence.totalCapacity },
        { label: "Civic assets", value: evidence.assetCount },
        evidence.unknownCapacityCount
          ? { label: "Capacity unknown", value: evidence.unknownCapacityCount }
          : { label: "Reach gap", value: evidence.underservedAreaCount },
      ];

  return (
    <dl className="metric-grid">
      {metrics.map((metric) => <Metric key={metric.label} label={metric.label} value={metric.value} />)}
    </dl>
  );
}

function MapLegend({ layers, project }: { layers: ReturnType<typeof getStoryLayers>; project: MapGapProjectV1 }) {
  type LegendEntry = {id: string; label: string; kind: "point" | "polygon"; color: [number, number, number]; symbol?: string};
  const entries: LegendEntry[] = [];
  for (const layer of layers) {
    if (layer.id === "mapgap-relocation-candidates") {
      if (project.candidates.some((candidate) => candidate.score && candidate.score.failedConstraints.length === 0)) {
        entries.push({ id: `${layer.id}-pass`, label: "Passes route", kind: "point", color: [21, 122, 104], symbol: "✓" });
      }
      if (project.candidates.some((candidate) => candidate.score?.failedConstraints.length)) {
        entries.push({ id: `${layer.id}-fail`, label: "Fails commute", kind: "point", color: [184, 80, 64], symbol: "×" });
      }
      if (project.candidates.some((candidate) => !candidate.score)) {
        entries.push({ id: `${layer.id}-unscored`, label: "Not scored", kind: "point", color: [100, 116, 139], symbol: "—" });
      }
    } else {
      entries.push({id: layer.id, label: layer.label, kind: layer.kind, color: layer.color});
    }
  }

  return (
    <section className="map-legend" aria-label="Visible map layers" data-testid="map-legend">
      <strong>Map key</strong>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className={entry.kind === "polygon" ? "legend-swatch polygon" : entry.symbol ? "legend-swatch decision" : "legend-swatch"} style={{ backgroundColor: `rgb(${entry.color.join(" ")})` }} aria-hidden="true">{entry.symbol}</span>
            {entry.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RelocationEvidence({ project }: { project: MapGapProjectV1 }) {
  return (
    <section className="evidence-section" aria-labelledby="relocation-evidence-title">
      <div className="section-heading">
        <p className="section-number">01</p>
        <div>
          <h3 id="relocation-evidence-title">Candidate decision</h3>
          <p>Pass/fail is stated in text, not color alone.</p>
        </div>
      </div>
      <div className="candidate-list" data-testid="candidate-score-table">
        {[...project.candidates].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((candidate) => {
          const unscored = !candidate.score;
          const failed = Boolean(candidate.score?.failedConstraints.length);
          return (
            <article key={candidate.id} className={unscored ? "candidate-card unscored" : failed ? "candidate-card failed" : "candidate-card passed"}>
              <div className="candidate-rank"><span>{candidate.rank}</span><small>rank</small></div>
              <div className="candidate-copy">
                <h4>{candidate.label}</h4>
                <p className={unscored ? "result-chip unscored" : failed ? "result-chip failed" : "result-chip passed"}>
                  <span aria-hidden="true">{unscored ? "—" : failed ? "×" : "✓"}</span>
                  {unscored ? "Not scored" : failed ? candidate.score?.failedConstraints[0]?.label : "Passes route constraint"}
                </p>
              </div>
              <p className="candidate-score"><strong>{candidate.score?.total ?? "—"}</strong><span>/100</span></p>
            </article>
          );
        })}
      </div>
      {project.candidates.flatMap((candidate) => candidate.score?.failedConstraints ?? []).map((constraint) => (
        <p key={constraint.label} className="failure-note"><strong>{constraint.label}:</strong> {constraint.explanation}</p>
      ))}
      <p className="source-note">The blue shape is a routed fixture boundary with provider, travel-time, and profile evidence—not a density claim.</p>
    </section>
  );
}

function CivicEvidence({ project }: { project: MapGapProjectV1 }) {
  return (
    <section className="evidence-section" aria-labelledby="civic-evidence-title">
      <div className="section-heading">
        <p className="section-number">01</p>
        <div>
          <h3 id="civic-evidence-title">Capacity in reach</h3>
          <p>Capacity and utilization remain traceable to each fixture asset.</p>
        </div>
      </div>
      <div className="asset-list" data-testid="civic-capacity-table">
        {project.civic.assets.map((asset) => (
          <article key={asset.id} className="asset-card">
            <span className="asset-icon" aria-hidden="true">{asset.assetType === "library" ? "L" : "C"}</span>
            <div>
              <h4>{asset.name}</h4>
              <p>{asset.hoursOpen}</p>
            </div>
            <dl>
              <div><dt>Capacity</dt><dd>{asset.capacity ?? "—"}</dd></div>
              <div><dt>In use</dt><dd>{asset.utilizationRate === undefined ? "Not normalized" : `${Math.round(asset.utilizationRate * 100)}%`}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      {project.civic.underservedAreas.map((area) => (
        <div key={area.id} className="underserved-note" data-testid="underserved-evidence">
          <p className="gap-score"><span>{area.underservedScore}</span>/100 proxy</p>
          <div>
            <strong>Outside the 15-minute service boundary</strong>
            <p>{area.evidence.join(" ")}</p>
            <p className="provenance">Source: {area.provenance.label}. {area.provenance.note}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function RecoveryScreen({ contextLost }: { contextLost: boolean }) {
  return (
    <main className="recovery-screen" role="alert">
      <p className="eyebrow">MapGap V3 preview recovery</p>
      <h1>{contextLost ? "The map graphics context was lost." : "This browser cannot start the V3 map canvas."}</h1>
      <p>MapGap has not changed the portable project. Use V2 for the focused, non-WebGL workflow.</p>
      <a className="handoff-link" href={V2_HANDOFF_URL}>Open focused V2</a>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function useElementSize() {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 960, height: 640 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: Math.max(320, Math.round(rect.width)), height: Math.max(420, Math.round(rect.height)) });
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
  } catch {
    return false;
  }
}

function getInitialPreset(): PresetId {
  if (typeof window === "undefined") return "relocation";
  return window.location.hash === "#civic" ? "civic" : "relocation";
}

type MapLibreLike = {
  getStyle?: () => { sources?: Record<string, unknown> };
  isStyleLoaded?: () => boolean;
  areTilesLoaded?: () => boolean;
  getCenter?: () => { lng: number; lat: number };
  getZoom?: () => number;
  zoomIn?: (options?: {duration?: number}) => void;
  zoomOut?: (options?: {duration?: number}) => void;
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
};
