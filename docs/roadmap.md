# MapGap Roadmap

MapGap shows the difference between proximity and practical access. The public
product starts with daily-life discovery and grows into relocation and civic
capacity decision support without turning the first experience into a GIS
workbench.

## Product Rules

- Geography, travel time, POIs, demographics, and scores must come from provider
  data, uploaded data, or deterministic computation.
- LLMs may parse intent and draft explanations, but never become the factual
  authority.
- `/v2` remains the public map-first product and continues to evolve. V3 is a
  separate analyst decision platform. The legacy workbench remains an operator
  surface until focused V2 and V3 workflows replace it.
- Every result and report carries source, freshness, assumptions, and caveats.

## Version Strategy

- V2 remains the default public/mobile product, with its own feature, quality,
  field-validation, relocation, and civic roadmap. V3 does not freeze it or
  force its users to migrate.
- V3 targets analysts, partners, and advanced decision sessions with larger
  datasets, configurable layers, comparisons, time, SQL, and evidence tooling.
- V3 is a separate application/build and dependency boundary, even if it shares
  this repository, backend, deployment hostname, and design language with V2.
- Both versions use framework-neutral, versioned project, dataset, provenance,
  scoring, and report schemas. Neither Zustand nor Kepler Redux is a persistence
  format.
- A V2 project can open in V3. V3-only view configuration is an optional
  attachment that V2 may safely ignore without losing project data.
- Shared API and schema changes remain backward compatible until an explicit,
  tested migration exists.

## Stage 1A - Reproducible Public Demo

Status: implemented in the `v2-stage1` release line.

Delivered:

- Mobile-first `/v2` with a live map, staged drawer, fixed and custom categories,
  synchronized markers and results, reset, browser history, shareable URL state,
  and `Search this area`.
- Normalized `ServicePoint` API with Google Places, official NY/NJ library
  adapters, caching, provenance, and graceful provider fallback.
- Lazy Valhalla/ORS access heatmaps with bounded parallelism and NY/NJ Valhalla
  coverage.
- CSV, GeoJSON, PNG, and decision-memo foundations in the operator workbench.
- Regression coverage for mobile, tablet, desktop, navigation, refresh, rotation,
  provider adapters, caching, routing concurrency, and the historical water
  overlay compensation.

Exit criteria:

- A clean clone builds and tests the same product that is deployed.
- Netlify production deploys from a reviewed commit on `main`.
- No active credentials appear in source, tests, or documentation.

## Stage 1B - Public Demo Quality Gate

Goal: make daily-life results trustworthy enough for unrestricted field sharing.

Work:

- Validate official NY and NJ library sources in representative viewports.
- Maintain category-specific relevance gates and fixtures for known provider
  false positives.
- Add approved Playwright screenshots for iPhone SE, standard iPhone, iPad
  portrait/landscape, and desktop.
- Enforce keyboard focus, reduced motion, contrast, touch targets, and no-clipping
  checks.
- Record privacy-safe provider, cache, and routing telemetry.

Exit criteria:

- Top-ten manual relevance is at least 90% for fixed categories across Albany,
  Jersey City, suburban, and rural views.
- No approved viewport has material screenshot drift or obscured controls.
- POIs remain usable when routing fails, and a 20-point heatmap completes within
  30 seconds in the public environment.

## Stage 1C - Field Validation

Goal: validate that unassisted users understand practical access.

Journeys:

1. Jersey City laundromat access.
2. Capital Region daily-life and library access.
3. A custom-category search in a participant-selected town.

Participants include relocation households and practitioners in economic
development, real estate, and corporate relocation. Record time to first useful
result, relevance, heatmap completion, trust comprehension, share-link fidelity,
and the next decision each participant wants to make.

Exit criteria:

- At least 12 observed sessions cover the target viewpoints.
- At least 80% complete a useful search without help in under 30 seconds.
- No severity-one mobile or routing issue remains.
- A decision record names the first paid workflow and purchaser.

## Stage 2 - Relocation Decision Brief

Goal: rank candidate places and explain every pass or failure.

Work:

- Add `/v2/relocate` using the existing profile, anchor, candidate-zone, and
  deterministic scoring primitives.
- Capture commute limits, daily-life requirements, healthcare/on-call limits,
  household anchors, and explicit preferences.
- Produce candidate zones, transparent scorecards, failed constraints, and a
  shareable relocation brief.
- Keep natural-language intake optional and always expose the parsed structure.

Exit criteria:

- A household moves from profile to ranked candidates without using the legacy
  workbench.
- Dual-career and hospital on-call constraints produce explicit pass/fail reasons.
- A shared brief is understandable without reopening MapGap.
- The workflow operates deterministically without an LLM provider.

## Stage 3 - Civic Capacity Pilot

Goal: test whether a proposed investment fills a real access gap or duplicates
reachable capacity.

Work:

- Add `/v2/audit` using the existing flexible CSV and asset-model foundations.
- Capture facilities, capacity, utilization, hours, staffing, cost, and funding.
- Combine routed service areas with ACS/TIGER need layers.
- Calculate reachable capacity, overlap, underserved areas, and duplication risk.
- Export an evidence memo with a source appendix and assumptions.

Exit criteria:

- One bounded jurisdiction and facility category can answer what exists, who can
  reach it, whether it is used, and what need remains.
- Existing and proposed sites are compared under the same assumptions.
- Every memo claim traces to uploaded data, public data, or computed geometry.
- A government or economic-development partner confirms usefulness for a real
  decision.

## MapGap V3 - Analyst Decision Platform

Goal: preserve the actual, independently evolving MapGap V2 product on the left
and add a purpose-built MapGap Intelligence workbench on the right. V2 remains
the interaction and routed-evidence authority. Intelligence adds approved
sources, overlays, alternate visual marks, filters, legends, provenance, and
linked evidence without changing V2 results or turning the public product into a
generic GIS editor. See the
[V3 Visual-Intelligence Architecture Review](reports/v3-visual-intelligence-architecture-review.md).

Status: architecture reset accepted and implemented as an internal-alpha branch;
release verification is in progress. `V3.2R` now hosts the actual V2 route beside
a direct MapLibre/deck.gl Intelligence surface, with a bounded one-way bridge and
responsive surface switching. The core `V3.3` layer workbench is implemented for
the civic and relocation fixtures, but export, persisted/shareable workspaces,
large-data adapters, and full device/accessibility qualification remain open.
The currently published fixture-only Kepler prerelease and draft PR 18 remain
superseded research spikes; the corrected direct-stack build has not replaced
that public preview. No V3 build is approved for partner data or production.

Architecture:

- Give V3 its own application build, dependency graph, audit, CSP, browser
  matrix, performance budget, and rollback path. `apps/v3` has its own npm
  manifest, lockfile, CI lane, and active separate-site configuration; V2 does
  not route `/v3`.
- Preserve V2 at its deployed `/v2` boundary in the wide V3 host. Connect it to
  Intelligence through a small, sanitized, origin-checked, versioned context
  bridge rather than importing Leaflet, Zustand, global history, or V2's
  full-viewport shell into the V3 dependency graph.
- Share domain schemas, API clients, routing/scoring services, provenance,
  analysis datasets, and report contracts rather than renderer/store state.
- Build Intelligence directly with MapLibre GL JS and selected deck.gl packages.
  Keep sources, layers, marks, encodings, filters, selection, and saved workspace
  state in MapGap-owned renderer-neutral contracts.
- Keep routing, POI authority, scoring, project data, and report claims in MapGap
  services and portable schemas.
- Use Kepler as a design reference, capability benchmark, prototype comparison,
  and upstream-contribution target. Kepler packages, Redux state, UI framework,
  and the public fork are not V3 runtime or release dependencies.
- Wide desktop and qualified iPad landscape use two product surfaces. iPad
  portrait and phone keep V2 primary and mount Intelligence as an explicit
  full-surface mode, with only one heavyweight map active.
- Every Intelligence source and renderer fails independently; right-side data or
  WebGL failure never reloads, blocks, or mutates V2.

Milestones:

- `V3.0 - Contracts and isolation` — **retain as implemented foundation**:
  independent V3 build/workspace, dependency-free `mapgap-project/v1`,
  renderer-neutral analysis/provenance/governance contracts, V2 isolation guard,
  and V2 artifact budget guard.
- `V3.K - Kepler research spike` — **implemented, superseded as product
  architecture**: fixture adapters, public fork/security evidence, direct scale
  policy, ACS/TIGER fixture, pane masks, shared selection, source isolation, and
  browser/security tests. Salvage its contracts, fixtures, scale rules, and
  lessons; do not merge its dual-Kepler UI or fork dependency as V3.
- `V3.2R - Product boundary reset` — **implemented; release verification in
  progress**: actual deployed V2 route on the left, direct MapLibre/deck canvas
  on the right, sanitized one-way context bridge, responsive full-surface
  switching, exact-origin frame policy, source isolation, and validated
  `mapgap-intelligence-view/v1` state.
- `V3.3 - Intelligence alpha` — **in progress**: bounded civic and relocation
  sources, source/layer catalog, order/visibility/opacity, compatible point-mark
  switching, numeric filters, legends, picking, provenance, selection, and
  source-outage recovery are implemented. Table/text equivalents, evidence
  export, saved/shareable workspaces, completed route/time interaction, and the
  full accessibility/device matrix remain release work.
- `V3.4 - Scale and partner beta`: qualify 10k direct, 100k binary/query, and
  1M+ tiled tiers; introduce workers, Arrow/query, MVT/PMTiles, saved/shareable
  workspaces, permission boundaries, browser telemetry, and bounded analyst
  validation.
- `V3.5 - Supported production`: add only identity, persistence, permissions,
  operations, and support capabilities proven necessary by the beta; complete
  accessibility, CSP, performance, SBOM/license, SLO, rollback, and owned-data
  gates.
- `V3.F - Kepler upstream research` — **optional, not a V3 dependency**: retain
  the public fork only while generic fixes are upstreamable and an owner accepts
  its sync, release, security, and stop-condition budget.

Current implementation evidence:

- The V3 manifest pins MapLibre GL JS 5.24.0 and selected deck.gl 9.3.6
  packages, rejects Kepler/Hubble/Redux runtime dependencies, and stays isolated
  from V2's dependency graph and deployable artifact.
- The wide host uses the exact cross-origin `/v2` application rather than a
  reconstructed access map. Narrow viewports keep the V2 frame alive while only
  mounting the active heavyweight map surface.
- The bridge validates exact origin and frame window, schema, field allowlists,
  record and geometry limits, a 384 KiB envelope, and increasing revisions. V2
  publishes only sanitized viewport, query/category, POI, routed-isochrone,
  selection, extension, and heat-mode context.
- The right surface owns one MapLibre WebGL canvas with interleaved deck layers.
  The bounded alpha supports choropleth, proportional symbol, density heat, hex,
  grid, and stable H3 views; governed isochrone/path/trip factories fail closed
  when their required geometry and semantics are absent.
- The local direct-stack build is well below the 3 MB gzip application ceiling.
  That initial result is not scale, device, accessibility, or production
  qualification.
- Required V2/V3 CI now tests the direct product boundary and portable contracts;
  the old Kepler-fork evidence check is an optional research workflow and cannot
  block a V2 or direct-stack V3 release.

Exit criteria:

- V2 continues to build, audit, test, and deploy on its own release line, with no
  MapLibre, deck.gl, Kepler, or Intelligence runtime and within its artifact
  budget. Its only V3 integration is the bounded publisher plus an exact-origin
  frame policy.
- The wide left pane loads the current V2 release and preserves its recognizable
  map, search, access heat, results, evidence, history, share, and failure modes.
- The origin-checked bridge rejects malformed, oversized, stale, wrong-source,
  wrong-origin, and future-version messages and never transfers credentials.
- An analyst can activate three approved right-side overlays, reorder/filter
  them, change opacity, inspect provenance, and switch one eligible source among
  three visual marks without refetching.
- Every color/size/height encoding has a legend and text/table equivalent; V3
  passes keyboard, screen-reader, reduced-motion, contrast, focus, touch, and
  responsive browser gates.
- Intelligence source or WebGL failure never reloads or corrupts V2, and the
  parent share URL restores both product contexts.
- V3 passes 10k direct, 100k binary/query, and 1M+ tiled tests; target pan/zoom is
  at least 45 FPS on qualified desktop and 30 FPS on qualified iPad with no
  context loss in a 30-minute mixed-layer session.
- The supported V3 application remains under the 3 MB gzip ceiling, with
  optional workers, charts, and advanced layers separately budgeted and lazy.
- At least two analyst workflows show material, observed value beyond V2 before
  V3 becomes supported production.
- Any retained fork has an upstream-sync process, patch ledger, SBOM/license
  checks, signed releases, owned maintenance budget, and explicit stop condition;
  fork health cannot block direct-stack V3 releases.

## Later Platform Work

Authentication, saved projects, PostGIS, scheduled ETL, transit routing,
workforce integrations, generalized open-data catalogs, and commercial listing
feeds wait until field evidence demonstrates which workflow warrants them.
