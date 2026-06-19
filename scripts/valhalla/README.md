# Local Valhalla for MapGap

MapGap can use Valhalla as a beta routing provider for hill-aware walking and
biking isochrones. Valhalla is not required for CI or production deploys yet;
ORS remains the default provider.

## Start Capital Region / Niskayuna Graph

```bash
node scripts/valhalla/resolve-geofabrik-env.mjs capital-region
docker compose --env-file scripts/valhalla/.resolved-capital-region.env -f docker-compose.valhalla.yml up
```

## Start Jersey City / NYC Graph

```bash
node scripts/valhalla/resolve-geofabrik-env.mjs jersey-city-nyc
docker compose --env-file scripts/valhalla/.resolved-jersey-city-nyc.env -f docker-compose.valhalla.yml up
```

The first run downloads OSM extracts and builds tiles in `valhalla-data/`. That
can take several minutes. Set `VALHALLA_FORCE_REBUILD=True` when changing
extracts.

Geofabrik `*-latest.osm.pbf` URLs redirect to dated extract files. The resolver
script writes ignored `.resolved-*.env` files with the direct current URLs so
the Valhalla Docker image downloads the full PBF instead of a tiny redirect page.

## Wire the App to Local Valhalla

Add this to `.env.local` for Netlify Dev:

```bash
VALHALLA_BASE_URL=http://localhost:8002
```

Then start MapGap:

```bash
npm run dev
```

Open the app, wait for the API status pill to refresh, then choose
`Valhalla beta` in the isochrone controls.

## Validate the Service

```bash
curl -s http://localhost:8002/status
```

If `/status` is not available on the image version, the app will mark Valhalla
unavailable even if the container is running. In that case verify manually with
an `/isochrone` request and adjust `netlify/functions/health.mjs`.
