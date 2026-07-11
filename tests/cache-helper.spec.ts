import { expect, test } from "@playwright/test";

test("serverless cache helper returns stable cloned payloads and metadata", async () => {
  const { getCached, makeCacheKey, setCached, withCacheMetadata } = await import(
    "../netlify/functions/_cache.mjs"
  );
  const cache = new Map();
  const key = makeCacheKey("poi", {
    bbox: { west: -74, south: 40, east: -73, north: 41 },
    category: "laundry",
    query: "",
  });

  const stored = setCached(cache, key, { points: [{ name: "A" }] }, 30_000);
  stored.value.points[0].name = "mutated outside cache";

  const cached = getCached(cache, key);

  expect(stored.meta.hit).toBe(false);
  expect(cached?.meta.hit).toBe(true);
  expect(cached?.value.points[0].name).toBe("A");
  expect(withCacheMetadata(cached?.value, cached?.meta).cache.hit).toBe(true);
});
