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

## Checks

```bash
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high
```

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

For Jersey City/NYC comparison work:

```bash
node scripts/valhalla/resolve-geofabrik-env.mjs jersey-city-nyc
docker compose --env-file scripts/valhalla/.resolved-jersey-city-nyc.env -f docker-compose.valhalla.yml up
```

See `scripts/valhalla/README.md` for validation and rebuild notes.

## Deployment

MapGap deploys to Netlify from GitHub Actions.

Current manually deployed Netlify site:

```text
https://mapgap-access.netlify.app
```

Required GitHub repository secrets:

```bash
NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID
```

Required Netlify site environment variables:

```bash
OPENROUTE_SERVICE_API_KEY
OPENCAGE_API_KEY
VALHALLA_BASE_URL
```

`VALHALLA_BASE_URL` is optional for production until the beta provider is hosted.
Do not set it to `localhost` in Netlify; Netlify Functions need a public or private-network
URL that is reachable from Netlify's runtime. If neither ORS nor hosted Valhalla is
configured, the public app still loads but heatmap generation is disabled.

## Hosted Valhalla on Cloud Run

The root `Dockerfile` is for Cloud Run continuous deployment of the Valhalla beta
provider. In Cloud Run, create a service from the GitHub repo with:

```text
Branch regex: ^main$
Build type: Dockerfile
Dockerfile: /Dockerfile
Build context: /
```

Configure the service to send traffic to container port `8002`, then add the
environment variables from `cloudrun/valhalla-env.yaml`. After the Cloud Run
service is healthy, set Netlify `VALHALLA_BASE_URL` to the service URL without a
path suffix. See `cloudrun/README.md` for the full service settings.

Recommended branch protection for `main`:

- Require the `Typecheck, build, audit` check.
- Require PR review before merge for collaborative work.
- Deploy previews run on pull requests; production deploys run on pushes to `main`.
