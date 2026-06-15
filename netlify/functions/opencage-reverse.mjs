const OPENCAGE_URL = "https://api.opencagedata.com/geocode/v1/json";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function parseCoordinate(value, name) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsed;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { message: "OpenCage reverse geocoding only accepts GET requests." });
  }

  const apiKey = process.env.OPENCAGE_API_KEY?.trim();

  if (!apiKey) {
    return json(503, {
      message: "OPENCAGE_API_KEY is not configured in Netlify.",
    });
  }

  let lat;
  let lng;

  try {
    lat = parseCoordinate(event.queryStringParameters?.lat, "lat");
    lng = parseCoordinate(event.queryStringParameters?.lng, "lng");
  } catch (error) {
    return json(400, {
      message: error instanceof Error ? error.message : "Invalid coordinates.",
    });
  }

  const params = new URLSearchParams({
    q: `${lat},${lng}`,
    key: apiKey,
    no_annotations: "1",
    limit: "1",
  });

  const response = await fetch(`${OPENCAGE_URL}?${params}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const raw = await response.text();

  if (!response.ok) {
    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
      body: raw,
    };
  }

  const data = JSON.parse(raw);

  return json(200, {
    formatted: data.results?.[0]?.formatted,
  });
}
