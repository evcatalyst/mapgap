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

## Deployment

MapGap deploys to Netlify from GitHub Actions.

Required GitHub repository secrets:

```bash
NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID
```

Required Netlify site environment variables:

```bash
OPENROUTE_SERVICE_API_KEY
OPENCAGE_API_KEY
```

Recommended branch protection for `main`:

- Require the `Typecheck, build, audit` check.
- Require PR review before merge for collaborative work.
- Deploy previews run on pull requests; production deploys run on pushes to `main`.
