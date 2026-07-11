import { expect, test, type Page } from "@playwright/test";

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/az8Y2QAAAAASUVORK5CYII=",
  "base64",
);

async function mockBaseRoutes(page: Page) {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        message: "Valhalla beta ready for performance testing.",
        openRouteService: false,
        valhalla: true,
        valhallaRequiresSecret: false,
        openCage: false,
      }),
    });
  });

  await page.route(/tile\.openstreetmap\.org|basemaps\.cartocdn\.com/, async (route) => {
    await route.fulfill({
      contentType: "image/png",
      body: transparentPng,
    });
  });

  await page.route("**/api/poi/search**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        source: "google",
        category: "laundry",
        label: "Laundromats",
        points: Array.from({ length: 8 }, (_, index) => ({
          id: `laundromat-${index}`,
          source: "google",
          sourceId: `laundromat-${index}`,
          category: "laundry",
          name: `Performance Laundromat ${index + 1}`,
          address: "Current map view",
          lat: 42.7798 + index * 0.002,
          lng: -73.8457 - index * 0.002,
        })),
      }),
    });
  });
}

test("Valhalla isochrone requests run with bounded parallelism", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockBaseRoutes(page);

  let activeRequests = 0;
  let maxActiveRequests = 0;
  let requestCount = 0;

  await page.route("**/api/routing/isochrones", async (route) => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    requestCount += 1;

    const body = route.request().postDataJSON() as {
      point: { lat: number; lng: number };
      buckets: Array<{ bucketMinutes: number; requestSeconds: number }>;
    };

    await new Promise((resolve) => setTimeout(resolve, 240));
    activeRequests -= 1;

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features: body.buckets.map((bucket, index) => {
          const offset = 0.002 + index * 0.001;

          return {
            type: "Feature",
            properties: { value: bucket.requestSeconds },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [body.point.lng - offset, body.point.lat - offset],
                  [body.point.lng + offset, body.point.lat - offset],
                  [body.point.lng + offset, body.point.lat + offset],
                  [body.point.lng - offset, body.point.lat + offset],
                  [body.point.lng - offset, body.point.lat - offset],
                ],
              ],
            },
          };
        }),
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByText("API ready")).toBeVisible();

  const start = Date.now();
  await page
    .getByRole("button", { name: "Run laundromat walkability in current map view" })
    .click();
  await expect(page.getByText("16 rings").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible();
  const durationMs = Date.now() - start;

  expect(requestCount).toBe(8);
  expect(maxActiveRequests).toBeGreaterThan(1);
  expect(maxActiveRequests).toBeLessThanOrEqual(4);
  expect(durationMs).toBeLessThan(2_500);
});
