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

Status: guided workflow foundation implemented on the
`codex/v2-relocation-housing` branch; field validation and durable sharing remain.

Implemented foundation:

- Four-step `/v2/relocate` journey: needs, homes, daily life, and compare.
- Household, dual-career, and hospital on-call scenario defaults.
- Distinct housing price markers that collapse to map dots at regional zoom.
- Explicit viewport search with an optional cached RentCast connector and a
  fail-closed cost gate.
- Stale-result signaling after map or filter changes, with no provider request
  until the user explicitly refreshes.
- Authorized CSV import for Zillow, Trulia, Craigslist, MLS, and other records
  without claiming unlicensed live integrations.
- Shortlisting and deterministic listing comparison with real price evidence,
  visible affordability failures, source access mode, and exportable briefs.
- Clearly labeled illustrative homes when no live feed is enabled.

Work:

- Validate the four-step journey with relocation households and practitioners.
- Add durable shortlist/project persistence and shareable relocation state.
- Add an authorized RESO/MLS connector after a data agreement is in place.
- Add housing market context without confusing it with live inventory.
- Expand route-backed candidate checks and report completeness.
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

Architecture:

- Give `/v3` its own application build, dependency graph, audit, CSP, browser
  matrix, performance budget, and rollback path.
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

- `V3.0 - Architecture`: approve the application boundary and portable project
  schema; create the independent build/workspace; preserve the green V2
  regression and audit baselines.
- `V3.1 - Internal alpha`: open V2 project fixtures in V3; compare routed access
  with proximity and candidate scores; prove a token-free MapLibre style,
  adapter parity, and zero V2 artifact/dependency impact.
- `V3.2 - Partner beta`: add candidate and civic-capacity presets, saved views,
  evidence exports, telemetry, accessibility, scale, CSP, and browser tests;
  validate with a small analyst cohort.
- `V3.3 - Production`: add only the persistence, permissions, operations, and
  support capabilities proven necessary by the beta; publish independent SLOs
  and rollback procedures.
- `V3.F - Conditional fork`: consider a scoped `mapgap/kepler.gl` fork only if
  two valuable V3 workflows are proven, supported extension points cannot meet
  at least two critical requirements, the security/release patch line is
  necessary, and a maintainer plus recurring sync budget are assigned.

Exit criteria:

- V2 continues to build, audit, test, and deploy without any V3 rendering
  dependency or material artifact growth.
- Shared fixtures produce matching points, routed polygons, profiles, scores,
  provenance, and report inputs in V2 and V3.
- V3 passes its own security, CSP, WebGL recovery, accessibility, performance,
  scale, export, and rollback gates.
- At least two analyst workflows demonstrate material value over V2 before V3
  becomes a supported production product.
- Any fork has an upstream-sync process, patch ledger, SBOM/license checks,
  signed releases, an owned maintenance budget, and an explicit stop condition.

## Later Platform Work

Authentication, saved projects, PostGIS, scheduled ETL, transit routing,
workforce integrations, generalized open-data catalogs, and commercial listing
feeds wait until field evidence demonstrates which workflow warrants them.
