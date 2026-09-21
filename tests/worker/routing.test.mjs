import assert from "node:assert/strict";
import test from "node:test";
import worker from "../../worker/index.mjs";
import { validateGoogleRequest } from "../../worker/routing/contract.mjs";
import { generateSynthetic } from "../../worker/routing/synthetic.mjs";
import sample from "../../worker/routing/fixtures/albany-walk-from-600s.request.json" with { type: "json" };
import disconnected from "../../worker/routing/fixtures/albany-drive-disconnected-900s.request.json" with { type: "json" };

const env = { ISOCHRONE_PROVIDER: "synthetic", SYNTHETIC_MODE: "fixtures", BUILD_SHA: "test-sha", ASSETS: { fetch: () => new Response("SPA") } };
const request = (path, body, headers = {}) => new Request(`https://mapgap.test${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const legacy = (ranges, provider = "synthetic") => ({ provider, point: { lat: 42.6526, lng: -73.7562 }, ranges, transportMode: "foot-walking" });

test("Google-shaped response contains only the documented envelope; identity is in headers", async () => {
  const response = await worker.fetch(request("/api/isochrones:generate", sample), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-mapgap-mock"), "true");
  assert.equal(response.headers.get("x-mapgap-provider"), "synthetic");
  assert.equal(response.headers.get("x-mapgap-request-count"), "1");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.deepEqual(Object.keys(data), ["isochrone"]);
  assert.equal(data.isochrone.geoJson.type, "Polygon");
  const ring = data.isochrone.geoJson.coordinates[0];
  assert.deepEqual(ring.at(-1), ring[0]);
  assert.ok(ring.every(([lng, lat]) => lng < -70 && lat > 40));
});

test("holes and disconnected components survive both adapters", async () => {
  const hole = await worker.fetch(request("/api/isochrones:generate?scenario=albany-walk-hole-600s", sample), env);
  assert.equal((await hole.json()).isochrone.geoJson.coordinates.length, 2);
  const multi = generateSynthetic(disconnected, { scenario: "albany-drive-disconnected-900s" });
  assert.equal(multi.isochrone.geoJson.type, "MultiPolygon");
  assert.equal(multi.isochrone.geoJson.coordinates.length, 2);
  const shim = await worker.fetch(request("/api/routing/isochrones?scenario=albany-walk-hole-600s", legacy([600])), env);
  const result = await shim.json();
  assert.equal(result.features[0].geometry.coordinates.length, 2);
  assert.equal(result.features[0].properties.value, 600);
  assert.equal(result.features[0].properties.routingProvider, "synthetic");
});

test("inbound has distinct geometry and preserved TO identity", async () => {
  const from = generateSynthetic(sample);
  const to = generateSynthetic({ ...sample, travelDirection: "TO" });
  assert.notDeepEqual(from, to);
  const result = await (await worker.fetch(request("/api/routing/isochrones", { ...legacy([600]), direction: "TO" }), env)).json();
  assert.equal(result.features[0].properties.direction, "TO");
  assert.deepEqual(result.features[0].geometry, to.isochrone.geoJson);
});

test("fixture mode rejects unmatched and mismatched requests", async () => {
  const response = await worker.fetch(request("/api/isochrones:generate", { ...sample, location: { latitude: 42.7798, longitude: -73.8457 } }), env);
  assert.equal(response.status, 404);
  const mismatch = await worker.fetch(request("/api/isochrones:generate?scenario=albany-walk-from-300s", sample), env);
  assert.equal(mismatch.status, 409);
});

test("partial threshold failures retain identities and count every attempted contour", async () => {
  const response = await worker.fetch(request("/api/routing/isochrones", legacy([300, 600, 900])), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.features.map((feature) => feature.properties.value), [300, 600]);
  assert.equal(data.mapgap.requestedCount, 3);
  assert.equal(data.mapgap.completedCount, 2);
  assert.equal(data.mapgap.failures[0].seconds, 900);
  assert.equal(data.mapgap.mock, true);
});

test("error simulations preserve HTTP status and Retry-After", async () => {
  for (const code of [400, 403, 404, 429, 503]) {
    const response = await worker.fetch(request(`/api/isochrones:generate?scenario=error-${code}`, sample), env);
    assert.equal(response.status, code);
    assert.equal((await response.json()).error.code, code);
    if (code === 429) assert.equal(response.headers.get("retry-after"), "2");
  }
});

test("validation rejects ambiguous origins, invalid bounds/durations and unknown fields", () => {
  for (const input of [null, [], {}, { ...sample, place: "places/x" }, { ...sample, travelDuration: "0s" },
    { ...sample, travelDuration: "7200.1s" }, { ...sample, travelMode: "DRIVE", travelDuration: "3601s" },
    { ...sample, location: { latitude: 91, longitude: 0 } }, { ...sample, location: { latitude: "42", longitude: 0 } },
    { ...sample, travelDirection: "UP" }, { ...sample, enableSmoothing: "false" }, { ...sample, apiKey: "never-accepted" }]) {
    assert.throws(() => validateGoogleRequest(input), { code: 400 });
  }
  assert.doesNotThrow(() => validateGoogleRequest({ ...sample, travelDuration: "3.5s" }));
  assert.doesNotThrow(() => validateGoogleRequest({ ...sample, travelDuration: "7200s" }));
});

test("schematic mode is deterministic, closed and explicit; place IDs do not invent locations", async () => {
  const input = { ...sample, location: { latitude: 42.7798, longitude: -73.8457 }, travelDuration: "333.5s" };
  const first = generateSynthetic(input, { mode: "schematic" });
  assert.deepEqual(first, generateSynthetic(input, { mode: "schematic" }));
  assert.equal(first.isochrone.geoJson.coordinates[0].length, 65);
  const { location, ...rest } = sample;
  const response = await worker.fetch(request("/api/isochrones:generate", { ...rest, place: "places/example" }), { ...env, SYNTHETIC_MODE: "schematic" });
  assert.equal(response.status, 404);
});

test("mock generation and health make no network calls; disabled real providers fail closed", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Unexpected network call"); };
  try {
    assert.equal((await worker.fetch(request("/api/isochrones:generate", sample), env)).status, 200);
    for (const provider of ["google", "valhalla", "ors"]) {
      assert.equal((await worker.fetch(request("/api/routing/isochrones", legacy([600], provider)), env)).status, 503);
    }
    assert.equal((await worker.fetch(request("/api/isochrones:generate", sample), { ...env, ISOCHRONE_PROVIDER: "google" })).status, 503);
    const health = await (await worker.fetch(new Request("https://mapgap.test/api/health"), env)).json();
    assert.equal(health.app, "ready");
    assert.equal(health.status, "degraded");
    assert.equal(health.mock, true);
    assert.equal(health.google, false);
    assert.equal(health.valhalla, false);
    assert.equal(health.buildSha, "test-sha");
    assert.ok(health.publicSources.every((source) => source.status === "not_checked"));
  } finally { globalThis.fetch = original; }
});

test("API errors never fall through to SPA, and body limits are enforced", async () => {
  assert.equal((await worker.fetch(new Request("https://mapgap.test/api/missing", { headers: { "Sec-Fetch-Mode": "navigate" } }), env)).status, 404);
  assert.equal((await worker.fetch(new Request("https://mapgap.test/api/isochrones:generate"), env)).status, 405);
  assert.equal((await worker.fetch(request("/api/isochrones:generate", { junk: "x".repeat(20_000) }), env)).status, 413);
  assert.equal((await worker.fetch(new Request("https://mapgap.test/api/isochrones:generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }), env)).status, 400);
  assert.equal(await (await worker.fetch(new Request("https://mapgap.test/v2"), env)).text(), "SPA");
});
