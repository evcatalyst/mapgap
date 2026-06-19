import { hasConfiguredSecret } from "./_secrets.mjs";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function getValhallaBaseUrl() {
  return process.env.VALHALLA_BASE_URL?.trim().replace(/\/+$/, "");
}

async function checkValhalla() {
  const baseUrl = getValhallaBaseUrl();

  if (!baseUrl) {
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/status`, {
      signal: AbortSignal.timeout(2500),
      headers: {
        Accept: "application/json",
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function handler() {
  const openRouteService = hasConfiguredSecret("OPENROUTE_SERVICE_API_KEY");
  const openCage = hasConfiguredSecret("OPENCAGE_API_KEY");
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
      openCage,
    }),
  };
}
