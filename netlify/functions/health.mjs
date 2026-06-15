const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function hasSecret(name) {
  const value = process.env[name]?.trim();
  return Boolean(value);
}

export async function handler() {
  const openRouteService = hasSecret("OPENROUTE_SERVICE_API_KEY");
  const openCage = hasSecret("OPENCAGE_API_KEY");
  const status = openRouteService && openCage ? "ready" : "degraded";
  const message =
    status === "ready"
      ? "Routing and geocoding keys are configured."
      : "One or more API keys are missing in the Netlify environment.";

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      status,
      message,
      openRouteService,
      openCage,
    }),
  };
}
