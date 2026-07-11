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

Goal: create a separately deployable analyst-first MapGap that uses the best of
Kepler.gl, MapLibre, and deck.gl without adding their weight or release risk to
V2. See the [Kepler.gl V3 evaluation](reports/kepler-gl-evaluation.md).

Status: `V3.0` and `V3.1` are implemented as a fixture-only, read-only internal
alpha in `apps/v3`. It has no V2 route or public deployment. Production is
blocked on the documented Kepler audit, peer, CSP, and bundle gates.

Architecture:

- Give V3 its own application build, dependency graph, audit, CSP, browser
  matrix, performance budget, and rollback path. `apps/v3` has its own npm
  manifest, lockfile, CI lane, and future separate-site configuration; V2 does
  not route `/v3`.
- Share domain schemas, API clients, routing/scoring services, provenance, and
  report contracts with V2 rather than sharing UI state or renderer internals.
- Put supported Kepler packages behind versioned MapGap dataset adapters. Keep
  Kepler Redux limited to view and workbench presentation state.
- Keep routing, POI authority, scoring, project data, and report claims in MapGap
  services and portable schemas.
- Re-evaluate the latest stable Kepler release when implementation starts. Do
  not base production V3 on an alpha or on the currently measured unmitigated
  `v3.2.6` audit surface.
- Retain direct deck.gl/MapLibre layers as an alternative when the full Kepler UI
  is too large, too generic, or too difficult to secure.

Milestones:

- `V3.0 - Architecture` — **implemented**: independent V3 build/workspace,
  dependency-free `mapgap-project/v1` contract, V2 isolation guard, and V2
  artifact budget guard.
- `V3.1 - Internal alpha` — **implemented, internal only**: versioned one-way
  V2 adapter; relocation routed-access/candidate preset; civic
  capacity/utilization/underserved-proxy preset; token-free self-contained
  MapLibre style; contract, parity, browser, token, and scale-policy checks.
- `V3.2 - Partner beta` — **pending**: validate the two implemented presets
  with a bounded analyst cohort; add approved real project/result inputs, saved
  views, evidence exports, telemetry, accessibility, 100k/1M scale evidence,
  deployed CSP/WebGL recovery, and browser matrix evidence.
- `V3.3 - Production`: add only the persistence, permissions, operations, and
  support capabilities proven necessary by the beta; publish independent SLOs
  and rollback procedures.
- `V3.F - Upstream-first security patch line` — **local spike active**: keep a
  minimal patch series against Kepler master, validate fixes in the upstream
  suite, and submit generic slices independently. Publishing a scoped MapGap
  fork remains conditional on a clean packed-consumer audit, CSP and browser
  evidence, an assigned maintainer, and upstream release timing.

Exit criteria:

- V2 continues to build, audit, test, and deploy without any V3 rendering
  dependency or material artifact growth.
- Shared fixtures produce matching points, routed polygons, profiles, scores,
  provenance, and report inputs in V2 and V3.
- V3 passes its own security, CSP, WebGL recovery, accessibility, performance,
  scale, export, and rollback gates.
- The V3 public prerelease remains at zero audit findings; any regression
  closes the publication gate.
- At least two analyst workflows demonstrate material value over V2 before V3
  becomes a supported production product.
- Any fork has an upstream-sync process, patch ledger, SBOM/license checks,
  signed releases, an owned maintenance budget, and an explicit stop condition.
- The local patch line has cleared Hubble's legacy Kepler/D3 pin and proven a
  zero-finding packed npm core graph. Deck/editable-layers alignment, React
  Intl 7, and the Vite 8 browser build are verified. Before any beta or
  publication it must clear the remaining Hubble/Mapbox peers, same-version
  luma duplicate initialization, strict-CSP deployment, and browser-suite
  harness. Lodash 4.18.1 is verified.

## Later Platform Work

Authentication, saved projects, PostGIS, scheduled ETL, transit routing,
workforce integrations, generalized open-data catalogs, and commercial listing
feeds wait until field evidence demonstrates which workflow warrants them.
