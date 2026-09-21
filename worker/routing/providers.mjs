import { ApiError } from "../http.mjs";
import { SCHEMA_VERSION, SYNTHETIC_NOTICE, toGoogleRequest } from "./contract.mjs";
import { generateSynthetic } from "./synthetic.mjs";

export function assertProviderEnabled(provider, env) {
  if (provider !== "synthetic" || env.ISOCHRONE_PROVIDER !== "synthetic") {
    throw new ApiError(503, "PROVIDER_NOT_ENABLED", `${provider} is not enabled in this preview. A failed live request is never replaced with mock data.`);
  }
}

export function googleResponse(request, env, scenario) {
  assertProviderEnabled(env.ISOCHRONE_PROVIDER, env);
  return generateSynthetic(request, { mode: env.SYNTHETIC_MODE, scenario });
}

export function generateAnalysis(analysis, env, scenario) {
  assertProviderEnabled(analysis.provider, env);
  const features = [];
  const failures = [];
  for (const seconds of analysis.thresholdsSeconds) {
    try {
      const raw = googleResponse(toGoogleRequest(analysis, seconds), env, scenario);
      features.push({
        type: "Feature",
        geometry: raw.isochrone.geoJson,
        properties: {
          value: seconds,
          provider: analysis.provider,
          routingProvider: analysis.provider,
          mock: true,
          synthetic: true,
          notice: SYNTHETIC_NOTICE,
          direction: analysis.direction,
          origin: analysis.origin,
        },
      });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      failures.push({ seconds, code: error.code, status: error.status, message: error.message });
    }
  }
  if (!features.length) {
    const first = failures[0];
    throw new ApiError(first.code, first.status, first.message, first.code === 429 ? { "Retry-After": "2" } : {});
  }
  return {
    type: "FeatureCollection",
    features,
    mapgap: {
      schemaVersion: SCHEMA_VERSION,
      provider: analysis.provider,
      mock: true,
      notice: SYNTHETIC_NOTICE,
      requestedCount: analysis.thresholdsSeconds.length,
      completedCount: features.length,
      failures,
    },
  };
}
