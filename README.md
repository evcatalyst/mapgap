# MapGap

MapGap maps nearby places that are hard to reach. It is a Vite, React 18,
TypeScript, Tailwind CSS, React-Leaflet, TanStack Table, and Zustand SPA with
Netlify Functions for server-side routing/geocoding proxy calls.

The app renders shared accessibility heatmaps from real walking/biking/driving
network isochrones, keeps points synced with an editable table, and exports CSV,
GeoJSON, and PNG artifacts.

## Local Development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with server-side Netlify function keys:

```bash
OPENROUTE_SERVICE_API_KEY=...
OPENCAGE_API_KEY=...
VALHALLA_BASE_URL=http://localhost:8002
```

`npm run dev` starts Netlify Dev so `/api/*` functions work locally.
For UI-only Vite work without API functions, use:

```bash
npm run dev:vite
```

To test the local Vite frontend against the published Netlify API and hosted
Valhalla backend, proxy local `/api/*` calls to the live site:

```bash
MAPGAP_API_PROXY_TARGET=https://mapgap-access.netlify.app npm run dev:vite
```

## Checks

```bash
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high
```

Run the local regression suite:

```bash
npm test
```

Run the live full-stack Valhalla smoke suite against the published app:

```bash
MAPGAP_VALHALLA_SECRET=<client-access-secret-if-required> npm run test:live
```

Omit `MAPGAP_VALHALLA_SECRET` when `/api/health` reports
`valhallaRequiresSecret: false`. Never commit a real provider or client-access
secret.

## V3 Internal Analyst Alpha

V2 remains the public product. The Kepler-backed V3 analyst alpha is a separate
application, lockfile, CI lane, and future site—not a route or dependency of the
V2 Netlify deployment.

```bash
npm --prefix apps/v3 ci
npm --prefix apps/v3 run build
npm --prefix apps/v3 run test
```

It currently renders read-only relocation and civic-capacity fixtures through a
versioned portable project contract. Its public prerelease is available at
`https://mapgap-v3-preview.netlify.app`; production promotion remains blocked
by bundle, packaging, SBOM/license, and review gates; see
[apps/v3/SECURITY.md](apps/v3/SECURITY.md) and the
[V3 evaluation](docs/reports/kepler-gl-evaluation.md).

The public upstream-first Kepler security patch line is tracked in
[`fork/kepler-gl`](fork/kepler-gl/README.md). It has verified dependency and
task-runtime fixes against upstream master and is published from
`evcatalyst/kepler.gl`; it is not yet production-cleared.

## Routing Providers

MapGap supports two routing providers behind the same `/api/routing/isochrones`
proxy.

- `ORS`: production-safe default using `OPENROUTE_SERVICE_API_KEY`.
- `Valhalla beta`: local hill-aware routing using `VALHALLA_BASE_URL`.

Valhalla is disabled in the UI until `/api/health` can reach the configured
service. To run a local Niskayuna/Capital Region graph:

```bash
node scripts/valhalla/resolve-geofabrik-env.mjs capital-region
docker compose --env-file scripts/valhalla/.resolved-capital-region.env -f docker-compose.valhalla.yml up
```

For full New York + New Jersey comparison work:

```bash
node scripts/valhalla/resolve-geofabrik-env.mjs ny-nj
docker compose --env-file scripts/valhalla/.resolved-ny-nj.env -f docker-compose.valhalla.yml up
```

See `scripts/valhalla/README.md` for validation and rebuild notes.

## Deployment

MapGap deploys to Netlify from GitHub Actions.

Current Netlify site:

```text
https://mapgap-access.netlify.app
```

The current working example is also exposed as the versioned public entrypoint:

```text
https://mapgap-access.netlify.app/v2
```

Focused decision-workflow previews reuse the same map, routing, scoring, and
memo primitives:

```text
https://mapgap-access.netlify.app/v2/relocate
https://mapgap-access.netlify.app/v2/audit
```

Required GitHub repository secrets:

```bash
NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID
```

Stage 1 Netlify environment variables:

```bash
GOOGLE_PLACES_API_KEY
VALHALLA_BASE_URL
VALHALLA_SHARED_SECRET
VALHALLA_REQUIRE_CLIENT_SECRET=false
VALHALLA_COVERAGE_REGION
VALHALLA_COVERAGE_LABEL
```

Optional resilience and geocoding variables:

```bash
OPENROUTE_SERVICE_API_KEY
OPENCAGE_API_KEY
```

`VALHALLA_BASE_URL` is optional for production until the beta provider is hosted.
Do not set it to `localhost` in Netlify; Netlify Functions need a public or private-network
URL that is reachable from Netlify's runtime. If neither ORS nor hosted Valhalla is
configured, the public app still loads but heatmap generation is disabled.
`VALHALLA_SHARED_SECRET` is optional, but recommended for hosted Valhalla. When
set, Netlify forwards it to Cloud Run so the direct routing service can reject
unauthorized requests. Set `VALHALLA_REQUIRE_CLIENT_SECRET=true` only when the
public MapGap UI should also require users to provide a client access secret.
Use `VALHALLA_COVERAGE_REGION=ny-nj` and
`VALHALLA_COVERAGE_LABEL=New York + New Jersey Valhalla graph` after the hosted
Valhalla service has been rebuilt with the NY+NJ graph.

## Hosted Valhalla on Cloud Run

The root `Dockerfile` is for Cloud Run continuous deployment of the Valhalla beta
provider. In Cloud Run, create a service from the GitHub repo with:

```text
Branch regex: ^main$
Build type: Dockerfile
Dockerfile: /Dockerfile
Build context: /
```

Configure the service to send traffic to container port `8082`, then add the
environment variables from `cloudrun/valhalla-env.yaml`. The Docker image
downloads the New York and New Jersey OSM extracts, merges them, prebuilds that
Valhalla graph during Cloud Build, and starts a small proxy on Cloud Run's
injected port. After the Cloud Run service is healthy, set Netlify
`VALHALLA_BASE_URL` to the service URL without a path suffix, then set
`VALHALLA_COVERAGE_REGION=ny-nj`. Set the same `VALHALLA_SHARED_SECRET` value in
Netlify and Cloud Run if the direct Cloud Run URL should reject public
`/isochrone` calls. See `cloudrun/README.md` for the full service settings.

Recommended branch protection for `main`:

- Require the `Typecheck, build, audit` check.
- Require PR review before merge for collaborative work.
- Deploy previews run on pull requests; production deploys run on pushes to `main`.
