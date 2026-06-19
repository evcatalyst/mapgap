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
Container port: 8002 or 8082
Memory: 4 GiB minimum
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

The Valhalla image normally listens on `8002`, but the MapGap Dockerfile installs
a Cloud Run entrypoint that rewrites Valhalla's generated config to listen on
Cloud Run's injected `PORT` value. This means existing services configured for
`8082` can still start, while local Docker and Compose runs keep using `8002`.

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
  --port 8002 \
  --memory 4Gi \
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
```

Do not include `/status` or `/isochrone`; MapGap appends those paths in the
Netlify functions. `VALHALLA_SHARED_SECRET` is checked by the Netlify routing
function before it proxies hosted Valhalla requests. Users enter this same value
in MapGap when `Valhalla beta` is selected.

This protects the Netlify proxy path. If the Cloud Run service allows
unauthenticated requests, anyone with the Cloud Run URL can still call Valhalla
directly.

Validate the service before updating Netlify:

```bash
curl -s https://YOUR-CLOUD-RUN-SERVICE-URL/isochrone \
  -H 'Content-Type: application/json' \
  --data '{"locations":[{"lat":42.7798,"lon":-73.8457}],"costing":"pedestrian","contours":[{"time":1}],"polygons":false}'
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
`cloudrun/valhalla-cloud-run-entrypoint.sh`. That entrypoint makes Valhalla
listen on Cloud Run's injected `PORT` value.

If Cloud Run logs `sudo: /usr/bin/sudo must be owned by uid 0 and have the
setuid bit set`, make sure the service is building the root `Dockerfile` from a
commit that uses `ghcr.io/valhalla/valhalla-scripted:latest`. The older GIS-OPS
image startup path is not compatible with Cloud Run's setuid restrictions.

If the revision shows the `gcr.io/cloudrun/placeholder` image, that is not the
Valhalla container. Check the build logs, fix the build or port settings, and
deploy a new revision from the built image.

## Operational Note

The Valhalla image builds tiles under `/custom_files` on startup. Cloud Run's
container filesystem is ephemeral, so a new revision or cold instance can rebuild
tiles. This is acceptable for a small beta graph, but a production deployment
should prebuild tiles into the image or use a persistent storage strategy.
