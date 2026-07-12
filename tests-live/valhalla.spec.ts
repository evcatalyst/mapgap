import { expect, test, type Locator, type Page } from "@playwright/test";

const secret = process.env.MAPGAP_VALHALLA_SECRET;
const liveBaseUrl = process.env.MAPGAP_LIVE_BASE_URL || "https://mapgap-access.netlify.app";
const expectNyNjValhalla = process.env.MAPGAP_EXPECT_NY_NJ_VALHALLA === "true";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "ipad-landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const mobileEdgeViewports = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "iphone-standard", width: 390, height: 844 },
  { name: "iphone-landscape", width: 844, height: 390 },
] as const;

async function mockServicePointSearch(page: Page) {
  await page.route("**/api/service-points**", async (route) => {
    const url = new URL(route.request().url());
    const category = url.searchParams.get("category") || "laundry";
    const labels: Record<string, string> = {
      coffee: "Coffee",
      grocery: "Grocery",
      library: "Library",
      laundry: "Laundry",
    };
    const label = labels[category] || "Place";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        category,
        count: 2,
        sources: ["google_places"],
        points: [
          {
            id: `google-live-${category}-1`,
            source: "google_places",
            category,
            name: `Live Viewport ${label} A`,
            address: "Niskayuna, NY",
            location: { lat: 42.7798, lng: -73.8457 },
            provenance: { label: "Google Places" },
          },
          {
            id: `google-live-${category}-2`,
            source: "google_places",
            category,
            name: `Live Viewport ${label} B`,
            address: "Niskayuna, NY",
            location: { lat: 42.7898, lng: -73.8657 },
            provenance: { label: "Google Places" },
          },
        ],
      }),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    docWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(Math.max(metrics.bodyWidth, metrics.docWidth)).toBeLessThanOrEqual(
    metrics.viewportWidth + 1,
  );
}

async function expectInsideViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();

  if (!box || !viewport) {
    return;
  }

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

async function expectV2RoutingSignal(page: Page) {
  const textSignal = page.getByText(/Heat ready|POIs only/).first();

  try {
    await expect(textSignal).toBeVisible({ timeout: 2_000 });
    return;
  } catch {
    await expect(
      page.locator('[aria-label="Heat ready"], [aria-label="POIs only"]').first(),
    ).toBeVisible();
  }
}

async function expectExploreFabInsideViewport(page: Page) {
  const exploreButton = page.getByRole("button", { name: "Explore Nearby" });
  await expect(exploreButton).toBeVisible();

  const metrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    docWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  const box = await exploreButton.boundingBox();

  expect(Math.max(metrics.bodyWidth, metrics.docWidth)).toBeLessThanOrEqual(
    metrics.viewportWidth + 1,
  );
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.describe("Live /v2 public demo endpoints", () => {
  test("published /v2 public demo entrypoint is routable", async ({ page }) => {
    await page.goto(`${liveBaseUrl}/v2`);

    await expect(page.locator("#mapiso-capture")).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "MapGap Control Plane" })).toHaveCount(0);
  });

  test("published service-points endpoint returns normalized NJ library open data", async ({
    request,
  }) => {
    const cacheBuster = Date.now();
    const response = await request.get(
      `${liveBaseUrl}/api/service-points?category=library&bbox=-74.80,40.18,-74.70,40.25&check=${cacheBuster}`,
    );

    expect(response.ok()).toBe(true);

    const data = await response.json();

    expect(data.category).toBe("library");
    expect(data.count).toBeGreaterThan(0);
    expect(data.sources).toContain("nj_libraries");
    expect(data.points[0].source).toBe("nj_libraries");
    expect(data.points[0].location.lat).toEqual(expect.any(Number));
    expect(data.points[0].location.lng).toEqual(expect.any(Number));
  });

  test("published service-points endpoint returns official NY library data", async ({ request }) => {
    const response = await request.get(
      `${liveBaseUrl}/api/service-points?category=library&bbox=-73.85,42.60,-73.70,42.72&check=${Date.now()}`,
    );

    expect(response.ok()).toBe(true);
    const data = await response.json();

    expect(data.count).toBeGreaterThan(0);
    expect(data.sources).toContain("ny_libraries");
    expect(data.sources).not.toContain("google_places");
    expect(data.warnings || []).not.toContain(
      "Official NY/NJ open data temporarily unavailable - showing Google Places backup.",
    );
  });

  test("published laundry results exclude known cleaning-service false positives", async ({
    request,
  }) => {
    const response = await request.get(
      `${liveBaseUrl}/api/service-points?category=laundry&bbox=-74.09,40.69,-74.02,40.75&check=${Date.now()}`,
    );

    expect(response.ok()).toBe(true);
    const data = await response.json();
    const names = data.points.map((point: { name: string }) => point.name).join(" ");

    test.skip(
      (data.warnings || []).includes("GOOGLE_PLACES_API_KEY is not configured."),
      "Draft deploy does not have the production-scoped Google Places secret.",
    );

    expect(data.count).toBeGreaterThan(0);
    expect(names).not.toMatch(/carpet|janitorial|maid|dry\s*clean/i);
  });

  test("published dog-park search verifies Blatnick and excludes River Road Town Park", async ({
    request,
  }) => {
    const response = await request.get(
      `${liveBaseUrl}/api/service-points?category=custom&q=dog%20parks&bbox=-73.91,42.72,-73.74,42.84&check=${Date.now()}`,
    );

    expect(response.ok()).toBe(true);
    const data = await response.json();
    const names = data.points.map((point: { name: string }) => point.name);

    expect(data.sources).toContain("official_local");
    expect(data.sources).toContain("openstreetmap");
    expect(names).toContain("Niskayuna Dog Park (Blatnick Park)");
    expect(names).toContain("Town of Colonie Dog Park");
    expect(names).not.toContain("River Road Town Park");
  });

  for (const path of ["/v2/relocate", "/v2/audit"]) {
    test(`published ${path} focused workflow is routable`, async ({ page }) => {
      await page.goto(`${liveBaseUrl}${path}`);
      await expect(page.locator("#mapiso-capture")).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to Explore Nearby" })).toBeVisible();
    });
  }

  for (const viewport of mobileEdgeViewports) {
    test(`published /v2 keeps mobile entrypoint inside viewport on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${liveBaseUrl}/v2`);

      await expect(page.locator("#mapiso-capture")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectExploreFabInsideViewport(page);

      await page.getByRole("button", { name: "Explore Nearby" }).click();

      const drawer = page.locator('section[aria-label="Nearby access drawer"]');
      await expect(drawer.getByRole("heading", { name: "Explore nearby" })).toBeVisible();
      await expectInsideViewport(page, drawer);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("published /v2 mobile flow recovers through reset, refresh, and screen tilt", async ({
    page,
  }) => {
    await mockServicePointSearch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${liveBaseUrl}/v2`);

    await page.getByRole("button", { name: "Explore Nearby" }).click();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("button", { name: /Laundry/ }).click();
    await expect(drawer.getByRole("heading", { name: "Laundry nearby" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(page.getByText("Live Viewport Laundry A")).toBeVisible();
    await page.getByRole("button", { name: /Live Viewport Laundry A/ }).click();
    await expect(drawer.getByRole("heading", { name: "Live Viewport Laundry A" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(drawer.getByRole("button", { name: "Search this area" })).toBeVisible();
    await expect(page).toHaveURL(/category=laundry/);

    await drawer.getByRole("button", { name: "Reset nearby search" }).click();
    await expectExploreFabInsideViewport(page);
    await expect(page).not.toHaveURL(/category=/);

    await page.getByRole("button", { name: "Explore Nearby" }).click();
    await drawer.getByRole("button", { name: /Coffee/ }).click();
    await expect(drawer.getByRole("heading", { name: "Coffee nearby" })).toBeVisible();

    await page.setViewportSize({ width: 844, height: 390 });
    await expectInsideViewport(page, drawer);
    await expectNoHorizontalOverflow(page);

    await page.reload();
    await expect(drawer.getByRole("heading", { name: "Coffee nearby" })).toBeVisible();
    await expect(drawer.getByText("Google Places").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("published /v2 restores a shared category URL and closes the drawer on browser back", async ({
    page,
  }) => {
    await mockServicePointSearch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `${liveBaseUrl}/v2?category=laundry&bbox=-73.90000,42.74000,-73.78000,42.82000`,
    );

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await expect(drawer.getByRole("heading", { name: "Laundry nearby" })).toBeVisible();
    await expect(drawer.getByText("Google Places").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goBack();
    await expect(drawer).toHaveCount(0);
    await expectInsideViewport(page, page.getByRole("button", { name: "Laundry nearby" }));
  });
});

test.describe("Live Valhalla integration", () => {
  test.skip(!secret, "Set MAPGAP_VALHALLA_SECRET to run live Valhalla tests.");

  test("published API reports Valhalla as ready", async ({ request }) => {
    const response = await request.get(`${liveBaseUrl}/api/health`);

    expect(response.ok()).toBe(true);

    const data = await response.json();

    expect(data.status).toBe("ready");
    expect(data.valhalla).toBe(true);
    expect(data.valhallaRequiresSecret).toBe(false);
  });

  test("published routing proxy returns real Valhalla GeoJSON", async ({ request }) => {
    const response = await request.post(`${liveBaseUrl}/api/routing/isochrones`, {
      data: {
        provider: "valhalla",
        valhallaSharedSecret: secret,
        point: {
          id: "live-smoke-niskayuna",
          name: "Niskayuna Center",
          lat: 42.7798,
          lng: -73.8457,
        },
        transportMode: "foot-walking",
        mobilityMode: "walk",
        ranges: [300, 600],
        buckets: [
          {
            bucketMinutes: 5,
            adjustedMinutes: 5,
            adjustedSeconds: 300,
            requestSeconds: 300,
            effortScore: 1,
            slopeBurden: 0,
          },
          {
            bucketMinutes: 10,
            adjustedMinutes: 10,
            adjustedSeconds: 600,
            requestSeconds: 600,
            effortScore: 1,
            slopeBurden: 0,
          },
        ],
      },
    });

    expect(response.ok()).toBe(true);

    const data = await response.json();

    expect(data.type).toBe("FeatureCollection");
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBeGreaterThan(0);
    expect(data.features[0].geometry.type).toMatch(/Polygon/);
  });

  test("published routing proxy handles Jersey City according to hosted coverage", async ({
    request,
  }) => {
    const response = await request.post(`${liveBaseUrl}/api/routing/isochrones`, {
      data: {
        provider: "valhalla",
        valhallaSharedSecret: secret,
        point: {
          id: "live-smoke-jersey-city",
          name: "Jersey City test",
          lat: 40.7306,
          lng: -74.0559,
        },
        transportMode: "foot-walking",
        mobilityMode: "walk",
        ranges: [300, 600],
        buckets: [
          {
            bucketMinutes: 5,
            adjustedMinutes: 5,
            adjustedSeconds: 300,
            requestSeconds: 300,
            effortScore: 1,
            slopeBurden: 0,
          },
          {
            bucketMinutes: 10,
            adjustedMinutes: 10,
            adjustedSeconds: 600,
            requestSeconds: 600,
            effortScore: 1,
            slopeBurden: 0,
          },
        ],
      },
    });

    const data = await response.json();

    if (response.ok()) {
      expect(response.ok()).toBe(true);
      expect(data.type).toBe("FeatureCollection");
      expect(Array.isArray(data.features)).toBe(true);
      expect(data.features.length).toBeGreaterThan(0);
      expect(data.features[0].geometry.type).toMatch(/Polygon/);
    } else if (!expectNyNjValhalla) {
      expect(response.status()).toBe(422);
      expect(data.code).toBe("VALHALLA_OUT_OF_COVERAGE");
      expect(data.message).toContain("does not cover this location");
    } else {
      expect(response.ok()).toBe(true);
    }
  });

  test("published app can generate Valhalla rings from the UI", async ({ page }) => {
    await page.goto(liveBaseUrl);

    await expect(page.getByText("API ready")).toBeVisible();
    await expect(page.getByText("Valhalla beta").first()).toBeVisible();

    const generateButton = page.getByRole("button", { name: "Generate access heatmap" }).first();
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    await expect(page.getByText(/[1-9]\d* rings/).first()).toBeVisible({ timeout: 60_000 });
  });

  test("published /v2 app entrypoint is routable and connected to the live backend", async ({
    page,
  }) => {
    await page.goto(`${liveBaseUrl}/v2`);

    await expect(page.locator("#mapiso-capture")).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();
    await expectV2RoutingSignal(page);
    await expect(page.getByRole("heading", { name: "MapGap Control Plane" })).toHaveCount(0);
  });

  test("published mobile /v2 laundry demo loads places and generates rings", async ({
    page,
  }) => {
    await mockServicePointSearch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${liveBaseUrl}/v2`);

    await expect(page.locator("#mapiso-capture")).toBeVisible();
    await expectV2RoutingSignal(page);
    await expectExploreFabInsideViewport(page);
    await page.getByRole("button", { name: "Explore Nearby" }).click();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: /Laundry/ }).click();

    await expect(page.getByText("2 places").first()).toBeAttached();
    await expect(page.getByText("Google Places").first()).toBeVisible();
    await drawer.getByRole("button", { name: "Walk" }).click();
    await expect(page.locator(".mapiso-raster-isochrones")).toBeAttached({ timeout: 90_000 });
    await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible();
  });

  test("local app proxy reports live Valhalla as ready", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.ok()).toBe(true);

    const data = await response.json();

    expect(data.status).toBe("ready");
    expect(data.valhalla).toBe(true);
    expect(data.valhallaRequiresSecret).toBe(false);
  });

  test("local /v2 entrypoint renders the current working example with live backend", async ({
    page,
  }) => {
    await page.goto("/v2");

    await expect(page.locator("#mapiso-capture")).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();
    await expectV2RoutingSignal(page);
    await expect(page.getByRole("heading", { name: "MapGap Control Plane" })).toHaveCount(0);
  });

  test("local mobile /v2 laundromat preset loads laundry places and generates rings", async ({
    page,
  }) => {
    await mockServicePointSearch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/v2");

    await expect(page.locator("#mapiso-capture")).toBeVisible();
    await expectV2RoutingSignal(page);
    await expectExploreFabInsideViewport(page);
    await page.getByRole("button", { name: "Explore Nearby" }).click();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: /Laundry/ }).click();

    await expect(page.getByText("2 places").first()).toBeAttached();
    await expect(page.getByText("Google Places").first()).toBeVisible();
    await drawer.getByRole("button", { name: "Walk" }).click();
    await expect(page.locator(".mapiso-raster-isochrones")).toBeAttached({ timeout: 90_000 });
    await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible();
  });

  for (const viewport of viewports) {
    test(`local app with live backend is usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "MapGap Control Plane" })).toBeVisible();
      await expect(page.locator("#mapiso-capture")).toBeVisible();

      const metrics = await page.evaluate(() => ({
        bodyWidth: document.body.scrollWidth,
        docWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));

      expect(Math.max(metrics.bodyWidth, metrics.docWidth)).toBeLessThanOrEqual(
        metrics.viewportWidth + 1,
      );

      const tableTitle = page.getByRole("heading", { name: "Location table" });
      await tableTitle.scrollIntoViewIfNeeded();
      await expect(tableTitle).toBeVisible();
    });
  }

  test("local app can generate Valhalla rings through the live API proxy", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("API ready")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    await expect(page.getByText("Capital Region relocation")).toBeVisible();

    const generateButton = page.getByRole("button", { name: "Generate access heatmap" }).first();
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    await expect(page.getByText(/[1-9]\d* rings/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible({ timeout: 60_000 });
  });

  test("local app scenario selection updates the completed Phase 1 profile", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Scenario profile").selectOption("dual-career");
    await expect(page.getByText("Dual-career household")).toBeVisible();
    await expect(page.getByText("Albany job anchor", { exact: true })).toBeVisible();
    await expect(page.getByText("Schenectady job anchor", { exact: true })).toBeVisible();
    await expect(page.getByText("professional services jobs within 30 min")).toBeVisible();
    await expect(page.getByRole("slider", { name: "Affordability score weight" })).toBeVisible();
  });
});
