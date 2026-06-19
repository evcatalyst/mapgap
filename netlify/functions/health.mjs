import { hasConfiguredSecret } from "./_secrets.mjs";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const VALHALLA_HEALTH_TIMEOUT_MS = 4000;

function getValhallaBaseUrl() {
  return process.env.VALHALLA_BASE_URL?.trim().replace(/\/+$/, "");
}

async function fetchValhallaJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(VALHALLA_HEALTH_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("json")) {
    return undefined;
  }

  return response.json();
}

async function checkValhallaStatus(baseUrl) {
  const data = await fetchValhallaJson(`${baseUrl}/status`);

  return Boolean(data && typeof data === "object");
}

async function checkValhallaIsochrone(baseUrl) {
  const data = await fetchValhallaJson(`${baseUrl}/isochrone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locations: [
        {
          lat: 42.7798,
          lon: -73.8457,
          radius: 1200,
          minimum_reachability: 20,
        },
      ],
      costing: "pedestrian",
      contours: [{ time: 1 }],
      polygons: false,
      show_locations: false,
    }),
  });

  return (
    data?.type === "FeatureCollection" &&
    Array.isArray(data.features) &&
    data.features.length > 0
  );
}

async function checkValhalla() {
  const baseUrl = getValhallaBaseUrl();

  if (!baseUrl) {
    return false;
  }

  try {
    if (await checkValhallaStatus(baseUrl)) {
      return true;
    }

    return await checkValhallaIsochrone(baseUrl);
  } catch {
    return false;
  }
}

export async function handler() {
  const openRouteService = hasConfiguredSecret("OPENROUTE_SERVICE_API_KEY");
  const openCage = hasConfiguredSecret("OPENCAGE_API_KEY");
  const valhallaRequiresSecret = hasConfiguredSecret("VALHALLA_SHARED_SECRET");
  const valhalla = await checkValhalla();
  const hasRouting = openRouteService || valhalla;
  const status = hasRouting ? "ready" : "degraded";
  const message =
    status === "ready"
      ? [
          "At least one routing provider is available.",
          openCage ? "Geocoding is configured." : "Reverse geocoding is disabled until OPENCAGE_API_KEY is set.",
        ].join(" ")
      : "One or more routing/geocoding services are unavailable in the Netlify environment.";

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      status,
      message,
      openRouteService,
      valhalla,
      valhallaRequiresSecret,
      openCage,
    }),
  };
}
