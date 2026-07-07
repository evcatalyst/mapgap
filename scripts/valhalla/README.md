# Local Valhalla for MapGap

MapGap can use Valhalla as a beta routing provider for hill-aware walking and
biking isochrones. Valhalla is not required for CI or production deploys yet;
ORS remains the default provider.

## Start Capital Region / Niskayuna Graph

```bash
node scripts/valhalla/resolve-geofabrik-env.mjs capital-region
docker compose --env-file scripts/valhalla/.resolved-capital-region.env -f docker-compose.valhalla.yml up
```

## Start New York + New Jersey Graph

```bash
node scripts/valhalla/resolve-geofabrik-env.mjs ny-nj
docker compose --env-file scripts/valhalla/.resolved-ny-nj.env -f docker-compose.valhalla.yml up
```

`jersey-city-nyc` is kept as a backwards-compatible alias for the same extract
set.

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
curl -s http://localhost:8002/isochrone \
  -H 'Content-Type: application/json' \
  --data '{"locations":[{"lat":42.7798,"lon":-73.8457}],"costing":"pedestrian","contours":[{"time":1}],"polygons":false}'
```

The response should be a GeoJSON `FeatureCollection`. MapGap's health check
tries `/status` first when available, then falls back to this lightweight
`/isochrone` probe.
