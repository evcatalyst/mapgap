# MapGap V3 Visual-Intelligence Architecture Review

**Decision date:** 2026-07-12

**Decision status:** recommended architecture reset

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

The recommendation is to preserve V2 at its deployed route boundary and rebuild
the right pane directly with MapLibre GL JS and selected deck.gl packages. Use
Kepler as a catalog of useful interaction patterns: layer management, encoding
choices, filtering, legends, tooltips, linked selection, time, and saved views.
Do not make Kepler packages, Redux state, its UI framework, or the MapGap Kepler
fork prerequisites for the V3 product.

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

Initial visual marks:

| Mark | MapGap use | Renderer |
| --- | --- | --- |
| Symbol / proportional symbol | POIs, facilities, candidates, capacity | deck `ScatterplotLayer`, `IconLayer`, `TextLayer` |
| Cluster | dense places and facilities at regional zoom | MapLibre clustering or pre-aggregated cells |
| Density heat | concentration, never routed reach | deck `HeatmapLayer` |
| Hex / grid | dynamic aggregation of point measures | deck `HexagonLayer` / `GridLayer` |
| Stable H3 cell | cross-source comparable spatial bins | precomputed H3 + `H3HexagonLayer` |
| Choropleth | ACS/HUD/civic area measures | deck `GeoJsonLayer`; MVT/PMTiles at scale |
| Extrusion | optional capacity or magnitude emphasis | deck polygon/column elevation; disabled by default on mobile |
| Route / isochrone | authoritative computed path or travel-time polygon | deck `PathLayer` / `GeoJsonLayer` |
| Time / trip | service windows or movement with a scenario-relative clock | deck `TripsLayer`; MapGap owns timeline state |
| Raster / vector tile | regional or national contextual sources | MapLibre raster/vector source or deck `MVTLayer` |

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
@deck.gl/geo-layers
@deck.gl/mapbox
@deck.gl/extensions
```

Import subpackages and layer modules selectively. Do not add the umbrella
`deck.gl` package, Kepler packages, Redux, styled-components, Hubble, or a chart
library to the baseline runtime.

MapLibre should remain the root canvas, with deck attached through
`MapboxOverlay({interleaved: true})`. That uses one WebGL2 context on the right,
keeps labels and thematic layers orderable, and follows MapLibre's camera. The
official integration documents limitations around delegated drag events,
terrain alignment, and non-Mercator projections; none block the initial 2D
Web-Mercator workbench.

## Measured bundle evidence

The existing V3 build at `ad33d12` produced:

- primary Kepler JavaScript: **12.34 MB raw / 3.34 MB gzip**;
- Parquet WASM: **5.49 MB raw / 1.83 MB gzip**;
- additional JavaScript and CSS beyond those primary artifacts.

A disposable Vite 8 renderer spike imported MapLibre plus points, GeoJSON, heat,
hex, contour, H3, MVT, and trips from the direct deck stack. It produced one
**1.85 MB raw / 519 KB gzip** JavaScript asset. The spike used the already
installed MapLibre 4.7.1 transitive package, no React shell, no production CSS,
and no source loaders, so it is not an apples-to-apples production forecast. It
does prove that direct composition removes most of the generic-workbench payload
and leaves meaningful room under the existing 3 MB gzip V3 application ceiling.

CI should measure the actual fresh implementation with MapLibre 5.24.x, exact
deck 9.3.x packages, the V3 shell, workers, styles, and optional chunks. No bundle
claim becomes a gate result until that build exists.

## V2-to-Intelligence bridge

Start one-way: V2 publishes sanitized context; Intelligence follows. Avoid
bidirectional camera control until feedback-loop and padded-bounds behavior are
proven.

```ts
type MapGapV2ContextV1 = {
  type: "mapgap.v2.context/v1";
  revision: number;
  bbox: [west: number, south: number, east: number, north: number];
  category?: string;
  query?: string;
  activeExtensions: string[];
  selectedPointId?: string;
  points: ServicePoint[];
  isochrones: IsochroneFeature[];
  heatmapMode: "off" | "walk" | "drive";
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

Live headers were checked on 2026-07-12. The V2 response currently has neither
`X-Frame-Options` nor a CSP `frame-ancestors` directive, so it is technically
frameable. The V3 response has `child-src 'self' blob:` and no `frame-src`, so it
currently blocks the cross-origin V2 frame. The host must add the exact V2 origin
to `frame-src`. Before production, V2 should add a restrictive
`frame-ancestors 'self' <exact-v3-origin>` policy rather than remaining frameable
by arbitrary sites.

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
| Wide desktop, normally ≥1180 px | Resizable 50/50 or 55/45 split; actual V2 left, Intelligence right; left minimum about 520 px, right minimum 480 px |
| Qualified iPad landscape | Compact split only when both pane minima and memory/frame-time gates pass; Intelligence controls collapse into its own drawer |
| iPad portrait | Full-canvas `MapGap / Intelligence` switch, default MapGap; only the active heavyweight surface is mounted |
| Phone | V2 remains default; Intelligence is an explicit full-screen drill-in with Map, Chart, and Table modes and a clear return action |

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
availability, or transit frequency. One tract source can switch between
choropleth, proportional symbols, and a table without another network request.

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

The reset is not complete until all of the following are demonstrated:

- the unchanged standalone V2 screenshot, accessibility, search, routing, share,
  history, rotation, and live suites still pass;
- the left pane loads the current V2 release, not fixtures or a reconstruction;
- V2 context reaches Intelligence within 200 ms after its debounce without a
  camera feedback loop;
- wrong-origin, wrong-source, malformed, oversized, stale, and future-version
  bridge messages are rejected;
- three simultaneous overlays can be reordered, filtered, restyled for opacity,
  inspected for provenance, and represented in text/table form;
- one eligible dataset changes among three visual marks without refetching;
- right-side source or WebGL failure never reloads or corrupts V2;
- the parent share URL restores both V2 context and Intelligence view state;
- wide, iPad landscape, iPad portrait, phone, keyboard, screen-reader, reduced
  motion, contrast, focus, and 44 px touch-target journeys pass;
- benchmark tiers cover 10k direct, 100k binary/query, and 1M+ tiled data;
- target interaction is at least 45 FPS on qualified desktop and 30 FPS on the
  qualified iPad, with no context loss during a 30-minute mixed-layer session;
- the production application remains under the 3 MB gzip ceiling, with optional
  workers, charts, and advanced layers lazy-loaded and separately budgeted.

## Transition from the current spike

1. Preserve draft PR 18 and `codex/v3-comparison-workspace` as a **Kepler
   comparison spike**; do not merge it as the product architecture.
2. Land this product-boundary decision and renderer-neutral Intelligence view
   contract before adding more Kepler-specific behavior.
3. Build a fresh V3 host with the actual deployed V2 frame left and a static,
   clearly labeled Intelligence shell right.
4. Add the sanitized one-way bridge and prove all existing standalone V2 tests
   remain unchanged.
5. Add one direct MapLibre canvas and a bounded ACS/TIGER choropleth.
6. Add the source/layer registry, visibility/order/opacity, compatible mark
   switching, filters, legend, tooltip, provenance, and linked selection.
7. Add civic, relocation, and source-outage journeys before expanding sources.
8. Add workers/binary data and MVT/PMTiles only after measured threshold tests.
9. Add curated charts lazily only when the map/table evidence is insufficient.
10. Publish the corrected preview, then archive or relabel the current public
    Kepler alpha so it cannot be mistaken for the V3 direction.

## Roadmap decision

- `V3.0` contracts and dependency isolation remain valid foundations.
- The current `V3.1/V3.2` Kepler applications are research evidence, not the
  target product.
- `V3.2R` resets the boundary: exact V2 left, Intelligence shell right, secure
  bridge, direct renderer, and responsive mode switching.
- `V3.3` delivers the Intelligence alpha: real bounded sources, multiple marks,
  layer controls, linked evidence, failure isolation, and exports.
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
