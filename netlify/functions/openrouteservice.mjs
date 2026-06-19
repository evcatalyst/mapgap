import { getConfiguredSecret } from "./_secrets.mjs";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const ALLOWED_PATH_PREFIX = "v2/isochrones/";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

function getTargetPath(event) {
  const path = event.queryStringParameters?.path || "";
  return path.replace(/^\/+/, "");
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "OpenRouteService proxy only accepts POST requests." });
  }

  const apiKey = getConfiguredSecret("OPENROUTE_SERVICE_API_KEY");

  if (!apiKey) {
    return json(503, {
      message: "OPENROUTE_SERVICE_API_KEY is not configured in Netlify.",
    });
  }

  const targetPath = getTargetPath(event);

  if (!targetPath.startsWith(ALLOWED_PATH_PREFIX)) {
    return json(400, { message: "Unsupported OpenRouteService proxy path." });
  }

  const response = await fetch(`${ORS_BASE_URL}/${targetPath}`, {
    method: "POST",
    headers: {
      Accept: event.headers.accept || "application/json, application/geo+json",
      Authorization: apiKey,
      "Content-Type": event.headers["content-type"] || "application/json",
    },
    body: event.body || "{}",
  });

  return {
    statusCode: response.status,
    headers: {
      ...corsHeaders,
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Retry-After": response.headers.get("retry-after") || "",
    },
    body: await response.text(),
  };
}
