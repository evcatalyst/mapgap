import { ApiError, errorResponse, json, readJson, requireMethod } from "./http.mjs";
import { SCHEMA_VERSION, SYNTHETIC_NOTICE, legacyToAnalysis, validateGoogleRequest } from "./routing/contract.mjs";
import { generateAnalysis, googleResponse } from "./routing/providers.mjs";
import { scenarios } from "./routing/synthetic.mjs";
import { catalog, lookupSource, parseBbox, sourceHealth } from "./sources.mjs";

const syntheticHeaders = {
  "X-MapGap-Provider": "synthetic",
  "X-MapGap-Mock": "true",
  "X-MapGap-Schema": SCHEMA_VERSION,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === "/api/health") {
        requireMethod(request, "GET");
        const mockReady = env.ISOCHRONE_PROVIDER === "synthetic" && ["fixtures", "schematic"].includes(env.SYNTHETIC_MODE);
        return json({
          status: "degraded", app: "ready", message: mockReady ? SYNTHETIC_NOTICE : "No routing provider is enabled.",
          provider: env.ISOCHRONE_PROVIDER ?? null, mock: mockReady, synthetic: mockReady,
          syntheticMode: mockReady ? env.SYNTHETIC_MODE : null,
          openRouteService: false, valhalla: false, valhallaRequiresSecret: false, openCage: false, google: false,
          buildSha: env.BUILD_SHA ?? "unknown", schemaVersion: SCHEMA_VERSION,
          providers: {
            synthetic: { ready: mockReady, networkTravelTimes: false },
            valhalla: { ready: false, reason: "Regional container pilot pending acceptance." },
            google: { ready: false, reason: "Credentials, renderer and usage gates pending." },
          },
          publicSources: sourceHealth(),
        });
      }
      if (url.pathname === "/api/isochrones/scenarios") {
        requireMethod(request, "GET");
        return json(scenarios);
      }
      if (url.pathname === "/api/isochrones:generate") {
        requireMethod(request, "POST");
        const input = validateGoogleRequest(await readJson(request));
        return json(googleResponse(input, env, url.searchParams.get("scenario")), 200, { ...syntheticHeaders, "X-MapGap-Request-Count": "1" });
      }
      if (url.pathname === "/api/routing/isochrones") {
        requireMethod(request, "POST");
        const input = await readJson(request);
        const result = generateAnalysis(legacyToAnalysis(input), env, url.searchParams.get("scenario"));
        return json(result, 200, { ...syntheticHeaders, "X-MapGap-Request-Count": String(result.mapgap.requestedCount) });
      }
      if (url.pathname === "/api/layers") {
        requireMethod(request, "GET");
        return json(catalog());
      }
      const layerMatch = url.pathname.match(/^\/api\/layers\/([a-z0-9-]+)\/features$/);
      if (layerMatch || url.pathname === "/api/service-points") {
        requireMethod(request, "GET");
        const id = layerMatch?.[1] ?? url.searchParams.get("datasetId") ?? (url.searchParams.get("category") === "library" ? "nys-public-libraries" : null);
        if (!id) throw new ApiError(503, "SOURCE_NOT_ENABLED", "This preview supports the NY public catalog. Choose Libraries; other legacy place providers are not enabled yet.");
        const result = await lookupSource(id, parseBbox(url.searchParams.get("bbox")), env, { signal: request.signal });
        if (!layerMatch) return json(result);
        return json({
          type: "FeatureCollection",
          features: result.points.map(({ location, ...properties }) => ({ type: "Feature", geometry: { type: "Point", coordinates: [location.lng, location.lat] }, properties })),
          mapgap: { datasetId: id, count: result.count, completeness: result.completeness, freshness: result.freshness, warnings: result.warnings },
        });
      }
      throw new ApiError(404, "NOT_FOUND", "Unknown API route.");
    } catch (error) {
      return errorResponse(error);
    }
  },
};
