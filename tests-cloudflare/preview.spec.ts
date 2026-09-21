import { expect, test, type Page } from "@playwright/test";

// Only external map tiles and source records are stubbed. Routing and health
// run against the actual bundled Worker and SPA under workerd.
async function openLibraries(page: Page) {
  await page.route(/tile\.openstreetmap\.org|basemaps\.cartocdn\.com/, (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/service-points?**", (route) => route.fulfill({
    json: {
      category: "library", label: "Libraries", count: 2,
      sources: ["ny_libraries"], warnings: [],
      points: [
        { id: "canary-1", name: "Canary library 1", location: { lat: 42.7798, lng: -73.8457 } },
        { id: "canary-2", name: "Canary library 2", location: { lat: 42.7828, lng: -73.8397 } },
      ].map((point) => ({ ...point, category: "library", source: "ny_libraries", datasetId: "nys-public-libraries", address: "Test source record", sourceUrl: "https://example.invalid/test", sourceUpdatedAt: null })),
    },
  }));
  await page.goto("/v2");
  await expect(page.getByRole("complementary", { name: "Routing status" })).toContainText("Mock isochrones");
  await page.getByRole("button", { name: "Explore Nearby" }).click();
  const drawer = page.locator('section[aria-label="Nearby access drawer"]');
  await drawer.getByRole("button", { name: /Libraries/ }).click();
  await expect(drawer.getByText("2 places", { exact: true })).toBeVisible();
  return drawer;
}

test("Worker health, API errors and Google-shaped mock work in the Cloudflare runtime", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(await health.json()).toMatchObject({ app: "ready", status: "degraded", mock: true, provider: "synthetic", google: false, valhalla: false });
  const missing = await request.get("/api/not-an-endpoint", { headers: { "Sec-Fetch-Mode": "navigate" } });
  expect(missing.status()).toBe(404);
  expect(missing.headers()["content-type"]).toContain("application/json");
  const response = await request.post("/api/isochrones:generate", {
    data: { location: { latitude: 42.7798, longitude: -73.8457 }, travelDuration: "600s", travelMode: "WALK", travelDirection: "FROM" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["x-mapgap-mock"]).toBe("true");
  const body = await response.json();
  expect(Object.keys(body)).toEqual(["isochrone"]);
  expect(body.isochrone.geoJson.type).toBe("Polygon");
  const catalog = await (await request.get("/api/layers")).json();
  expect(JSON.stringify(catalog)).toContain("nys-public-libraries");
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`labeled mock contours render at ${viewport.width}px without live Google calls`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    const googleCalls: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (/googleapis\.com/.test(request.url())) googleCalls.push(request.url()); });
    const drawer = await openLibraries(page);
    await drawer.getByRole("button", { name: "Walk", exact: true }).click();
    const notice = page.getByRole("complementary", { name: "Routing status" });
    await expect(notice).toContainText("Mock isochrones — schematic reach, not network travel time.");
    await expect(notice).toContainText("4 contours returned");
    await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(googleCalls).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`mock-${viewport.width}.png`), fullPage: true });
  });
}

test("turning heat off aborts an in-flight run and prevents late contours", async ({ page }) => {
  const drawer = await openLibraries(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let entered = 0;
  await page.route("**/api/routing/isochrones", async (route) => {
    entered++;
    await gate;
    await route.continue().catch(() => {}); // Aborted browser requests can already be closed.
  });
  await drawer.getByRole("button", { name: "Walk", exact: true }).click();
  await expect.poll(() => entered).toBe(2);
  await drawer.getByRole("button", { name: "Off", exact: true }).click();
  release();
  await expect(page.getByRole("button", { name: "Cancel generation" })).toHaveCount(0);
  await expect(page.locator(".mapiso-raster-isochrones")).toHaveCount(0);
  // Let both delayed routes complete and verify that neither repopulates the store.
  await page.waitForTimeout(400);
  await expect(page.getByRole("complementary", { name: "Routing status" })).not.toContainText("contours returned");
  await expect(page.locator(".mapiso-raster-isochrones")).toHaveCount(0);
});

test("one failed origin retains successful contours and displays partial results", async ({ page }) => {
  const drawer = await openLibraries(page);
  await page.route("**/api/routing/isochrones", async (route) => {
    const input = route.request().postDataJSON();
    if (input.point.name === "Canary library 2") {
      await route.fulfill({ status: 503, json: { error: { code: 503, status: "UNAVAILABLE", message: "Simulated origin failure." } } });
    } else {
      await route.continue();
    }
  });
  await drawer.getByRole("button", { name: "Walk", exact: true }).click();
  const notice = page.getByRole("complementary", { name: "Routing status" });
  await expect(notice).toContainText("2 contours returned · Partial results");
  await expect(notice.getByRole("alert")).toContainText("Canary library 2");
  await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible();
});
