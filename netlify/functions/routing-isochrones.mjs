import { getConfiguredSecret } from "./_secrets.mjs";
import { timingSafeEqual } from "crypto";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const ORS_ISOCHRONE_SMOOTHING = 85;
const VALHALLA_MAX_CONTOURS_PER_REQUEST = 4;
const VALHALLA_SECRET_HEADER = "X-Valhalla-Shared-Secret";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const ORS_PROFILES = new Set(["driving-car", "cycling-regular", "foot-walking"]);

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

function decodeBody(event) {
  const raw = event.body || "{}";
  return event.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;
}

function parsePayload(event) {
  try {
    return JSON.parse(decodeBody(event));
  } catch {
    return undefined;
  }
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizePoint(point) {
  const lat = normalizeNumber(point?.lat);
  const lng = normalizeNumber(point?.lng);

  if (lat === undefined || lng === undefined || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined;
  }

  return { lat, lng };
}

function normalizeRanges(ranges) {
  if (!Array.isArray(ranges)) {
    return [];
  }

  return ranges
    .map(normalizeNumber)
    .filter((value) => value !== undefined && value > 0 && value <= 14400)
    .sort((a, b) => a - b);
}

function forwardHeaders(response) {
  const headers = {
    ...corsHeaders,
    "Content-Type": response.headers.get("content-type") || "application/json",
  };
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    headers["Retry-After"] = retryAfter;
  }

  return headers;
}

async function proxyOpenRouteService(payload, point, ranges, event) {
  const apiKey = getConfiguredSecret("OPENROUTE_SERVICE_API_KEY");
  const profile = payload.transportMode;

  if (!apiKey) {
    return json(503, {
      message: "OPENROUTE_SERVICE_API_KEY is not configured in Netlify.",
    });
  }

  if (!ORS_PROFILES.has(profile)) {
    return json(400, { message: "Unsupported OpenRouteService transport mode." });
  }

  const response = await fetch(`${ORS_BASE_URL}/v2/isochrones/${profile}`, {
    method: "POST",
    headers: {
      Accept: event.headers.accept || "application/json, application/geo+json",
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locations: [[point.lng, point.lat]],
      range: ranges,
      range_type: "time",
      location_type: "start",
      attributes: ["area", "reachfactor"],
      smoothing: ORS_ISOCHRONE_SMOOTHING,
    }),
  });

  return {
    statusCode: response.status,
    headers: forwardHeaders(response),
    body: await response.text(),
  };
}

function getValhallaCosting(payload) {
  const mobilityMode = payload.mobilityMode;

  if (payload.transportMode === "driving-car") {
    return {
      costing: "auto",
      costing_options: {},
    };
  }

  if (payload.transportMode === "cycling-regular" || mobilityMode === "bike") {
    return {
      costing: "bicycle",
      costing_options: {
        bicycle: {
          use_hills: 0.55,
        },
      },
    };
  }

  if (mobilityMode === "senior") {
    return {
      costing: "pedestrian",
      costing_options: {
        pedestrian: {
          walking_speed: 3.4,
          use_hills: 0.1,
        },
      },
    };
  }

  if (mobilityMode === "stroller") {
    return {
      costing: "pedestrian",
      costing_options: {
        pedestrian: {
          walking_speed: 3.8,
          use_hills: 0.05,
        },
      },
    };
  }

  return {
    costing: "pedestrian",
    costing_options: {
      pedestrian: {
        walking_speed: 5.1,
        use_hills: 0.45,
      },
    },
  };
}

function normalizeValhallaBaseUrl() {
  return process.env.VALHALLA_BASE_URL?.trim().replace(/\/+$/, "");
}

function getPayloadValhallaSecret(payload) {
  return typeof payload.valhallaSharedSecret === "string"
    ? payload.valhallaSharedSecret.trim()
    : "";
}

function secretsMatch(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function authorizeValhalla(payload) {
  const expectedSecret = getConfiguredSecret("VALHALLA_SHARED_SECRET");

  if (!expectedSecret) {
    return undefined;
  }

  const actualSecret = getPayloadValhallaSecret(payload);

  if (!actualSecret) {
    return json(401, {
      message: "Enter Valhalla access secret.",
    });
  }

  if (!secretsMatch(expectedSecret, actualSecret)) {
    return json(403, {
      message: "Valhalla access secret is incorrect.",
    });
  }

  return undefined;
}

function getValhallaProxyHeaders(event) {
  const sharedSecret = getConfiguredSecret("VALHALLA_SHARED_SECRET");
  const headers = {
    Accept: event.headers.accept || "application/json, application/geo+json",
    "Content-Type": "application/json",
  };

  if (sharedSecret) {
    headers[VALHALLA_SECRET_HEADER] = sharedSecret;
  }

  return headers;
}

function chunkArray(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function fetchValhallaIsochroneChunk(baseUrl, event, point, costing, costing_options, contours) {
  return fetch(`${baseUrl}/isochrone`, {
    method: "POST",
    headers: getValhallaProxyHeaders(event),
    body: JSON.stringify({
      locations: [
        {
          lat: point.lat,
          lon: point.lng,
          radius: 1200,
          minimum_reachability: 20,
        },
      ],
      costing,
      costing_options,
      contours,
      polygons: true,
      denoise: 0.2,
      generalize: 12,
      show_locations: false,
    }),
  });
}

async function proxyValhalla(payload, point, ranges, event) {
  const authResponse = authorizeValhalla(payload);

  if (authResponse) {
    return authResponse;
  }

  const baseUrl = normalizeValhallaBaseUrl();

  if (!baseUrl) {
    return json(503, {
      message: "VALHALLA_BASE_URL is not configured. Start local Valhalla or switch to ORS.",
    });
  }

  const { costing, costing_options } = getValhallaCosting(payload);
  const contours = ranges.map((seconds) => ({
    time: Math.max(1, Math.round(seconds / 60)),
  }));
  const contourChunks = chunkArray(contours, VALHALLA_MAX_CONTOURS_PER_REQUEST);
  const featureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  let responseHeaders;

  for (const contourChunk of contourChunks) {
    const response = await fetchValhallaIsochroneChunk(
      baseUrl,
      event,
      point,
      costing,
      costing_options,
      contourChunk,
    );

    responseHeaders = forwardHeaders(response);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: await response.text(),
      };
    }

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return json(502, {
        message: "Valhalla returned a non-JSON isochrone response.",
      });
    }

    if (Array.isArray(data.features)) {
      featureCollection.features.push(...data.features);
    }
  }

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      ...(responseHeaders || {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(featureCollection),
  };
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
    return json(405, { message: "Routing proxy only accepts POST requests." });
  }

  const payload = parsePayload(event);

  if (!payload) {
    return json(400, { message: "Routing request body must be valid JSON." });
  }

  const provider = payload.provider;
  const point = normalizePoint(payload.point);
  const ranges = normalizeRanges(payload.ranges);

  if (provider !== "ors" && provider !== "valhalla") {
    return json(400, { message: "Routing request requires provider 'ors' or 'valhalla'." });
  }

  if (!point) {
    return json(400, { message: "Routing request requires a valid point with lat/lng." });
  }

  if (ranges.length === 0) {
    return json(400, { message: "Routing request requires at least one positive time range." });
  }

  try {
    return provider === "valhalla"
      ? await proxyValhalla(payload, point, ranges, event)
      : await proxyOpenRouteService(payload, point, ranges, event);
  } catch (error) {
    return json(502, {
      message:
        error instanceof Error
          ? `Routing provider request failed: ${error.message}`
          : "Routing provider request failed.",
    });
  }
}
