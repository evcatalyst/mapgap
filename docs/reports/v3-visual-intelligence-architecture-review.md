# MapGap V3 Visual-Intelligence Architecture Review

**Decision date:** 2026-07-12

**Decision status:** accepted; V3.2R implemented in an internal-alpha branch and
under release verification

**Product boundary:** current MapGap V2 on the left; MapGap-owned visual intelligence on the right

**Kepler.gl role:** reference implementation and upstream research, not the V3 runtime

## Executive decision

The current V3 comparison spike solves the wrong composition problem. It renders
both panes inside one Kepler workbench and reconstructs an access view that is
described as V2-compatible. The intended product is materially different:

```text
┌──────────────── Current MapGap V2 ────────────────┐ ┌──────── MapGap Intelligence ────────┐
│ Existing Leaflet map, nearby search, Walk/Drive   │ │ MapLibre basemap + selected deck.gl │
│ access heat, markers, result stages, evidence,    │ │ layers, sources, filters, legends,  │
│ sharing, history, and continuing V2 improvements. │ │ encodings, provenance, charts/table.│
└───────────────────────────────────────────────────┘ └───────────────────────────────────────┘
                    sanitized versioned context bridge →
```

V2 remains the primary interaction and routed-evidence authority. Intelligence
adds contextual evidence and alternate visual encodings; it does not replace V2,
change a routed score, or turn density into a travel-time claim.

That reset is now implemented in the working V3 branch: V2 stays at its deployed
route boundary and the right pane uses MapLibre GL JS with selected deck.gl
packages. Kepler remains a catalog of useful interaction patterns—layer
management, encoding choices, filtering, legends, tooltips, linked selection,
time, and saved views. Kepler packages, Redux state, its UI framework, and the
MapGap Kepler fork are prohibited as V3 runtime or release prerequisites.

## Implementation status

The corrected branch implements the product boundary and the bounded core of the
Intelligence alpha. It has not replaced the public Kepler research release and is
not approved for partner data or production.

| Capability | Current status |
| --- | --- |
| Actual V2 left | Implemented as a titled, sandboxed frame of the independently deployed `/v2` product; V2 is not reconstructed or imported into the V3 bundle |
| One-way context | Implemented with exact origin/window checks, a versioned schema, monotonic revisions, field allowlists, 384 KiB message ceiling, and bounded POI/isochrone geometry |
| Direct Intelligence map | Implemented as one MapLibre GL JS 5.24.0 WebGL canvas with deck.gl 9.3.6 interleaving |
| Portable view state | Implemented as strict `mapgap-intelligence-view/v1` sources, layers, encodings, filters, legends, selection, viewport, link, workspace, and time state |
| Bounded workbench | Implemented for civic and relocation fixtures: three overlays, ordering, visibility, opacity, numeric filtering, compatible mark switching, legend, provenance, picking, and source-local failure |
| Responsive surfaces | Implemented as a qualified wide split and a narrow full-surface MapGap/Intelligence switch, retaining the V2 frame session and mounting only the active heavyweight map |
| Release evidence | Typecheck, build, contract, bridge, browser, security, and scale-policy suites exist; final cross-browser/accessibility/device and live corrected-deployment verification remain open |
| Scale-out and persistence | Policy/contract only for 100k query and 1M+ tiled tiers; adapters, benchmarks, saved/shareable views, table/export, identity, and operations remain roadmap work |

## What “V2 on the left” means

The left pane is the real `/v2` `V2PublicDemoShell`, not a fixture or a rendering
of the portable project contract. It includes:

- the current Leaflet/OpenStreetMap canvas;
- fixed and custom nearby search in the visible map bounds;
- synchronized POI markers and staged result/detail/evidence drawer;
- Off, Walk, and Drive access heat with the current walking-reach controls;
- live Valhalla/ORS routed isochrones and graceful POI-only fallback;
- `Search this area`, result-source evidence, extensions, personal boosts,
  sharing, browser history, refresh restoration, and export;
- the independent V2 release and regression suite as V2 continues to evolve.

The current V2 shell owns full-viewport and fixed-position behavior. Importing it
directly into V3 would couple React 18, Leaflet, Tailwind, Zustand, browser history,
and global layout assumptions to a second application. The least-risk first seam
is therefore the existing deployment boundary: host the exact V2 route in a
titled frame and communicate through a small, origin-checked bridge.

This is deliberately a product seam, not a permanent ban on future package
extraction. Reconsider a shared component package only if the frame creates a
measured accessibility, authentication, or workflow limitation that the bridge
cannot solve.

## Right-pane product model

The Intelligence pane is not a generic GIS editor. It is a bounded MapGap
workbench with three levels:

1. **Sources** — approved data with provenance, vintage, geography, license,
   sensitivity, refresh policy, join keys, and scale representation.
2. **Layers** — a source rendered with an explicit visual mark, field encodings,
   filter, legend, opacity, visibility, ordering, and interaction policy.
3. **Workspace** — the decision scenario, viewport, active layers, selection,
   time, linked-view preference, evidence layout, and shareable view state.

Visual-mark roadmap and implementation:

| Mark | MapGap use | Current status |
| --- | --- | --- |
| Symbol / proportional symbol | POIs, facilities, candidates, capacity | Implemented for point sources with deck `ScatterplotLayer` |
| Density heat | concentration, never routed reach | Implemented for eligible point sources with deck `HeatmapLayer` |
| Hex / grid | dynamic aggregation of point measures | Implemented for eligible point sources with deck `HexagonLayer` / `GridLayer` |
| Stable H3 cell | cross-source comparable spatial bins | Implemented with `h3-js` aggregation plus deck `PolygonLayer` |
| Choropleth | ACS/HUD/civic area measures | Implemented for bounded polygon GeoJSON with deck `GeoJsonLayer` |
| Route / isochrone | authoritative computed path or travel-time polygon | Gated `PathLayer` / `GeoJsonLayer` factories exist; route/isochrone semantics must be present and validated before activation |
| Time / trip | service windows or movement with a scenario-relative clock | Portable time contract and gated path-based factory exist; finished timeline interaction remains alpha work |
| Cluster / extrusion | regional density and optional magnitude emphasis | Contracted/planned, not an initial runtime option |
| Raster / vector tile | regional or national contextual sources | Contracted/planned for the scale phase; no initial tiled source adapter |

The first release must let an analyst activate at least three overlays, reorder
them, change opacity, filter, inspect provenance, and switch one eligible source
among at least three marks without refetching it.

## Reference-library decision

Package metadata was rechecked on 2026-07-12. Versions are implementation inputs,
not permission to auto-upgrade without browser, audit, license, and bundle tests.

| Candidate | Current evidence | Decision |
| --- | --- | --- |
| MapLibre GL JS | `5.24.0`, BSD-3-Clause; WebGL vector maps, style expressions, clustering, native sources | **Adopt as the Intelligence basemap/root renderer** |
| deck.gl | `9.3.6`, MIT; direct layers, aggregation, H3, MVT, trips, picking, filtering; supported MapLibre interleaving | **Adopt selected subpackages** |
| `@vis.gl/react-maplibre` | `8.1.1`, MIT; controlled React wrapper for MapLibre | Optional after lifecycle/camera spike; not required for the first direct overlay |
| PMTiles | `4.4.1`, BSD-3-Clause; browser range reads through MapLibre protocol | **Adopt when tiled sources are introduced** |
| Kepler.gl | mature workbench patterns but a second product/store/UI system; current spike has a broad forked package graph | **Reference, test oracle, and upstream research only** |
| Observable Plot | `0.6.17`, ISC; concise layered marks and strong curated summaries, but limited brushing/zoom/animation | Optional lazy curated charts |
| Vega-Lite | declarative specifications, transforms, composition, and selections | Conditional if user-authored/saved chart specifications become a requirement |
| Apache ECharts | broad catalog, Canvas/SVG, progressive rendering and accessibility helpers | Conditional for a later complex dashboard; unnecessary in the map MVP |
| DuckDB-Wasm | powerful browser SQL, but default single-thread execution and browser memory/CORS constraints | Desktop-only experiment after source/query requirements are proven |

Recommended initial Intelligence dependencies:

```text
maplibre-gl
@deck.gl/core
@deck.gl/layers
@deck.gl/aggregation-layers
@deck.gl/mapbox
h3-js
```

Import subpackages and layer modules selectively. Do not add the umbrella
`deck.gl` package, Kepler packages, Redux, styled-components, Hubble, or a chart
library to the baseline runtime.

The implemented alpha intentionally avoids `@deck.gl/geo-layers`: its package
barrel requires the unrelated mesh-layer peer. It also omits
`@deck.gl/extensions` because the bounded direct tier applies transparent
MapGap-owned filters before rendering and does not use a deck extension. Stable
H3 cells use `h3-js` plus deck's core `PolygonLayer`; governed path/time data use
app-owned `PathLayer` factories. MapLibre will own MVT/PMTiles sources when tiled
data is introduced.

MapLibre should remain the root canvas, with deck attached through
`MapboxOverlay({interleaved: true})`. That uses one WebGL2 context on the right,
keeps labels and thematic layers orderable, and follows MapLibre's camera. The
official integration documents limitations around delegated drag events,
terrain alignment, and non-Mercator projections; none block the initial 2D
Web-Mercator workbench.

## Measured bundle evidence

The superseded Kepler build at `ad33d12` produced 12.34 MB raw / 3.34 MB gzip of
primary JavaScript plus 5.49 MB raw / 1.83 MB gzip of Parquet WASM, before the
remaining assets. That remains useful research evidence, not the target bundle.

The corrected Vite build now compiles the React shell, MapLibre GL JS 5.24.0,
selected deck.gl 9.3.6 packages, H3 support, context bridge, and bounded
workbench into about **2.3 MB raw / 0.65 MB gzip JavaScript** plus about **13 KB
gzip CSS**. It has no Kepler, Parquet, DuckDB, Redux, or Hubble runtime and stays
well below the 3 MB gzip application ceiling.

That is an internal-alpha build result, not a permanent waiver. CI must continue
measuring all initial chunks, workers, WASM, and optional features. The scale
phase must keep query/tile adapters and optional charts separately budgeted and
lazy rather than spending the current headroom on a generic workbench.

## V2-to-Intelligence bridge

Start one-way: V2 publishes sanitized context; Intelligence follows. Avoid
bidirectional camera control until feedback-loop and padded-bounds behavior are
proven.

```ts
type MapGapV2ContextV1 = {
  schema: "mapgap.v2.context/v1";
  revision: number;
  context: {
    bbox: [west: number, south: number, east: number, north: number];
    category: string | null;
    query?: string;
    activeExtensions: string[];
    selectedPointId: string | null;
    servicePoints: ServicePoint[];
    isochrones: IsochroneFeature[];
    heatmapMode: "off" | "walk" | "drive";
  };
};
```

Bridge requirements:

- validate `event.origin`, `event.source`, schema version, shape, coordinates,
  record count, encoded bytes, and monotonic revision;
- include provider/provenance metadata but never provider credentials, local
  secrets, internal store objects, or unrestricted partner properties;
- debounce viewport messages and cancel stale right-side requests;
- use canonical `EntityRef` values for linked selection;
- isolate bridge parsing from both Leaflet and deck renderer state;
- keep source failures and WebGL recovery on the right from reloading the frame.

The repository deployment policies now declare both sides of the relationship:
V3 `frame-src` permits only `https://mapgap-access.netlify.app`, and V2's `/v2`
and `/v2/*` responses declare `frame-ancestors 'self'
https://mapgap-v3-preview.netlify.app`. The boundary script machine-checks those
exact origins. The currently deployed public pair may predate this corrected
branch, so live headers and the new V2 bridge must be verified together before
the direct-stack preview is published.

Use a descriptive frame title, minimum sandbox permissions, and an explicit
feature policy. The present separate origins are useful isolation. If both apps
later share an origin, re-audit the sandbox, because `allow-scripts` plus
`allow-same-origin` is not a meaningful boundary for same-origin content.

## Renderer-neutral contracts to retain

The current spike contains substantial work worth preserving:

- `mapgap-project/v1` as the portable project boundary;
- `MapGapAnalysisBundleV1` datasets, joins, representations, budgets, vintage,
  provenance, checksums, sensitivity, license, permission, and retention rules;
- inline GeoJSON/records, Arrow-query, MVT, and PMTiles representations;
- fail-closed commercial listing/parcel governance;
- deterministic ACS/TIGER demo fixtures and source-isolation tests;
- current direct/Arrow/tiled scale thresholds and evidence summaries;
- the V2 dependency/artifact isolation gate.

Replace renderer-specific view configuration with a new
`mapgap-intelligence-view/v1` attachment. Suggested shape:

```ts
type IntelligenceMarkV1 =
  | "symbol" | "cluster" | "density" | "hex" | "grid" | "h3"
  | "choropleth" | "extrusion" | "path" | "isochrone" | "trip"
  | "raster" | "vector-tile";

type IntelligenceLayerV1 = {
  id: string;
  sourceId: string;
  mark: IntelligenceMarkV1;
  visible: boolean;
  opacity: number;
  encodings: Record<string, {field?: string; value?: unknown; scale?: unknown}>;
  filters: Array<{field: string; operator: string; value: unknown}>;
  legend: {title: string; unit?: string; missingLabel: string};
  interaction: {pickable: boolean; selectable: boolean};
};
```

The contract describes meaning, not `GeoJsonLayer` props or MapLibre style JSON.
A layer factory validates whether a mark supports a source's geometry and fields,
then constructs the selected renderer. Unsupported combinations fail visibly and
do not mutate persisted state.

## Responsive product behavior

| Container | Behavior |
| --- | --- |
| Wide desktop, normally ≥1180 px | Fixed adaptive split in the alpha; actual V2 left, Intelligence right; left minimum 520 px, right minimum 480 px |
| Qualified iPad landscape | Compact split only when both pane minima and memory/frame-time gates pass; Intelligence controls collapse into its own drawer |
| iPad portrait | Full-canvas `MapGap / Intelligence` switch, default MapGap; only the active heavyweight surface is mounted |
| Phone | V2 remains default; Intelligence is an explicit full-screen map workbench with a clear MapGap/Intelligence switch; Chart and Table modes remain roadmap work |

V2 owns its existing bottom drawer. Intelligence owns controls inside the right
surface. Never stack two authoring drawers over one map. Camera linking is an
explicit toggle; semantic selection remains linked by default.

Mobile defaults cap device-pixel ratio, disable 3D and autoplay, prefer clustered
or tiled data, cap visible/pickable layers, and keep only one heavyweight map
mounted. deck's own performance guidance warns that phones are substantially more
sensitive to memory pressure even when rendering performance looks acceptable.

## Data and scale strategy

Keep the current conservative thresholds until target-device benchmarks justify
changes:

| Envelope | Representation and execution |
| --- | --- |
| ≤50k simple features, ≤24 MB, ≤2M coordinates | direct GeoJSON/records; worker normalization when parsing is material |
| 50k–1M or geometry-heavy, ≤256 MB, ≤12M coordinates | binary/Arrow query or pre-aggregated H3; worker or server computation |
| Beyond 1M, national polygons, repeated pan/zoom | MVT/PMTiles and viewport loading; server/prebuilt aggregation |

For tiled sources, cap both tile count and bytes, abort offscreen requests, and
load only viewport-relevant features. For deck layers, preserve data object
identity, avoid unnecessary updates, use binary attributes at scale, disable
picking when not needed, and never render thousands of layers.

The initial approved context sources should be bounded and decision-led:

1. existing MapGap places, candidates, routes, isochrones, and civic assets;
2. matching-vintage ACS measures joined to Census TIGER geometry;
3. HUD CHAS where its older release vintage is made explicit;
4. transit, flood/environmental, broadband, or other sources only when a named
   relocation or civic use story requires them;
5. commercial parcels/listings only after server-brokered access, permission,
   retention, redistribution, and provenance are approved.

## Representative use stories

### Daily life plus housing context

The user searches groceries, libraries, or dog parks in V2 and enables Walk.
Intelligence follows the search extent and overlays housing burden, vehicle
availability, or transit frequency. The bounded alpha renders eligible tract
sources as choropleths and exposes their legend, provenance, and picked facts;
an accessible table equivalent remains release work.

### Relocation

V2 retains anchors, candidates, nearby places, and routed constraint evidence.
Intelligence layers affordability, flood exposure, transit, schools, or approved
parcel context. Selecting a candidate highlights supporting and conflicting
evidence but never changes the deterministic MapGap score.

### Civic capacity

V2 shows facilities and routed reach. Intelligence combines capacity,
utilization, service gaps, need, and proposed investments. The analyst can switch
between points sized by capacity, need choropleth, and hex aggregation.

### Temporal access

The analyst filters service hours or transit frequency by time. A timeline may
animate an approved trip dataset; travel-time polygons remain computed isochrones,
not density heat.

### Source outage

Housing or transit can fail independently. V2 remains fully interactive, other
Intelligence layers stay available, and the failed layer shows its own recovery
and freshness status.

## Acceptance evidence

The implementation now separates completed alpha evidence from release gates:

| Evidence | Status |
| --- | --- |
| Standalone V2 remains independently buildable/testable, carries no V3 renderer dependency, and stays inside its artifact budget | Implemented and covered by root CI guards |
| Left pane is the current V2 route, not fixture/reconstruction | Implemented in the host; corrected public pair still needs live verification |
| Bounded, debounced, one-way context; rejection of wrong origin/source/schema, malformed, oversized, stale, and future messages | Implemented with publisher and host tests |
| Three overlays; ordering, visibility, opacity, numeric filtering, provenance, picking, and at least three compatible point marks without refetch | Implemented for bounded civic/relocation data |
| Source/basemap failure does not reload or mutate V2 | Implemented in browser journeys; WebGL context-loss/restoration qualification remains open |
| Qualified wide split and narrow full-surface switching | Implemented; full iPad/phone, assistive-technology, reduced-motion, contrast, focus, and 44 px touch-target evidence remains open |
| Portable view contract | Implemented and strict; parent URL restoration, persistence, accessible table/text equivalents, and evidence export remain open |
| Scale policy and one right-side WebGL context | Implemented as policy/tests; 100k binary/query and 1M+ tiled adapters, device FPS, and 30-minute stability remain open |
| Under 3 MB gzip application ceiling | Current direct-stack build passes; optional workers/charts/advanced layers must stay separately budgeted |

## Transition from the current spike

1. **Preserved:** draft PR 18 and `codex/v3-comparison-workspace` remain the
   Kepler comparison spike rather than the product merge target.
2. **Implemented:** the product-boundary decision and renderer-neutral
   `mapgap-intelligence-view/v1` contract.
3. **Implemented:** a fresh host with the actual deployed V2 frame left and a
   direct MapLibre/deck Intelligence surface right.
4. **Implemented:** sanitized one-way publisher/host bridge, exact-origin frame
   policies, standalone V2 regression coverage, and source isolation.
5. **Implemented:** bounded civic/relocation sources, choropleth and point
   marks, source/layer registry, visibility/order/opacity, filters, legend,
   provenance, picking, and source-outage journeys.
6. **Verify before publishing:** complete runtime hardening, accessibility and
   device evidence, live V2/V3 headers and bridge, corrected release labeling,
   and a rollback rehearsal without changing the existing research release.
7. **Then scale:** add workers/binary query and MVT/PMTiles only after measured
   threshold tests; add curated charts only when map/table evidence is
   insufficient.

## Roadmap decision

- `V3.0` contracts and dependency isolation remain valid foundations.
- The current `V3.1/V3.2` Kepler applications are research evidence, not the
  target product.
- `V3.2R` is implemented in the corrected branch: exact V2 left, Intelligence
  right, secure bridge, direct renderer, and responsive mode switching.
- `V3.3` is in progress: bounded sources, multiple marks, layer controls,
  provenance, selection, and failure isolation are implemented; accessible
  table/text equivalents, export, persistence, and completed route/time
  interaction remain release work.
- `V3.4` qualifies scale and partner beta: binary/query/tile sources, saved
  workspaces, permission boundaries, device telemetry, and analyst validation.
- `V3.5` is supported production only after accessibility, operations, identity,
  persistence, SLO, rollback, SBOM/license, and real-workflow value gates pass.
- The public Kepler fork moves to an optional research/upstream-contribution
  track with its own ownership and stop condition. It is no longer a V3 release
  dependency.

## Primary references

- [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre large-data guidance](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [deck.gl MapLibre integration](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre)
- [deck.gl layer catalog](https://deck.gl/docs/api-reference/layers)
- [deck.gl performance guidance](https://deck.gl/docs/developer-guide/performance)
- [deck.gl filtering limits](https://deck.gl/docs/api-reference/extensions/data-filter-extension)
- [deck.gl interaction and picking](https://deck.gl/docs/developer-guide/interactivity)
- [PMTiles with MapLibre](https://docs.protomaps.com/pmtiles/maplibre)
- [Observable Plot interaction limits](https://observablehq.com/plot/features/interactions)
- [Vega-Lite interactive grammar](https://vega.github.io/vega-lite/)
- [Apache ECharts capabilities](https://echarts.apache.org/en/index.html)
- [DuckDB-Wasm overview and limits](https://duckdb.org/docs/stable/clients/wasm/overview)
- [Census developer services](https://www.census.gov/data/developers/guidance/api-user-guide.html)
- [HUD CHAS API and vintage](https://www.huduser.gov/portal/dataset/chas-api.html)
