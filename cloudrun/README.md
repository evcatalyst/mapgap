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
Container port: 8002
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

Once the service responds, set this Netlify environment variable:

```bash
VALHALLA_BASE_URL=https://YOUR-CLOUD-RUN-SERVICE-URL
```

Do not include `/status` or `/isochrone`; MapGap appends those paths in the
Netlify functions.

Validate the service before updating Netlify:

```bash
curl https://YOUR-CLOUD-RUN-SERVICE-URL/status
```

## Operational Note

The Valhalla image builds tiles under `/custom_files` on startup. Cloud Run's
container filesystem is ephemeral, so a new revision or cold instance can rebuild
tiles. This is acceptable for a small beta graph, but a production deployment
should prebuild tiles into the image or use a persistent storage strategy.
