# Cloudflare rebuild: first reviewable slice

This branch brings the existing Vite/React/Leaflet app onto a Cloudflare Worker
with static assets, Google-shaped synthetic routing and a public NY dataset
catalog. It needs no Google key. It is a preview foundation, not real routing.

## Starting point and scope

- Base: `main` at `6cbab7a6f02923acd2f9e0d592ca13a089b8c64f`.
- Existing draft PRs #20 (relocation/housing) and #19 (V3 workbench) were
  inventoried; neither was merged into this slice.
- The deployed Netlify commit has not been independently established.
- No Netlify function, production route or DNS record is changed. Existing
  Netlify CI deployment jobs remain in place; merging still runs those jobs.
- The Cloudflare config defines only an isolated `mapgap-preview` workers.dev
  target. No Cloudflare deployment was performed during implementation.

## Included behavior

| Area | First slice |
| --- | --- |
| Hosting | Worker API plus Vite assets, SPA fallback and JSON-only API errors |
| Routing | Explicit `synthetic` provider; one Google-shaped request per threshold |
| UI | Mock notice, mock popup/export labels, request budget, partial results and cancellation |
| Catalog | NYS public libraries, farmers markets and registered food stores |
| Source lookup | Fixed official hosts, WGS84 points, bounded pagination, provenance and explicit truncation |
| Health | Separate app readiness, synthetic mode, disabled live providers, build SHA and observed source state |

`synthetic` and `google` are distinct identities. Choosing a disabled live
provider fails with 503; there is no live-to-synthetic error fallback. Existing
Netlify ORS/Valhalla paths are retained separately. A Google key alone will not
enable live Google on this Worker: the live adapter and the renderer, usage and
storage gates still need implementation and review.

## Local development and verification

Use Node 22.12+ (CI uses Node 24).

```bash
npm ci
npm run dev:cloudflare
```

Open `/v2` at `http://127.0.0.1:8787`. Choose **Explore Nearby → Libraries → Walk**.
Library points come from ArcGIS; travel areas are synthetic. Other V2 place
categories report that their provider is not yet enabled on this runtime.
Farmers markets and food stores are available through the catalog API; their
catalog selection UI is follow-up work.

`dev:cloudflare` builds once, then serves `dist` with Wrangler. Re-run the build
after changing frontend code. Worker code is watched by Wrangler.

```bash
npm run test:worker
npm run check:cloudflare
npx playwright install chromium
npm run test:cloudflare
npm run test:visual
```

The Worker suite checks contract validation, holes and disconnected polygons,
direction identity, strict fixture matching, partial results, errors, disabled
providers, body limits, pagination, invalid records, bounded scans and secret
handling. The runtime/browser canary starts the real bundled Worker under
workerd. Only external map tiles and public source records are stubbed in its UI
tests; health and mock routing are real local requests. It checks desktop/mobile
rendering, cancellation and partial origin failures. Public-source unit tests
use upstream stubs and do not assert current source availability.

Implementation verification on 2026-09-21: 60 existing regression tests, 16
Worker tests and 5 runtime/browser canaries passed. The production dependency
audit reported zero vulnerabilities, and the Cloudflare bundle dry-run passed.
A subsequent small-screen layout fix preserves the drawer subtitle instead of
letting it overlap the results; its iPhone SE visual baseline is updated.

An additional live adapter check used this environment's configured outbound
proxy and returned 15 libraries, 51 farmers markets and a deliberately capped
300 food stores for `bbox=-74,42.6,-73.6,42.9`. It exposed and verified the fix for
Socrata's wildcard-first select syntax. Local workerd's direct upstream fetches
returned 502 in this environment, so public-source retrieval must still be
rechecked on the actual workers.dev deployment. This is separate from the
passing synthetic runtime checks.

`MAPGAP_BROWSER_PATH` and optional JSON `MAPGAP_BROWSER_ARGS` support an existing
local Chromium installation. Standard CI uses Playwright's installed browser.

## API surface

| Method and path | Result |
| --- | --- |
| `GET /api/health` | App/provider/source state; mock status remains `degraded` |
| `GET /api/isochrones/scenarios` | Authored success/error fixture manifest |
| `POST /api/isochrones:generate` | Google-shaped local request/response subset |
| `POST /api/routing/isochrones` | Existing UI compatibility adapter; normalized FeatureCollection |
| `GET /api/layers` | Public catalog; imports explicitly disabled |
| `GET /api/layers/{datasetId}/features?bbox=...` | GeoJSON points with provenance and completeness metadata |
| `GET /api/service-points?category=library&bbox=...` | Existing V2 library lookup contract |

`bbox` is `west,south,east,north`, at most 1.5 degrees on either axis. Each
lookup reads at most three 100-row pages, with a 12-second per-page timeout.
Discarded/duplicate records and incomplete pages produce warnings. Source
health is the last observation in the current Worker isolate, not a durable
monitor. `sourceUpdatedAt: null` means unknown; retrieval time is not freshness.
Responses are `no-store`; no KV/R2/D1 bindings are provisioned in this slice.

### Synthetic request

```bash
curl http://127.0.0.1:8787/api/isochrones:generate \
  -H 'Content-Type: application/json' \
  --data '{"location":{"latitude":42.7798,"longitude":-73.8457},"travelDuration":"600s","travelMode":"WALK","travelDirection":"FROM","routingPreference":"TRAFFIC_UNAWARE","enableSmoothing":false,"polygonFidelity":"MEDIUM"}'
```

The payload contains only `{ "isochrone": { "geoJson": ... } }`. Provider,
mock and schema identity are in `X-MapGap-*` headers. Both Polygon and
MultiPolygon are supported; interiors and disconnected components are kept.
The versioned schemas are an intentionally limited local subset of the
[Google reference](https://developers.google.com/maps/documentation/isochrones/reference/rest/v1/isochrones/generate),
not a complete implementation of Google's service.

- Default `SYNTHETIC_MODE=schematic` creates deterministic display-only contours
  for supported coordinates and static travel modes. Constants are not a road,
  slope or traffic model. Place IDs without fixtures fail explicitly.
- `SYNTHETIC_MODE=fixtures` accepts matching fixture requests only; unmatched
  origins/settings return 404. This is useful for repeatable adapter tests.
- `?scenario=albany-walk-hole-600s` and other named scenarios require their
  matching request files in `worker/routing/fixtures`.
- `?scenario=error-429` (also 400/403/404/503) simulates errors; 429 includes
  `Retry-After: 2`. Fixture geometry was authored, not captured from Google.

The UI's **Request budget** is an upper bound on provider operations for the
requested run, including failed origins; transport failure cannot prove that
an upstream operation actually happened. **Contours returned** is the actual
successful count. Synthetic runs make no live routing calls and incur no Google
routing charges. This count is not a billing meter.

## Public datasets and secrets

`config/source-catalog.seed.json` preserves the reviewed source metadata.
Runtime adapters normalize it for `/api/layers`:

- `nys-public-libraries`: existing NYS ArcGIS layer 15, `outSR=4326` and ordered
  pagination. Source row `OBJECTID` is kept in the ID; cross-version stable ID
  qualification is follow-up work.
- `nys-farmers-markets`: Socrata `qq4h-8p86`; source seasonality is not a claim
  that a market is open today.
- `nys-retail-food-stores`: Socrata `9a8c-vfzj`; registration is not proof of a
  full-service grocery or a current opening.

An optional `SODA_APP_TOKEN` may be set as a Worker secret, or in ignored local
`.dev.vars`. It is attached only to the fixed data.ny.gov upstream. No API
accepts arbitrary URLs, browser-supplied credentials or private dataset saves.
Source terms and redistribution rights must be qualified before adding stored
extracts; this preview performs bounded live reads without persistent copies.

## Preview deployment

An authenticated Cloudflare account is required. This build session had none,
so only dry-run validation and local runtime checks were performed. After
signing in to the intended account, deploy an isolated preview from this branch:

```bash
npx wrangler login
npm run build
npx wrangler deploy --var BUILD_SHA:"$(git rev-parse HEAD)"
```

Record the resulting workers.dev URL, commit SHA and health response. Repeat
the library lookup and mock flow there before connecting any custom hostname.
The health response must report synthetic enabled and Google/Valhalla disabled.
Use `npx wrangler secret put SODA_APP_TOKEN` only if that optional public-source
token is needed. Do not put secrets in Vite variables, the catalog or git.

No custom hostname is configured. The proposed `mapgap.gitbrain.com` cutover,
maps-hub link changes and Netlify retirement are later decisions. To roll back
an isolated preview, remove its route/deployment; the current Netlify site
continues operating independently. Do not delete or rename the Netlify site.

## Next changes

1. **Authenticated dataset registry and imports.** Add owner-scoped D1 records
   and private R2 objects. Support GeoJSON and CSV imports with size/geometry/CRS
   validation, field mapping, provenance, row limits and explicit access rules.
   Preserve existing session-local CSV behavior until the saved workflow exists.
2. **Protected connectors.** Add server-held per-dataset credentials, approved
   hosts, request/redirect restrictions, token rotation and authorization on
   both metadata and bytes. Keep credentials and private rows out of share links,
   logs, client bundles and public cache keys.
3. **Regional Valhalla pilot.** Put Valhalla in a container behind the Worker;
   build routing tiles outside request handling. Benchmark cold/warm latency,
   graph loading, idle duration and cost before selecting an always-warm or
   sleep/wake policy. This PR does not deploy a container or prove cold-start
   savings.
4. **Provider comparison.** Retain provider identity and matched modes,
   thresholds, direction and traffic assumptions. Start with separate result
   views and geometry metrics; any later blended product needs an explicit
   methodology and Google usage review.
5. **Live Google.** Confirm preview access, credentials, current schema,
   compatible display/storage policy and quota controls before enabling the
   actual provider. Keep mock and live result identities separate.

For Adam's direction/design review: which primary workflow should lead
(resident discovery, relocation, or service planning); which layers come first;
who may upload/share private data; and what latency/budget is acceptable for a
cold Valhalla request? Those choices can guide the next slice without blocking
this reviewable foundation.
