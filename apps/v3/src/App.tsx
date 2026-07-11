import { useEffect, useMemo, useState } from "react";
import { addDataToMap, mapStyleChange, wrapTo } from "@kepler.gl/actions";
import { KeplerGl } from "@kepler.gl/components";
import { useDispatch } from "react-redux";
import {
  getCivicCapacityProjectFixture,
  getRelocationProjectFixture,
} from "@mapgap/project-contract/fixtures";
import type { MapGapProjectV1 } from "@mapgap/project-contract";
import { projectToEvidenceSummary, projectToKeplerDatasets } from "./adapters/project-to-datasets";
import {
  TOKEN_FREE_MAP_STYLE_ID,
  TOKEN_FREE_MAP_STYLES,
} from "./map/token-free-style";
import {getStoryLayers, getStoryMapConfig} from "./map/story-config";
import "./styles.css";

const KEPLER_ID = "mapgap-v3-alpha";
const V2_HANDOFF_URL = import.meta.env.VITE_MAPGAP_V2_URL || "https://mapgap-access.netlify.app/v2";

type PresetId = "relocation" | "civic";

const PRESETS: Record<PresetId, { label: string; detail: string; getProject: () => MapGapProjectV1 }> = {
  relocation: {
    label: "Relocation: routed access vs proximity",
    detail: "Compare a nearby candidate that fails the routed commute constraint with a lower-proximity candidate that passes.",
    getProject: getRelocationProjectFixture,
  },
  civic: {
    label: "Civic: capacity and underserved proxy",
    detail: "Inspect facilities by capacity and utilization, routed service reach, and a transparent underserved-capacity proxy.",
    getProject: getCivicCapacityProjectFixture,
  },
};

export default function App() {
  const dispatch = useDispatch();
  const [presetId, setPresetId] = useState<PresetId>(() => getInitialPreset());
  const [keplerReady, setKeplerReady] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const [status, setStatus] = useState("Preparing V3 presentation state…");
  const [dimensions, setDimensions] = useViewportDimensions();
  const webglSupported = supportsWebGl();
  const preset = PRESETS[presetId];
  const project = useMemo(() => preset.getProject(), [preset]);
  const datasets = useMemo(() => projectToKeplerDatasets(project), [project]);
  const evidence = useMemo(() => projectToEvidenceSummary(project), [project]);
  const storyLayers = useMemo(() => getStoryLayers(presetId, project), [presetId, project]);
  const storyConfig = useMemo(() => getStoryMapConfig(presetId, project), [presetId, project]);

  useEffect(() => {
    const resize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [setDimensions]);

  useEffect(() => {
    if (!keplerReady) return;

    // The map instance has registered its reducer entry before this callback.
    // MapGap only pushes a fresh project snapshot into Kepler; no edit flows back.
    dispatch(wrapTo(KEPLER_ID, mapStyleChange(TOKEN_FREE_MAP_STYLE_ID)));
    dispatch(
      wrapTo(
        KEPLER_ID,
        addDataToMap({
          datasets,
          options: {
            centerMap: false,
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
    setStatus(`${storyLayers.length} visible evidence layers loaded from ${datasets.length} canonical datasets.`);
  }, [datasets, dispatch, keplerReady, project.scenario.id, project.scenario.label, storyConfig, storyLayers.length]);

  useEffect(() => {
    const canvas = document.querySelector("canvas");
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
    setKeplerReady(false);
    setStatus("Switching portable project fixture…");
    setPresetId(nextPreset);
    window.history.replaceState(null, "", `#${nextPreset}`);
  }

  if (!webglSupported || webglLost) {
    return <RecoveryScreen contextLost={webglLost} />;
  }

  return (
    <main className="v3-shell">
      <header className="v3-header">
        <div>
          <p className="eyebrow">Public prerelease • fixture-only • read-only</p>
          <h1>MapGap V3 Analyst Preview</h1>
          <p className="header-copy">Routed access, capacity, and evidence sit outside generic map configuration.</p>
        </div>
        <a className="handoff-link" href={V2_HANDOFF_URL}>Open focused V2</a>
      </header>

      <section className="preset-bar" aria-label="V3 preview scenarios">
        {(Object.entries(PRESETS) as Array<[PresetId, (typeof PRESETS)[PresetId]]>).map(([id, option]) => (
          <button
            key={id}
            className={id === presetId ? "preset-button selected" : "preset-button"}
            type="button"
            aria-pressed={id === presetId}
            onClick={() => selectPreset(id)}
          >
            {option.label}
          </button>
        ))}
      </section>

      <section className="analysis-layout">
        <aside className="evidence-panel" aria-label="MapGap evidence summary">
          <p className="panel-kicker">Portable project {project.schemaVersion}</p>
          <h2>{preset.label}</h2>
          <p>{preset.detail}</p>
          <p className="project-status" role="status">{status}</p>
          <dl className="metric-grid">
            <Metric label="Routed polygons" value={evidence.routedPolygonCount} />
            <Metric label="Candidates" value={evidence.candidateCount} />
            <Metric label="Failed candidates" value={evidence.failedCandidateCount} />
            <Metric label="Assets" value={evidence.assetCount} />
            <Metric label="Capacity" value={evidence.totalCapacity} />
            <Metric label="Underserved areas" value={evidence.underservedAreaCount} />
          </dl>
          <p className="alpha-note">Map style: self-contained MapLibre canvas; no token, third-party tiles, or provider secret.</p>
          <MapLegend layers={storyLayers} />
          {presetId === "relocation" ? <RelocationEvidence project={project} /> : <CivicEvidence project={project} />}
        </aside>

        <section className="map-workbench" aria-label="Kepler workbench rendered from MapGap datasets">
          <span className="map-status" data-testid="kepler-mounted">
            {keplerReady ? "Kepler workbench mounted" : "Mounting Kepler workbench"}
          </span>
          <KeplerGl
            key={presetId}
            id={KEPLER_ID}
            mapboxApiAccessToken=""
            mapStyles={TOKEN_FREE_MAP_STYLES}
            mapStylesReplaceDefault
            width={dimensions.width}
            height={dimensions.width <= 900 ? Math.min(560, Math.max(360, dimensions.height * 0.58)) : Math.max(520, dimensions.height - 172)}
            readOnly
            appName="MapGap V3 Preview"
            onKeplerGlInitialized={() => setKeplerReady(true)}
          />
        </section>
      </section>
    </main>
  );
}

function MapLegend({layers}: {layers: ReturnType<typeof getStoryLayers>}) {
  return (
    <section className="map-legend" aria-label="Visible map layers" data-testid="map-legend">
      <strong>Visible on the map</strong>
      <ul>
        {layers.map((layer) => (
          <li key={layer.id}>
            <span className={layer.kind === "polygon" ? "legend-swatch polygon" : "legend-swatch"} style={{backgroundColor: `rgb(${layer.color.join(" ")})`}} />
            {layer.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RelocationEvidence({ project }: { project: MapGapProjectV1 }) {
  return (
    <section className="evidence-section" aria-labelledby="relocation-evidence-title">
      <h3 id="relocation-evidence-title">Candidate decision evidence</h3>
      <table data-testid="candidate-score-table">
        <thead>
          <tr><th>Candidate</th><th>Score</th><th>Routed result</th></tr>
        </thead>
        <tbody>
          {project.candidates.map((candidate) => (
            <tr key={candidate.id}>
              <td>{candidate.label}</td>
              <td>{candidate.score?.total ?? "—"}/100</td>
              <td>{candidate.score?.failedConstraints.length ? candidate.score.failedConstraints[0].label : "Passes fixture constraint"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {project.candidates.flatMap((candidate) => candidate.score?.failedConstraints ?? []).map((constraint) => (
        <p key={constraint.label} className="failure-note"><strong>{constraint.label}:</strong> {constraint.explanation}</p>
      ))}
      <p className="source-note">Routed polygons remain polygons with provider, travel-time, and profile evidence—never converted into a density claim.</p>
    </section>
  );
}

function CivicEvidence({ project }: { project: MapGapProjectV1 }) {
  return (
    <section className="evidence-section" aria-labelledby="civic-evidence-title">
      <h3 id="civic-evidence-title">Capacity and provenance</h3>
      <table data-testid="civic-capacity-table">
        <thead>
          <tr><th>Asset</th><th>Capacity</th><th>Use</th></tr>
        </thead>
        <tbody>
          {project.civic.assets.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.name}</td>
              <td>{asset.capacity ?? "—"}</td>
              <td>{asset.utilizationRate === undefined ? "Not normalized" : `${Math.round(asset.utilizationRate * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {project.civic.underservedAreas.map((area) => (
        <div key={area.id} className="underserved-note" data-testid="underserved-evidence">
          <strong>Underserved proxy {area.underservedScore}/100</strong>
          <p>{area.evidence.join(" ")}</p>
          <p>Source: {area.provenance.label}. {area.provenance.note}</p>
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

function Metric({ label, value }: { label: string; value: number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function useViewportDimensions() {
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  }));
  return [dimensions, setDimensions] as const;
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
