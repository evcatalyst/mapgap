import assert from "node:assert/strict";
import test from "node:test";
import { catalog, lookupSource, parseBbox } from "../../worker/sources.mjs";

const bbox = [-73.98, 42.65, -73.65, 42.88];
const row = (id, name = "Test library") => ({ attributes: { OBJECTID: id, LEGAL_NAME: name, PHYSADDRLINE1: "1 Example St" }, geometry: { x: -73.8, y: 42.75 } });

test("ArcGIS lookup follows pages with WGS84 output and retains provenance", async () => {
  const urls = [];
  const result = await lookupSource("nys-public-libraries", bbox, {}, { fetcher: async (url, options) => {
    urls.push(url);
    assert.equal(url.searchParams.get("outSR"), "4326");
    assert.equal(options.redirect, "error");
    return Response.json({ features: [row(urls.length)], exceededTransferLimit: urls.length === 1 });
  } });
  assert.equal(result.count, 2);
  assert.equal(urls[1].searchParams.get("resultOffset"), "1");
  assert.equal(result.completeness.complete, true);
  assert.equal(result.points[0].source, "ny_libraries");
  assert.match(result.points[0].provenance.sourceUrl, /FeatureServer\/15$/);
  assert.equal(result.freshness.sourceUpdatedAt, null);
});

test("invalid geometry and duplicates cannot masquerade as complete data", async () => {
  const result = await lookupSource("nys-public-libraries", bbox, {}, { fetcher: async () => Response.json({ features: [row(1), row(1), { ...row(3), geometry: { x: 200, y: 42 } }] }) });
  assert.equal(result.count, 1);
  assert.equal(result.completeness.discarded, 2);
  assert.equal(result.completeness.complete, false);
  assert.ok(result.warnings.length);
});

test("later page failure returns explicit partial results; total failure returns an error", async () => {
  let page = 0;
  const result = await lookupSource("nys-public-libraries", bbox, {}, { fetcher: async () => ++page === 1 ? Response.json({ features: [row(1)], exceededTransferLimit: true }) : new Response("offline", { status: 503 }) });
  assert.equal(result.count, 1);
  assert.equal(result.completeness.truncated, true);
  assert.match(result.warnings[0], /partial/);
  await assert.rejects(lookupSource("nys-public-libraries", bbox, {}, { fetcher: async () => { throw new Error("private upstream details"); } }), { code: 502, status: "SOURCE_UNAVAILABLE" });
});

test("Socrata uses fixed hosts and sends app tokens only upstream", async () => {
  let requestUrl;
  const result = await lookupSource("nys-farmers-markets", bbox, { SODA_APP_TOKEN: "test-token-not-returned" }, { fetcher: async (url, options) => {
    requestUrl = url;
    assert.equal(options.headers["X-App-Token"], "test-token-not-returned");
    return Response.json([{ row_id: "row-1", market_name: "Example market", georeference_1: { type: "Point", coordinates: [-73.8, 42.75] } }]);
  } });
  assert.equal(requestUrl.hostname, "data.ny.gov");
  // SoQL requires wildcard selections before explicit fields (the portal
  // rejects ':id as row_id,*' even though a permissive stub would accept it).
  assert.equal(requestUrl.searchParams.get("$select"), "*, :id as row_id");
  assert.match(requestUrl.searchParams.get("$where"), /^within_box\(georeference_1,/);
  assert.equal(result.points[0].sourceDatasetId, "qq4h-8p86");
  assert.ok(!JSON.stringify(result).includes("test-token-not-returned"));
});

test("source scans are bounded and catalog does not advertise private uploads", async () => {
  let calls = 0;
  const result = await lookupSource("nys-public-libraries", bbox, {}, { fetcher: async () => {
    calls++;
    return Response.json({ features: Array.from({ length: 100 }, (_, n) => row(calls * 100 + n)), exceededTransferLimit: true });
  } });
  assert.equal(calls, 3);
  assert.equal(result.count, 300);
  assert.equal(result.completeness.truncated, true);
  assert.equal(catalog().imports.enabled, false);
  assert.equal(catalog().layers.length, 3);
  await assert.rejects(lookupSource("https://untrusted.example", bbox, {}), { code: 404 });
});

test("reject invalid, inverted and excessively large viewports", () => {
  for (const value of [null, "-74,42,-73", "-74,, -73,43", "-74,42,20,43", "-73,42,-74,43", "x,42,-73,43"]) assert.throws(() => parseBbox(value), { code: 400 });
  assert.deepEqual(parseBbox(bbox.join(",")), bbox);
});
