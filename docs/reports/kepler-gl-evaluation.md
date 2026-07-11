# Kepler.gl Evaluation for MapGap V3

**Decision date:** 2026-07-11  
**MapGap baseline:** `1d5e584` plus the current uncommitted Phase 1 workspace  
**Upstream evaluated:** stable `v3.2.6`, preview `v3.3.0-alpha.1`  
**Implementation status:** V3.0 is published as a fixture-only public prerelease under `apps/v3`  
**Decision:** conditional go for a dependency-isolated Kepler alpha; V2 continues independently; production package choice and any fork remain open

> **Version note:** MapGap V3 is MapGap's product generation. It is independent of Kepler.gl's own `3.x` release numbering; V3 must select the safest supported Kepler release available when implementation begins.

## Executive decision

Kepler.gl can give MapGap a much stronger analyst surface: GPU-rendered large datasets, configurable point/GeoJSON/hex/grid/heat layers, temporal filtering, split-map comparison, DuckDB-backed SQL, vector and raster tiles, WMS, and richer image/data/map exports. Those capabilities align especially well with candidate-zone analysis, civic asset audits, workforce/transit layers, and explainable evidence.

This is a better fit for a V3 boundary than a retrofit of V2. V2 should continue evolving as the fast, guided public/mobile product. V3 should be a separately built analyst-first application that can adopt a different React/rendering stack and a larger dependency graph without taxing or destabilizing V2.

1. Keep the current Leaflet renderer and guided controls for `/v2`, mobile, and first-run workflows, including new focused V2 workflows.
2. Build `/v3` as a separate deployable artifact and dependency boundary, initially for analysts and pilot partners.
3. Share framework-neutral project schemas, domain types, API clients, routing, scoring, provenance, and report contracts between versions.
4. Put Kepler behind a typed MapGap-to-visualization adapter; Kepler Redux remains V3 presentation state, not MapGap truth.
5. Reconsider a narrow rendering/UI fork only after the V3 pilot passes the product, performance, security, and maintenance gates in this report.

The original stable-package alpha rendered under React 18 and Vite 8 but
reported 31 high plus 8 moderate audit findings. That baseline is superseded by
the public MapGap fork prerelease: React 19, zero audit findings, strict deployed
CSP, and passing live smoke/security checks. Its 3.33 MB gzip main JavaScript
plus 1.83 MB gzip Parquet WASM still exceeds the 3 MB production target, so the
published site remains a fixture-only prerelease rather than production.

## V2/V3 product boundary

| Concern | MapGap V2 | MapGap V3 | Shared contract |
| --- | --- | --- | --- |
| Primary audience | Public users, households, field demos, focused relocation/civic flows | Analysts, partner teams, operators, and advanced decision sessions | Identity and project permissions when the platform adds them |
| Product job | Reach a useful answer quickly with guided defaults | Explore, compare, filter, model, explain, and publish evidence | Same routing, scoring, provenance, and report definitions |
| Map stack | React 18 + Leaflet; lightweight and mobile-first | Separately built MapLibre/deck.gl workbench using supported Kepler packages or selected modules | Neutral GeoJSON/domain datasets and versioned adapters |
| State | Current Zustand product state | V3 application state plus view-local Kepler Redux | Versioned project schema independent of either store shape |
| Data scale | Local decisions and bounded result sets | Large asset/candidate datasets, tiles, temporal layers, client SQL where appropriate | Server APIs, future PostGIS, caches, ETL, and object/tile storage |
| Release policy | Continues to receive features, quality work, and fixes | New preview/beta/production line with its own budgets and rollback | Backward-compatible API and project-schema changes |
| Failure mode | Remains independently usable | Can fail or be rolled back without affecting V2 | No forced migration and no shared renderer dependency |

### Why V3 should be a separate build

- The measured Kepler spike is roughly 19 times the current MapGap artifact after gzip; route-level dynamic import protects first load, but a separate build gives a stronger guarantee.
- The published 3.3 preview moves deck.gl/luma.gl to 9 and MapLibre to 4. V3's separate build still protects V2 from that future transition; it does not force a React upgrade into V2.
- V3 needs different CSP, WebGL, worker, security-audit, memory, and browser-support policies.
- Separate dependency graphs let V2 retain its current clean production audit while V3 resolves or owns the Kepler dependency surface.
- V2 and V3 can still share one repository, backend, schemas, and deployment hostname. Separation means an application/build boundary, not necessarily a second organization or codebase.

### Compatibility and migration contract

- A V2 project snapshot must open in V3 through a versioned, framework-neutral project schema.
- V3-specific layer layouts, filters, and camera state are optional view attachments. V2 may ignore them without losing project data.
- Share links identify their preferred experience (`v2` or `v3`) and schema version, while core project data remains portable.
- V3 may introduce new analysis outputs only through explicit schema versions and downgrade behavior.
- V2 users are never forced to migrate merely because V3 launches.

## What was evaluated

### Local MapGap baseline

MapGap is currently a React 18.3, Vite 8, TypeScript, Leaflet/React-Leaflet, Zustand, Tailwind, and Netlify Functions application. Its renderer consumes MapGap-owned points, routed isochrone GeoJSON, POI layers, candidate scores, profile state, and viewport state.

The evaluated product currently has two experiences, with a third proposed as a new version:

- `/v2`: a focused map-first public and mobile experience.
- `/`: an analyst/admin control plane with profiles, tables, candidates, imports, Ask MapGap, reports, and exports.
- `apps/v3`: a separately built, fixture-only analyst alpha that succeeds useful operator capabilities without inheriting the legacy workbench UX. It is not yet a route on the V2 production site.

That version split is the main architectural reason to make Kepler a V3 capability rather than replace the renderer everywhere or freeze V2.

### Current upstream facts

- Kepler.gl is an MIT-licensed React/Redux application and component built on MapLibre/Mapbox and deck.gl. Its own description targets large-scale geolocation datasets and millions of points.
- Stable `v3.2.6` uses React 18, Redux 4, deck.gl 8, MapLibre 3, and Node 18+.
- The latest preview evaluated was `v3.3.0-alpha.1`. Its published package still declares React 18 and Redux 4, while moving deck.gl/luma.gl to 9, MapLibre to 4, react-map-gl to 8, and Node to 20+. Its root Yarn resolutions do not carry cleanly into an npm consumer; npm installation has worse audit and deck/luma peer-conflict results. It is not a V3 candidate.
- 3.1 introduced vector tiles/PMTiles, DuckDB/SQL Explorer, AI-assisted map editing, and simultaneous MapLibre/Mapbox support.
- 3.2 added raster PMTiles/COG/STAC and WMS layers.
- The 3.3 preview adds or develops bitmap overlays, flow layers, annotations, layer groups, higher pitch, video export, 3D tiles, and swipe comparison. Preview-only capabilities must not be used as production commitments.

Primary upstream references are collected at the end of this report.

## Measured evidence

### Regression baseline

| Check | Result | Meaning |
| --- | ---: | --- |
| `npm test` | 52/52 passed in 21.8 s | This replaces the historical 39-test documentation baseline; V3 CI preserves the V2 suite rather than replacing it. |
| Live-backed user-story suite | 7/7 passed in 12.6 s | All Phase 1 stories passed against the public API from an isolated copy. The suite's obsolete environment gate used a non-secret sentinel; the current public workflow did not consume it. |
| Current V2 output after V3 alpha work | 789,072 B raw / 239,205 B gzip | It remains below the explicit 811,210 B raw / 244,987 B gzip V2 ceiling; V2 carries no Kepler/deck/MapLibre/loader dependency. |
| Current production audit | 0 findings | `npm audit --omit=dev` reported 63 production dependencies and no known vulnerabilities. |

### Implemented isolated V3 alpha

`apps/v3` pins every Kepler workspace dependency to immutable assets from
`evcatalyst/kepler.gl@mapgap-v3.0.0-alpha.1`, with React/React DOM 19.2.7,
Redux 5.0.1, React Redux 9.2.0, styled-components 6.4.3, and Vite 8.0.16. It
has its own manifest and lockfile; none of these packages appears in the V2
root manifest or lockfile.

| Check | Result | Consequence |
| --- | ---: | --- |
| Install | Succeeded with 828 packages | A full Kepler UI carries a major supply-chain and maintenance surface. |
| Vite build | Succeeded; 4,105 modules transformed | Stable Kepler compiles in the separate V3 tooling generation. |
| Output | 10.79 MB JS + 5.49 MB Parquet WASM; 4.57 MB total gzip | Production V3 must remain separate; Kepler contributes zero bytes and zero dependencies to V2. It is above the 3 MB target. |
| Browser smoke | Two analyst preset journeys pass in Chromium | A self-contained MapLibre style mounts with no Mapbox or token-bearing request. |
| Import interop | Default reducer import failed; named CommonJS exports worked | The adapter must use verified named imports under Vite 8 and carry a runtime smoke test. |
| Install warnings | loaders.gl peer conflicts plus legacy React peer/deprecation warnings | Exact dependency resolution must be pinned and reviewed; blind semver ranges are unsafe. |
| Build warnings | browser-externalized `assert`, worker `eval`, oversized chunk | CSP, worker behavior, and chunking need explicit production tests. |
| Prerelease audit | 0 findings at every severity | `npm run audit:alpha` fails if any vulnerability reappears; the public fork release and owner/review date are machine checked. |

The published `@kepler.gl/components@3.2.6` package alone reports 7,568,516 unpacked bytes. For context, its full UMD measured 15.03 MB raw / 3.91 MB compressed, and the hosted demo bundle measured 20.63 MB raw / 5.63 MB compressed. The isolated Vite spike is the more relevant MapGap planning baseline.

There is also documentation/package drift to budget for: the current README refers to a nonexistent `@kepler.gl/middleware` package while the stable implementation exports `enhanceReduxMiddleware` from `@kepler.gl/reducers`; a tagged stable Vite example still pins an older Kepler version; and the documented default imports required named-import adjustment under Vite 8.

## Where Kepler benefits MapGap

| MapGap need | Kepler contribution | Fit | Boundary |
| --- | --- | --- | --- |
| Candidate zones and explainable scoring | GPU point/polygon/hex/grid rendering, data-driven color/height, filters, legends, tooltips, split maps | Excellent | MapGap still computes scores, failed constraints, and explanations. |
| POI and daily-life layers | Multiple datasets, clustering, heatmaps, brushing, categories, temporal filters | Excellent | MapGap owns provider calls, provenance, caching, and amenity semantics. |
| Civic asset audits | Large CSV/GeoJSON exploration, capacity/utilization styling, WMS, raster/vector tiles, local SQL | Excellent | MapGap owns schema mapping, source authority, duplication/gap rules, and reports. |
| Workforce/transit/healthcare data | Flow/arc/trip layers, time playback, tiled regional data, comparative views | Strong | Flow and some comparison features are preview-dependent; routing remains external. |
| Evidence and exports | Image, filtered CSV, map JSON/HTML, movable legends, higher export resolutions | Strong | MapGap's decision memo and provenance bundle remain the official artifact. |
| Large-scale rendering | deck.gl/WebGL, binary/tiled formats, on-map aggregation | Strong | Browser memory and GPU still bound client rendering; national scale should be tiled. |
| Guided first-run and mobile | Full authoring UI offers little advantage and adds weight/complexity | Weak | Keep the current MapGap experience and Leaflet fallback. |
| Routing, isochrones, profiles, scoring | No native MapGap domain behavior | None | Kepler is a view/editor, never the source of geographic or decision truth. |

### Important semantic warning

Kepler's heatmap layer represents weighted point density. MapGap's current "access heatmap" is derived from routed travel-time polygons. They are not interchangeable. Routed isochrone polygons must remain a GeoJSON/polygon dataset with their travel-time and provider metadata; any Kepler density heatmap must be labeled as a different analytic view.

## Highest-value wow-factor capabilities

1. **Access versus proximity comparison.** A synchronized split map can place straight-line proximity or baseline amenities beside real routed access. The 3.3 preview's swipe mode could make this even more immediate after it becomes stable.
2. **Extruded candidate and capacity surfaces.** Candidate zones, underserved hexes, or civic assets can rise by total score, capacity, utilization, or unmet need while color shows the failed constraint.
3. **Animated daily-life and commute stories.** Trip/flow layers and time playback can show commute patterns, service hours, workforce movement, or before/after transit access.
4. **Ask, compute, then inspect.** MapGap can translate a grounded question into a visible query plan; DuckDB can run local SQL; Kepler can expose the resulting rows, filters, and map configuration for inspection. The LLM never becomes the factual authority.
5. **Regional-to-national data without a monolithic download.** PMTiles/MVT, COG/STAC, and WMS can layer demographics, imagery, facilities, and public datasets over MapGap results.
6. **Presentation-grade evidence.** High-resolution images, editable legends, filtered exports, and eventually video can turn a live analysis into a meeting-ready artifact while MapGap adds the assumptions and provenance memo.

The first two are the strongest demo investments because they express MapGap's core claim—nearby is not the same as reachable—without changing the domain model.

## User-story impact and regression model

The seven current stories remain the V2 compatibility contract. V3 adds analyst journeys rather than taking these stories away; where a V3 equivalent exists, it must produce the same underlying points, routes, profiles, scores, and evidence.

| Story | Kepler upside | Main regression risk | Required transition rule |
| --- | --- | --- | --- |
| 1. First run to generated heatmap | Better layer styling, comparison, and inspection of routed polygons | Conflating density heat with travel-time access; slower first load | Keep `/v2` on Leaflet. V3 gets a separate analyst onboarding flow and preserves nonzero ring and provider assertions. |
| 2. Add/edit locations | Select, inspect, label, and visually group points | Kepler data editing diverges from the editable MapGap table | MapGap points remain canonical. Initial bridge is one-way MapGap to Kepler; edits return only through explicit adapter commands. |
| 3. Relocation profile | Score-driven zones, constraint filters, comparison layers | Generic layer UI hides household assumptions | Keep the profile panel outside Kepler and inject only computed datasets/config. |
| 4. Dual-career scenario | Split views, arcs, paired commute surfaces | Kepler map state replaces scenario state or drops one anchor | Scenario/profile stays in Zustand; dataset contract asserts two anchors and job constraint fields. |
| 5. Mobile first run | Limited benefit | Bundle, WebGL memory, controls, focus order, and drawer collisions | V2 remains the supported mobile experience. V3 starts desktop/tablet analyst-only and links users back to V2 when its device gate is not met. |
| 6. Export-ready evidence | Strong image/CSV/JSON/HTML options | Raw map export lacks MapGap assumptions/provenance; token leakage in standalone HTML | MapGap export orchestrator wraps or disables Kepler exports and always produces the decision memo. Never embed a privileged map token. |
| 7. iPad balance | Read-only comparison may be useful in meetings | Desktop authoring panels crowd the map | Preserve the V2 story unchanged. Add V3 tablet support only after its own portrait/landscape workbench gates pass. |

Every rollout candidate must keep the current 52 discovered V2 local regressions and seven live-backed stories green. Kepler-specific tests add to that baseline; they do not replace it.

### Proposed V3 defining stories

| V3 story | User outcome | Acceptance signal |
| --- | --- | --- |
| Open a V2 project in V3 | An analyst starts from the same profile, points, routes, candidates, sources, and assumptions without re-entry. | Shared fixture counts, geometries, scores, and provenance match exactly; V2 remains unchanged. |
| Compare access with proximity | A relocation analyst sees why a nearby place fails in real travel time, using synchronized comparison and explicit constraints. | The analyst can identify and explain a changed candidate decision faster than in the current workbench. |
| Audit civic capacity | A partner styles facilities by capacity/utilization, overlays routed service reach and need, filters the evidence, and identifies duplication or a gap. | Every visible conclusion traces to an uploaded/public field or deterministic computation. |
| Explore data at regional scale | An analyst filters a large asset or demographic source without loading a national file into ordinary application state. | Direct, binary/query, and tiled qualification tiers meet the V3 performance and memory budgets. |
| Publish a decision artifact | A reviewer exports a presentation-grade map plus the MapGap assumptions, failed constraints, sources, freshness, and caveats. | The artifact is understandable without operating V3 and contains no provider secret. |
| Hand off to the focused experience | An analyst shares a bounded result that a household or field user can open in V2. | The share link degrades advanced V3 view state safely while preserving the decision inputs and evidence. |

## Target architecture

```text
Valhalla / ORS       POI and public data       scoring / reports
       \                     |                       /
        +---------- MapGap domain services ----------+
                              |
              versioned project and dataset contracts
                              |
                  +-----------+-----------+
                  |                       |
       MapGap V2 application      MapGap V3 application
     React 18 + Leaflet/Zustand   independent runtime/build
       public/mobile/focused      MapLibre/deck.gl workbench
                  |                       |
        V2 product state          V3 state + typed adapter
                                          |
                                  Kepler Redux view state
```

### Canonical dataset contracts

| Dataset ID | Minimum fields | Intended layers |
| --- | --- | --- |
| `mapgap-points-v1` | id, name, address, latitude, longitude, asset metadata | point/icon/label |
| `mapgap-isochrones-v1` | feature id, point id, minutes, mode, provider, generated time, GeoJSON geometry | polygon/line; never density heat by default |
| `mapgap-pois-v1` | POI id, category, source, freshness, name, coordinates, visible layer id | point/cluster/heat where explicitly selected |
| `mapgap-candidates-v1` | candidate id, geometry/coordinates, total score, component scores, failed constraints, rank | point/polygon/hex, 3D height, filter |
| `mapgap-assets-v1` | asset id/type, capacity, utilization, staffing, cost, funding, provenance, geometry | icon/point/hex/grid |
| `mapgap-underserved-v1` | area id, deterministic underserved score, reachable capacity, evidence, provenance, geometry | polygon/hex/grid; explicitly a proxy until need data is joined |

Contract versions are explicit because Kepler map configs bind layers and filters to dataset IDs and fields. `packages/project-contract` now validates `mapgap-project/v1`, rejects unknown forward schemas and credential-like fields, and makes a V3 config an optional `mapgap-v3-view/v1` attachment. A saved visualization config is not a MapGap project; it is a versioned view attached to one.

### State ownership rules

- Framework-neutral project schemas own the portable definitions of points, profiles, routing settings, POIs, candidates, evidence, and reports.
- V2 Zustand remains authoritative inside V2; V3 has its own application store hydrated from the shared schema and services.
- Kepler Redux owns only V3 viewport, layer presentation, filter presentation, and workbench UI state.
- The first V3 pilot syncs V3 domain state to Kepler in one direction. Bidirectional editing is deferred.
- Viewport changes can flow back through a narrow callback after loop-prevention tests exist.
- V3 saves a sanitized Kepler config separately from project data and validates dataset IDs on restore.
- No Kepler reducer shape is imported into shared MapGap schemas, V2 state, or domain types.

## Implementation and transition model

The estimates below are planning ranges for one experienced front-end engineer with product/design support, not measured commitments.

| V3 stage | Scope | Estimate | Exit gate |
| --- | --- | ---: | --- |
| V3.0 — architecture | Separate `apps/v3` npm root/lock/build/site config; dependency-free project contract; V2 isolation and artifact-budget guards | Implemented | V2 build and budget pass; root has no Kepler/deck/MapLibre/loader import or dependency. |
| V3.1 — public prerelease | Read-only Kepler shell, one-way V2 adapter, fixture/round-trip tests, relocation and civic presets, token-free MapLibre style, browser and scale-policy tests | Published separately | 11 local checks plus live smoke/security checks pass at `mapgap-v3-preview.netlify.app`; V2 remains separate. |
| V3.2 — partner beta | Candidate and civic presets, saved views, exports, telemetry, accessibility, visual/performance/security tests | 3–5 additional weeks | Pilot analysts complete target tasks; V2 remains independently deployable; security and CSP gates pass. |
| V3.3 — production release | Auth/project integration as needed, operational SLOs, error recovery, upgrade and rollback process | 3–6 additional weeks | Audit, accessibility, provenance, scale, support, and rollback gates pass. |
| V3.F — conditional fork | Fork automation, scoped packages, minimal patch set, upstream sync CI, ownership and release process | 3–6 weeks initial; roughly 0.25–0.5 FTE ongoing | Explicit fork triggers pass and maintenance budget is owned. This can occur between V3.1 and V3.3 if evidence requires it. |

This is a new application version, not a Leaflet rewrite. V2 continues on its own roadmap, and V3 reuses shared product contracts rather than UI internals. Replacing V2 remains out of scope unless later evidence shows that the public product itself should become analyst-first.

### Rollout sequence

1. Keep all V2 release and quality work independent of V3.
2. Create a V3 workspace/build with no production navigation; desktop only; sample/fixture data first. **Completed** under `apps/v3`.
3. Expose an internal V3 site only after the security and CSP review; it must not reuse the V2 Netlify site or route.
4. Run a small analyst cohort while V2 remains the fallback and public default.
5. Promote V3 from alpha to partner beta only after the application-boundary, audit, CSP, and task-value gates pass.
6. Do not fork until at least two V3 use cases demonstrate material value and supported upstream extension points prove insufficient.

## Regression and acceptance gates

### Product gates

- Existing 52 discovered local V2 tests and seven live-backed V2 stories remain green throughout V3 development.
- V2 and V3 point, POI, candidate, and isochrone counts match for shared project fixtures.
- Polygon coordinates and travel-time metadata survive adapter conversion without simplification by default.
- Profile/scenario changes update the workbench without remounting or losing map context.
- Exported evidence includes source, freshness, assumptions, provider, failed constraints, and MapGap report content.
- V3 failures leave V2 and shared project data unaffected and offer a safe route back to V2.

### Performance gates

- The V2 deployable and dependency graph include no Kepler, DuckDB, Parquet WASM, deck.gl, or MapLibre code added for V3.
- The current V2 artifact baseline is 772,581 B raw / 233,321 B gzip; any unexplained increase above 5% from V3 work blocks the pilot.
- The isolated V3 alpha currently measures 4.57 MB gzip. The <3 MB target is not met; tree-shaken modules, an upstream fix, a scoped fork, or direct MapLibre/deck.gl are the resolution candidates.
- Define and measure cold load, warm load, pan/zoom responsiveness, memory, and update time on a representative desktop, iPad, and low-end phone before rollout.
- Test tiers: 10k direct features, 100k binary/client-query features, and 1M+ tiled features. These are MapGap qualification targets, not upstream guarantees.

### Security and operations gates

- `npm audit --omit=dev --audit-level=high` and the stricter zero-finding
  `npm run audit:alpha` must continue to pass.
- Pin the complete Kepler/deck/loaders/luma resolution set; automated updates run the full browser matrix.
- Keep the deployed CSP test passing without `unsafe-eval`; the public
  prerelease currently passes this gate.
- Verify that exports, share links, logs, and saved configs contain no provider secrets or privileged tokens.
- Add a WebGL capability check, context-loss recovery, memory telemetry, and a clear handoff to V2 on unsupported devices.
- Preserve license and copyright notices for any redistributed or forked code.

### Accessibility gates

- Guided workflows stay outside the canvas and remain keyboard/screen-reader reachable.
- Tooltips and color scales have table/text equivalents.
- Mobile and iPad drawers retain focus trapping, escape/back behavior, orientation recovery, and no horizontal overflow.
- Every score and color encoding has a non-color explanation.

## Scale-out model

The browser should visualize results, not become MapGap's authoritative data platform.

| Scale tier | Recommended representation | Compute location | Notes |
| --- | --- | --- | --- |
| Up to roughly 50k features | Rows or GeoJSON | MapGap services plus optional client filters | Best for candidates, POIs, contours, and local asset inventories. Validate per geometry complexity. |
| Roughly 50k–1M features | Arrow/GeoArrow or DuckDB query result | Client for exploratory desktop work; server for official results | Avoid duplicating full datasets between Zustand and Redux. Stream or transfer once. |
| Regional/national, 1M+ features | MVT/PMTiles, raster PMTiles, COG/STAC, WMS | PostGIS/ETL/tile pipeline and CDN | Kepler requests only visible tiles; source tables stay server-side. |
| Saved projects and repeat analysis | Versioned project/results API | Postgres/PostGIS, cache, object storage | Kepler config is a view attachment, never the persistence model. |

Kepler documentation calls out a 250 MB Chrome local-upload limit and WGS84/Web Mercator input. MapGap already uses WGS84 GeoJSON, so coordinate compatibility is good. For national work, direct browser upload is not the scale strategy: generate tiles, pre-aggregate, cache routing/POI results, and keep PostGIS as the query authority.

DuckDB is attractive for private, ad hoc analyst files and transparent SQL exploration. It should not replace scheduled ETL, project persistence, multi-user authorization, routing, or reproducible official scoring.

## Fork decision

### Options considered

| Option | Decision | Why |
| --- | --- | --- |
| Keep Leaflet only | Safe fallback, not the preferred long-term analyst ceiling | Lowest risk but leaves major visualization, scale, and comparison capability on the table. |
| Build V3 with stable Kepler packages behind an adapter | **Recommended alpha shape** | Fastest way to validate value while preserving upstream updates and keeping V2 isolated. Currently blocked from production by audit/size/integration gates. |
| Build V3 with deck.gl/MapLibre directly for selected layers | Strong fallback or later optimization | More code to build, but far smaller and more product-shaped than the full Kepler authoring UI. |
| Maintain a local upstream-first Kepler security patch line now | **Recommended and in progress** | Produces independently upstreamable fixes without publishing or committing MapGap to a permanent fork. The first spike clears D3/Thrift/fetch paths and removes `react-palm` while preserving 11,386 upstream Node tests. |
| Publish a MapGap-scoped Kepler fork now | **Not yet** | The patch line now has a zero-finding packed core audit. Publication still waits for peer-clean/browser packaging, CSP evidence, SBOM/license review, and owned release maintenance. |
| Replace all MapGap maps with Kepler | Reject | Regresses the public/mobile experience, duplicates state, and turns a domain product into a generic map editor. |

### Fork triggers

A `mapgap/kepler.gl` fork becomes reasonable only if all of the following are true:

1. V3.2 proves at least two high-value workflows, such as candidate comparison and civic asset audit.
2. Dependency injection, theming, reducer plugins, and a thin wrapper cannot meet two or more critical requirements without monkey-patching internals.
3. A stable upstream version can be secured, or MapGap explicitly chooses to own the patches needed to clear the audit/CSP gates.
4. The team accepts a recurring upstream-sync budget and assigns a maintainer.
5. The fork remains a visualization workbench; MapGap domain logic stays outside it.

Security findings now justify a local upstream-first patch line because current
master still retains vulnerable runtime roots and Yarn resolutions do not
protect npm consumers. They do not yet justify publishing a permanent fork.
The verified patch line and ledger live under `fork/kepler-gl`; publication remains
conditional on a clean consumer graph and an owned maintenance process.

### Fork operating model

- Base releases on signed stable upstream tags, not `master` or an alpha.
- Keep `upstream` and `origin` remotes, a clean upstream mirror branch, and a small rebased MapGap patch series.
- Publish only required packages under a MapGap scope; never silently replace upstream package names.
- Keep a patch ledger with owner, rationale, upstream issue/PR, tests, and removal condition.
- Run monthly upstream comparisons and a quarterly upgrade rehearsal.
- Contribute generic fixes upstream first, especially ESM/Vite compatibility, dependency updates, CSP behavior, and accessibility.
- Block new domain features in the fork; they belong in MapGap adapters and panels.
- Preserve MIT notices, generate an SBOM, sign releases, and run audit/license checks in CI.

### Stop conditions

Do not fork—or retire the fork—if upstream sync exceeds five engineering days in two consecutive cycles, the public bundle begins importing workbench code, mobile fallback becomes unreliable, or direct deck.gl layers cover the proven use cases with materially less risk.

## Recommended next roadmap move

V3.0 and V3.1 are now published as a public fixture-only prerelease. The
relocation preset makes the core MapGap claim visible: the nearby candidate
fails the routed commute while the less-proximate candidate passes. The civic
preset renders capacity and normalized utilization alongside a clearly labeled,
deterministic underserved-capacity proxy. Both expose text/table evidence
outside the canvas.

V3.2 should not start with a published fork or public deployment. It should first:

1. Run a bounded analyst cohort against the two actual workflows and measure task completion, explanation quality, export usefulness, and whether Kepler controls materially help.
2. Replace fixtures with a read-only, authenticated project/result API only after provenance, retention, and permission decisions are approved.
3. Close the production blockers: high-severity audit paths, legacy peers, direct-`eval` CSP behavior, and the <3 MB bundle target.
4. Add real 100k Arrow/query and 1M+ tiled evidence, accessibility/browser/WebGL recovery evidence, export/report provenance, telemetry, and rollback rehearsal.
5. Review V3.2 evidence before choosing a newer upstream release, a deliberately maintained fork, or direct MapLibre/deck.gl for production V3.

The local security spike may proceed in parallel because its changes are
generic and upstreamable. As of 2026-07-11, D3/Thrift/fetch upgrades and a
framework-neutral replacement for `react-palm` pass all 11,386 upstream Node
tests. A second patch upgrades Lodash to advisory-safe 4.18.1 with the same
11,386-test result. A third aligns editable/deck/luma 9.3, React Intl 7, and a
true ESM component entry. Companion Hubble and loaders.gl patches plus four
verified consumer resolutions produce a packed core graph with 836 production
dependencies and zero audit findings. Vite 8 builds it without aliases and
Chrome renders 833 exports. A same-version luma duplicate-initialization
warning, the Mapbox peer, strict CSP, and the upstream Node 24 browser harness
remain open; this is progress evidence, not a production waiver.

## Sources

- [Kepler.gl repository and component overview](https://github.com/keplergl/kepler.gl)
- [Kepler.gl releases: stable 3.2.6 and 3.3 previews](https://github.com/keplergl/kepler.gl/releases)
- [Stable 3.2.6 component manifest](https://github.com/keplergl/kepler.gl/blob/v3.2.6/src/components/package.json)
- [Kepler.gl MIT license](https://github.com/keplergl/kepler.gl/blob/master/LICENSE)
- [3.3 upgrade guide and breaking changes](https://github.com/keplergl/kepler.gl/blob/master/docs/upgrade-guide-v3.3.md)
- [Release notes for DuckDB, vector/raster tiles, WMS, and AI assistant](https://docs.kepler.gl/release-notes)
- [Supported data formats, upload limit, and coordinate system](https://docs.kepler.gl/docs/user-guides/b-kepler-gl-workflow/a-add-data-to-the-map)
- [Layer catalog](https://docs.kepler.gl/docs/user-guides/c-types-of-layers)
- [Reducers and state model](https://docs.kepler.gl/docs/api-reference/reducers)
- [Save and export behavior](https://docs.kepler.gl/docs/user-guides/k-save-and-export)
