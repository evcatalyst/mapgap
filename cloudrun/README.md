# Cloud Run Valhalla Service

This folder contains the runtime settings for hosting MapGap's Valhalla beta
provider on Cloud Run. The root `Dockerfile` is the build artifact to select
when creating continuous deployment from GitHub.

## Cloud Run UI Settings

Create a Cloud Run service, then choose continuous deployment from the repo:

```text
Branch regex: ^main$
Build type: Dockerfile
Dockerfile: /Dockerfile
Build context: /
```

Use these service settings:

```text
Container port: 8082
Memory: 8 GiB recommended for the NY+NJ graph
CPU: 2
Request timeout: 300 seconds
Concurrency: 10
Minimum instances: 1
Maximum instances: 3
Authentication: Allow unauthenticated
```

Add the environment variables from `cloudrun/valhalla-env.yaml` to the Cloud Run
service. The root `Dockerfile` also sets the same defaults, but Cloud Run service
env vars are easier to change without editing the image.

The Dockerfile downloads the New York and New Jersey OSM extracts, merges them,
and prebuilds a regional Valhalla graph during Cloud Build. At runtime, Valhalla
listens on internal port `8002` and a small MapGap proxy listens on Cloud Run's
injected `PORT` value. `/status` is public and returns proxy health. Routing
paths such as `/isochrone` require the `X-Valhalla-Shared-Secret` header when
`VALHALLA_SHARED_SECRET` is set on the Cloud Run service.

The build-time defaults can be overridden in Cloud Build if you need a different
coverage area:

```text
VALHALLA_TILE_URLS=https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf,https://download.geofabrik.de/north-america/us/new-jersey-latest.osm.pbf
VALHALLA_EXTRACT_BBOX=
VALHALLA_EXTRACT_NAME=ny-nj.osm.pbf
```

Set `VALHALLA_EXTRACT_BBOX` to a `west,south,east,north` value when building a
smaller clipped graph, such as the original Capital Region demo graph.

To protect the direct Cloud Run URL, set `VALHALLA_SHARED_SECRET` on the Cloud
Run service to the same value used in Netlify. If it is only set in Netlify, the
MapGap proxy function is protected, but the Cloud Run URL itself remains public.

`cloudrun/valhalla-service.yaml` is a template for the same runtime settings.
Replace the placeholder image path before applying it with `gcloud run services
replace`.

## Optional gcloud Deploy

After Cloud Build creates and pushes an image, you can apply the same runtime
settings with:

```bash
gcloud run deploy mapgap-valhalla \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/mapgap-valhalla:TAG \
  --region REGION \
  --port 8082 \
  --memory 8Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 10 \
  --min-instances 1 \
  --max-instances 3 \
  --allow-unauthenticated \
  --env-vars-file cloudrun/valhalla-env.yaml
```

Replace `REGION`, `PROJECT_ID`, `REPOSITORY`, and `TAG` with the image Cloud
Build produced.

## Wire Netlify to Cloud Run

Once the service responds, set these Netlify environment variables:

```bash
VALHALLA_BASE_URL=https://YOUR-CLOUD-RUN-SERVICE-URL
VALHALLA_SHARED_SECRET=choose-a-long-random-value
VALHALLA_COVERAGE_REGION=ny-nj
VALHALLA_COVERAGE_LABEL=New York + New Jersey Valhalla graph
```

Do not include `/status` or `/isochrone`; MapGap appends those paths in the
Netlify functions. `VALHALLA_SHARED_SECRET` is checked by the Netlify routing
function before it proxies hosted Valhalla requests. Users enter this same value
in MapGap when `Valhalla beta` is selected.

Netlify also forwards the shared secret to Cloud Run as
`X-Valhalla-Shared-Secret`. Set the same `VALHALLA_SHARED_SECRET` value on Cloud
Run to protect direct Cloud Run `/isochrone` requests.

Validate the service before updating Netlify:

```bash
curl -s https://YOUR-CLOUD-RUN-SERVICE-URL/status
```

If `VALHALLA_SHARED_SECRET` is set on Cloud Run, validate routing with:

```bash
curl -s https://YOUR-CLOUD-RUN-SERVICE-URL/isochrone \
  -H 'X-Valhalla-Shared-Secret: YOUR_SHARED_SECRET' \
  -H 'Content-Type: application/json' \
  --data '{"locations":[{"lat":40.7306,"lon":-74.0559}],"costing":"pedestrian","contours":[{"time":1}],"polygons":false}'
```

The response should be a GeoJSON `FeatureCollection`. A Cloud Run placeholder
HTML page or a JSON object with only service/revision metadata means Valhalla is
not deployed yet.

## Troubleshooting

If Cloud Run reports `Build failed` while the trigger is configured with branch
regex `^main$`, make sure the `Dockerfile` has been merged to `main`. Before
that merge, either merge the Cloud Run config PR or temporarily point the trigger
at the branch that contains the Dockerfile.

If Cloud Run reports that the container failed to listen on `PORT=8082`, confirm
the service is building a commit that includes
`cloudrun/valhalla-cloud-run-entrypoint.sh` and
`cloudrun/valhalla-secret-proxy.py`. The proxy listens on Cloud Run's injected
`PORT` value while Valhalla stays on internal port `8002`.

If Cloud Run logs `sudo: /usr/bin/sudo must be owned by uid 0 and have the
setuid bit set`, make sure the service is building the root `Dockerfile` from a
commit that uses `ghcr.io/valhalla/valhalla-scripted:latest`. The older GIS-OPS
image startup path is not compatible with Cloud Run's setuid restrictions.

If the revision shows the `gcr.io/cloudrun/placeholder` image, that is not the
Valhalla container. Check the build logs, fix the build or port settings, and
deploy a new revision from the built image.

## Operational Note

The Valhalla image builds tiles under `/custom_files` during Docker build and
ships the generated `valhalla_tiles.tar` in the image. That keeps Cloud Run
startup fast and avoids rebuilding tiles on every cold instance. Updating the OSM
extract list or bbox means rebuilding the container image.
