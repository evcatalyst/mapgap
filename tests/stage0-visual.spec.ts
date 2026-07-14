import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/az8Y2QAAAAASUVORK5CYII=",
  "base64",
);

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "ipad-landscape", width: 1024, height: 768 },
  { name: "desktop-browser", width: 1440, height: 900 },
] as const;

const mobileEdgeViewports = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "narrow-android", width: 360, height: 740 },
  { name: "iphone-standard", width: 390, height: 844 },
  { name: "iphone-pro-max", width: 430, height: 932 },
] as const;

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

async function mockAppRoutes(
  page: Page,
  options?: {
    onHousingRequest?: (url: URL) => void;
    onIsochroneRequest?: (body: Record<string, unknown>) => void;
  },
) {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        message: "Valhalla beta ready for regression testing.",
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
    const url = new URL(route.request().url());
    const category = url.searchParams.get("category") || "laundry";
    const query = url.searchParams.get("q") || "";
    const labels: Record<string, string> = {
      grocery: "Grocery",
      bookstore: "Bookstore",
      laundry: "Laundry",
      "fresh-produce": "Fresh Produce",
      "farmers-market": "Farmers Market",
      butcher: "Butcher",
    };
    const label = labels[category] || "Place";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        source: "osm",
        category,
        label: query || `${label} in view`,
        points: [
          {
            id: `osm-node-${category}-1`,
            source: "osm",
            sourceId: `osm-node-${category}-1`,
            category,
            name: `Viewport ${label} A`,
            address: "Current map view",
            lat: 42.7798,
            lng: -73.8457,
          },
          {
            id: `osm-node-${category}-2`,
            source: "osm",
            sourceId: `osm-node-${category}-2`,
            category,
            name: `Viewport ${label} B`,
            address: "Current map view",
            lat: 42.7898,
            lng: -73.8657,
          },
        ],
      }),
    });
  });

  await page.route("**/api/service-points**", async (route) => {
    const url = new URL(route.request().url());
    const category = url.searchParams.get("category") || "laundry";
    const customQuery = url.searchParams.get("q") || "Custom places";
    const labels: Record<string, string> = {
      laundry: "Laundromat",
      coffee: "Coffee",
      grocery: "Grocery",
      library: "Library",
      custom: customQuery,
    };
    const responseLabels: Record<string, string> = {
      laundry: "Laundry",
      coffee: "Coffee",
      grocery: "Groceries",
      library: "Libraries",
      custom: customQuery,
    };
    const resultLabel = labels[category] || "Place";
    const responseLabel = responseLabels[category] || resultLabel;
    const source = category === "library" ? "nj_libraries" : "google_places";
    const sourceLabel = category === "library" ? "NJ Open Data" : "Google Places";
    const activeExtensions = (url.searchParams.get("include") || "").split(",").filter(Boolean);
    const dogSearch = category === "custom" && customQuery.toLowerCase().includes("dog");
    const extensions =
      category === "grocery"
        ? [
            {
              id: "specialty_food",
              label: "Local & specialty food",
              description: "Focused food retailers.",
            },
            {
              id: "convenience_food",
              label: "Convenience stores",
              description: "Smaller last-mile food options.",
            },
          ]
        : category === "coffee"
          ? [
              {
                id: "bakery_cafes",
                label: "Bakery & breakfast cafes",
                description: "Related breakfast venues that serve coffee.",
              },
              {
                id: "coffee_available",
                label: "Coffee available",
                description: "Fast-food and convenience fallbacks.",
              },
            ]
          : dogSearch
          ? [
              {
                id: "leashed_parks",
                label: "Leash-required parks",
                description: "Regular parks where dogs are allowed on leash.",
              },
            ]
          : [];
    const basePoints = [
      {
        id: `${source}-${category}-1`,
        name: `Viewport ${resultLabel} A`,
        category,
        categoryLabel: category === "custom" ? resultLabel : undefined,
        location: { lat: 40.722, lng: -74.045 },
        source,
        address: "Current map view",
        confidence: "high",
        provenance: { label: sourceLabel },
        match:
          category === "grocery"
            ? {
                tier: "primary",
                subclassification: "Full grocery",
                reason: "Provider types identify this as a grocery store.",
              }
            : undefined,
      },
      {
        id: `${source}-${category}-2`,
        name: `Viewport ${resultLabel} B`,
        category,
        categoryLabel: category === "custom" ? resultLabel : undefined,
        location: { lat: 40.714, lng: -74.052 },
        source,
        address: "Current map view",
        confidence: "high",
        provenance: { label: sourceLabel },
        match: dogSearch
          ? {
              tier: "related",
              extensionId: "leashed_parks",
              subclassification: "Leash-required park",
              reason: "Included because this park is mapped as allowing dogs on leash.",
              conditions: ["Leash required", "Not a dedicated dog park"],
            }
          : category === "grocery"
            ? {
                tier: "related",
                extensionId: "specialty_food",
                subclassification: "Specialty food store",
                reason: "Included as a focused food retailer.",
              }
            : category === "coffee"
              ? {
                  tier: "related",
                  extensionId: "bakery_cafes",
                  subclassification: "Bakery or breakfast cafe",
                  reason: "Included as a breakfast venue that serves coffee.",
                }
            : undefined,
      },
    ];
    const points = basePoints.filter(
      (point) => !point.match?.extensionId || activeExtensions.includes(point.match.extensionId),
    );

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        category,
        label: responseLabel,
        query: category === "custom" ? customQuery : undefined,
        bbox: [-74.08, 40.68, -74.02, 40.74],
        count: points.length,
        sources: [source],
        points,
        extensions,
        activeExtensions,
        warnings: category === "library" ? ["Libraries loaded from NJ public source."] : [],
      }),
    });
  });

  await page.route("**/api/housing/listings**", async (route) => {
    const url = new URL(route.request().url());
    options?.onHousingRequest?.(url);
    const tenure = url.searchParams.get("tenure") === "sale" ? "sale" : "rent";
    const maxPrice = Number(url.searchParams.get("maxPrice")) || (tenure === "rent" ? 2400 : 400000);
    const prices = tenure === "rent" ? [1650, 1925, 2250] : [285000, 325000, 365000];
    const listings = prices
      .filter((price) => price <= maxPrice)
      .map((price, index) => ({
        id: `illustrative-${tenure}-${index + 1}`,
        title: `Illustrative ${index + 1}-bedroom ${tenure === "rent" ? "rental" : "home"}`,
        address: "Example location in the current map view",
        location: { lat: 42.64 + index * 0.035, lng: -73.83 + index * 0.05 },
        tenure,
        price,
        bedrooms: index + 1,
        bathrooms: index + 1,
        squareFeet: 650 + index * 300,
        propertyType: index === 0 ? "Apartment" : "Townhouse",
        status: "Illustrative only",
        source: "illustrative",
        sourceLabel: "Illustrative example",
        confidence: "low",
        provenance: {
          access: "illustrative",
          label: "MapGap example data",
          note: "Not a real or available property.",
        },
      }));

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        count: listings.length,
        listings,
        mode: "illustrative",
        sources: ["illustrative"],
        warnings: ["No live housing feed is enabled. These are illustrative records, not available homes."],
        liveProviderConfigured: false,
        query: {
          bbox: [-74, 42.6, -73.6, 42.9],
          tenure,
          maxPrice,
          minBedrooms: 1,
        },
      }),
    });
  });

  await page.route("**/api/place/search**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        source: "google",
        query: "Jersey City NJ",
        results: [
          {
            id: "google-jersey-city",
            source: "google",
            sourceId: "google-jersey-city",
            name: "Jersey City",
            address: "Jersey City, NJ, USA",
            lat: 40.7178,
            lng: -74.0431,
            viewport: {
              south: 40.66,
              west: -74.12,
              north: 40.78,
              east: -73.99,
            },
            types: ["locality"],
          },
        ],
      }),
    });
  });

  await page.route("**/api/routing/isochrones", async (route) => {
    options?.onIsochroneRequest?.(
      (route.request().postDataJSON() || {}) as Record<string, unknown>,
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { value: 300 },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-73.855, 42.775],
                  [-73.835, 42.775],
                  [-73.835, 42.79],
                  [-73.855, 42.79],
                  [-73.855, 42.775],
                ],
              ],
            },
          },
        ],
      }),
    });
  });
}

test.describe("Stage 0 visual entrypoint regressions", () => {
  test("public /v2 entrypoint renders the map-first demo shell", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/v2");

    await expect(page.locator("#mapiso-capture")).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "MapGap Control Plane" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Location table" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Profile", exact: true })).toHaveCount(0);
  });

  for (const viewport of viewports) {
    test(`${viewport.name} keeps the map and table reachable without horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockAppRoutes(page);

      await page.goto("/");
      await expect(page.getByRole("heading", { name: "MapGap Control Plane" })).toBeVisible();

      const metrics = await page.evaluate(() => ({
        bodyWidth: document.body.scrollWidth,
        docWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));

      expect(Math.max(metrics.bodyWidth, metrics.docWidth)).toBeLessThanOrEqual(
        metrics.viewportWidth + 1,
      );

      const map = page.locator("#mapiso-capture");
      await expect(map).toBeVisible();
      const mapBox = await map.boundingBox();
      expect(mapBox?.width ?? 0).toBeGreaterThan(viewport.width * 0.72);
      expect(mapBox?.height ?? 0).toBeGreaterThan(viewport.name === "mobile" ? 340 : 400);

      const tableTitle = page.getByRole("heading", { name: "Location table" });
      await tableTitle.scrollIntoViewIfNeeded();
      await expect(tableTitle).toBeVisible();
    });
  }

  test("public v2 keeps mobile controls in the bottom drawer without exposing a Valhalla secret", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2");
    await expect(page.getByLabel("Search place or address")).toHaveCount(0);
    await expect(page.getByText("Valhalla access secret")).toHaveCount(0);

    await page.getByRole("button", { name: "Explore Nearby" }).click();

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await expect(drawer.getByRole("heading", { name: "Explore nearby" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Laundry/ })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Coffee/ })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Groceries/ })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Libraries/ })).toBeVisible();
    await expect(drawer.getByText("Valhalla access secret")).toHaveCount(0);
  });

  test("public v2 keeps the mobile explore button inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2");

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
    expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(
      metrics.viewportWidth + 1,
    );
  });

  test("desktop top controls preserve the map as the primary surface", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/v2");

    const topBarBox = await page.getByText("Nearby is not always easy to reach").boundingBox();
    const mapBox = await page.locator("#mapiso-capture").boundingBox();

    expect(topBarBox?.height ?? 999).toBeLessThanOrEqual(32);
    expect(mapBox?.height ?? 0).toBeGreaterThan(800);
    await expect(page.locator("#mapiso-capture").getByText("MapGap access heat")).toHaveCount(0);
  });

  test("mobile bottom drawer avoids horizontal clipping", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2");
    await page.getByRole("button", { name: "Explore Nearby" }).click();

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await expect(drawer.getByRole("heading", { name: "Explore nearby" })).toBeVisible();

    const metrics = await drawer.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("mobile v2 exposes laundry results and heatmap after one category tap", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2");
    await page.getByRole("button", { name: "Explore Nearby" }).click();

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("button", { name: /Laundry/ }).click();

    await expect(drawer.getByRole("heading", { name: "Laundry nearby" })).toBeVisible();
    await expect(drawer.getByText("2 places").first()).toBeVisible();
    await expect(drawer.getByText("Google Places").first()).toBeVisible();
    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(page.getByText("Viewport Laundromat A")).toBeVisible();

    await drawer.getByRole("button", { name: "Walk" }).click();
    await expect(drawer.getByRole("group", { name: "Walking time" })).toBeVisible();
    await expect(page.locator(".mapiso-raster-isochrones")).toHaveCount(1);
    await drawer.getByRole("button", { name: "Reset nearby search" }).click();
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();
    await expect(page.getByText("Viewport Laundromat A")).toHaveCount(0);
    await expect(page.locator(".mapiso-raster-isochrones")).toHaveCount(0);
  });

  test("v2 expands walking reach without repeating the place search", async ({ page }) => {
    const routingRequests: Array<Record<string, unknown>> = [];
    let servicePointSearches = 0;

    await page.setViewportSize({ width: 1024, height: 768 });
    await mockAppRoutes(page, {
      onIsochroneRequest: (body) => routingRequests.push(body),
    });
    await page.route("**/api/service-points**", async (route) => {
      servicePointSearches += 1;
      await route.fallback();
    });

    await page.goto("/v2");
    await page.getByRole("button", { name: "Explore Nearby" }).click();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("button", { name: /Laundry/ }).click();
    await drawer.getByRole("button", { name: "Walk" }).click();
    await expect(drawer.getByRole("button", { name: "10 minute walk reach" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await drawer.getByRole("button", { name: "20 minute walk reach" }).click();
    await expect(drawer.getByRole("button", { name: "20 minute walk reach" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    expect(servicePointSearches).toBe(1);
    expect(routingRequests.length).toBeGreaterThanOrEqual(4);
    expect(routingRequests.at(-1)?.ranges).toEqual([300, 600, 900, 1200]);
  });

  test("v2 service markers shrink as the map zooms out", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/v2?category=laundry&bbox=-74.08,40.68,-74.02,40.74");
    const marker = page.locator(".mapgap-service-marker").first();
    await expect(marker).toBeVisible();
    const closeSize = await marker.boundingBox();

    const zoomOut = page.getByRole("button", { name: "Zoom out" });
    await zoomOut.click();
    await zoomOut.click();
    await zoomOut.click();
    await zoomOut.click();
    const regionalSize = await marker.boundingBox();

    expect(regionalSize?.width ?? 999).toBeLessThan(closeSize?.width ?? 0);
    expect(regionalSize?.width ?? 0).toBeLessThanOrEqual(18);
  });

  for (const viewport of mobileEdgeViewports) {
    test(`public v2 ${viewport.name} keeps the primary mobile controls inside the viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockAppRoutes(page);

      await page.goto("/v2");

      await expectNoHorizontalOverflow(page);
      await expectInsideViewport(page, page.getByRole("button", { name: "Explore Nearby" }));
      await expectInsideViewport(page, page.getByText("MapGap").first());

      await page.getByRole("button", { name: "Explore Nearby" }).click();

      const drawer = page.locator('section[aria-label="Nearby access drawer"]');
      await expect(drawer.getByRole("heading", { name: "Explore nearby" })).toBeVisible();
      await expectInsideViewport(page, drawer);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("public v2 mobile survives results, detail, reset, and refresh recovery", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2");
    await page.getByRole("button", { name: "Explore Nearby" }).click();

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("button", { name: /Laundry/ }).click();
    await expect(drawer.getByRole("heading", { name: "Laundry nearby" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(page.getByText("Viewport Laundromat A")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /^Viewport Laundromat A/ }).click();
    await expect(drawer.getByRole("heading", { name: "Viewport Laundromat A" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(drawer.getByRole("button", { name: "Search this area" })).toBeVisible();
    await expect(page).toHaveURL(/category=laundry/);
    await expect(page).toHaveURL(/bbox=/);

    await drawer.getByRole("button", { name: "Reset nearby search" }).click();
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();
    await expect(page.getByText("Viewport Laundromat A")).toHaveCount(0);
    await expect(page).not.toHaveURL(/category=/);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Explore Nearby" }).click();
    await drawer.getByRole("button", { name: /Coffee/ }).click();
    await expect(drawer.getByRole("heading", { name: "Coffee nearby" })).toBeVisible();
    await page.reload();

    await expect(drawer.getByRole("heading", { name: "Coffee nearby" })).toBeVisible();
    await expect(drawer.getByText("Google Places").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("public v2 restores shared search URLs and lets browser back close the drawer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2?category=library&bbox=-74.08000,40.68000,-74.02000,40.74000");

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await expect(drawer.getByRole("heading", { name: "Libraries nearby" })).toBeVisible();
    await expect(drawer.getByText("NJ Open Data").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goBack();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Libraries nearby" })).toBeVisible();
    await expect(page).toHaveURL(/\/v2/);
  });

  test("public v2 handles mobile screen tilt without clipping the drawer or entrypoint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2");
    await page.getByRole("button", { name: "Explore Nearby" }).click();

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await expect(drawer.getByRole("heading", { name: "Explore nearby" })).toBeVisible();

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(drawer.getByRole("heading", { name: "Explore nearby" })).toBeVisible();
    await expectInsideViewport(page, drawer);
    await expectNoHorizontalOverflow(page);

    await drawer.getByRole("button", { name: "Close nearby drawer" }).click();
    await expectInsideViewport(page, page.getByRole("button", { name: "Explore Nearby" }));
    await expectNoHorizontalOverflow(page);
  });

  test("public v2 remains usable through browser back and forward navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "MapGap Control Plane" })).toBeVisible();

    await page.goto("/v2");
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("heading", { name: "MapGap Control Plane" })).toBeVisible();

    await page.goForward();
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();
    await page.getByRole("button", { name: "Explore Nearby" }).click();
    await expect(page.locator('section[aria-label="Nearby access drawer"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("mobile v2 supports a compact custom category search", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2");
    await page.getByRole("button", { name: "Explore Nearby" }).click();

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("textbox", { name: "Custom category" }).fill("pharmacies");
    await drawer.getByRole("button", { name: "Search custom places" }).click();

    await expect(drawer.getByRole("heading", { name: "pharmacies nearby" })).toBeVisible();
    await expect(drawer.getByText("2 places").first()).toBeVisible();
    await expect(drawer.getByText("Google Places").first()).toBeVisible();
    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(page.getByText("Viewport pharmacies A")).toBeVisible();
  });

  test("v2 explains conditional dog-friendly parks and persists personal boosts", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);
    await page.goto("/v2");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await page.getByRole("button", { name: "Explore Nearby" }).click();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByLabel("Custom category").fill("dog parks");
    await drawer.getByRole("button", { name: "Search custom places" }).click();
    await expect(drawer.getByText("1 place").first()).toBeVisible();
    await drawer.getByRole("button", { name: "Leash-required parks" }).click();
    await drawer.getByRole("button", { name: "Nearby entries" }).click();

    await expect(drawer.getByText(/Primary matches remain first/)).toBeVisible();
    await expect(drawer.getByText("Leash-required park", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Boost Viewport dog parks B" }).click();
    await expect(drawer.getByText("Boosted for you")).toBeVisible();

    await page.reload();
    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(drawer.getByText("Boosted for you")).toBeVisible();
    await expect(drawer.locator(".divide-y > div").first()).toContainText("Viewport dog parks B");
  });

  test("v2 keeps full groceries primary and lets users add specialty food stores", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await mockAppRoutes(page);
    await page.goto("/v2");

    await page.getByRole("button", { name: "Explore Nearby" }).click();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("button", { name: /Groceries/ }).click();
    await expect(drawer.getByText("1 place").first()).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Local & specialty food" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await drawer.getByRole("button", { name: "Local & specialty food" }).click();
    await expect(drawer.getByText("2 places").first()).toBeVisible();
    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(drawer.getByText("Specialty food store", { exact: true })).toBeVisible();
  });

  test("v2 keeps coffee shops primary and exposes related coffee venues on demand", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);
    await page.goto("/v2");

    await page.getByRole("button", { name: "Explore Nearby" }).click();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("button", { name: /Coffee/ }).click();
    await expect(drawer.getByText("1 place").first()).toBeVisible();
    await drawer.getByRole("button", { name: "Bakery & breakfast cafes" }).click();
    await expect(drawer.getByText("2 places").first()).toBeVisible();
    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(drawer.getByText("Bakery or breakfast cafe", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("v2 saves refined results and access heat as a tunable map layer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);
    await page.goto("/v2?category=laundry&bbox=-74.08,40.68,-74.02,40.74");

    const nearbyDrawer = page.locator('section[aria-label="Nearby access drawer"]');
    await expect(nearbyDrawer.getByRole("heading", { name: "Laundry nearby" })).toBeVisible();
    await expect(nearbyDrawer.getByRole("button", { name: "Add as layer" })).toBeVisible();
    await nearbyDrawer.getByRole("button", { name: "Walk" }).click();
    await expect(page.locator(".mapiso-raster-isochrones")).toHaveCount(1);

    await page.getByRole("button", { name: "Open map layers" }).click();
    await expect(nearbyDrawer).toBeHidden();

    const layerDrawer = page.getByRole("complementary", { name: "Map layers" });
    await expect(layerDrawer).toBeVisible();
    await expect(layerDrawer.getByText("Current results")).toBeVisible();
    await layerDrawer.getByRole("button", { name: "Review and refine results" }).click();
    await expect(layerDrawer).toBeHidden();
    await expect(nearbyDrawer.getByRole("button", { name: "Add as layer" })).toBeVisible();

    await page.getByRole("button", { name: "Open map layers" }).click();
    await expect(nearbyDrawer).toBeHidden();
    await layerDrawer.getByRole("button", { name: "Add as layer" }).click();
    await expect(layerDrawer.getByText("Laundry", { exact: true })).toBeVisible();
    await expect(layerDrawer.getByText("2 places")).toBeVisible();
    await expect(layerDrawer.getByRole("button", { name: "10 min walk" })).toBeVisible();
    await expect(page.locator(".mapgap-service-marker")).toHaveCount(2);
    await expect(page.locator(".mapiso-raster-isochrones")).toHaveCount(1);

    const compactMarkerWidth = await page
      .locator(".mapgap-service-marker")
      .first()
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(compactMarkerWidth).toBeLessThanOrEqual(10);

    await layerDrawer.getByRole("button", { name: "Hide Laundry" }).click();
    await expect(page.locator(".mapgap-service-marker")).toHaveCount(0);
    await expect(page.locator(".mapiso-raster-isochrones")).toHaveCount(0);

    await layerDrawer.getByRole("button", { name: "Show Laundry" }).click();
    await layerDrawer
      .getByRole("button", { name: "Delete Viewport Laundromat B from Laundry" })
      .click();
    await expect(layerDrawer.getByText("1 place")).toBeVisible();
    await expect(page.locator(".mapgap-service-marker")).toHaveCount(1);

    await layerDrawer.getByRole("button", { name: "Close layers panel" }).click();
    await expect(page.getByRole("button", { name: "Open map layers, 1 saved" })).toBeVisible();

    await page.getByRole("button", { name: "Laundry nearby" }).click();
    await nearbyDrawer.getByRole("button", { name: "Categories" }).click();
    await nearbyDrawer.getByRole("button", { name: /Coffee/ }).click();
    await expect(nearbyDrawer.getByRole("button", { name: "Add as layer" })).toBeVisible();
    await nearbyDrawer.getByRole("button", { name: "Add as layer" }).click();
    await expect(layerDrawer.getByText("2 layers")).toBeVisible();

    const coffeeLayer = layerDrawer.getByRole("region", { name: "Map layer Coffee" });
    await coffeeLayer.getByRole("button", { name: "Move Coffee up" }).click();
    await expect(layerDrawer.getByRole("region").first()).toHaveAttribute(
      "aria-label",
      "Map layer Coffee",
    );
    await expectNoHorizontalOverflow(page);
  });

  test("v2 empty layer drawer leads directly into nearby exploration", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockAppRoutes(page);
    await page.goto("/v2");

    await page.getByRole("button", { name: "Open map layers" }).click();
    const layerDrawer = page.getByRole("complementary", { name: "Map layers" });
    await expect(layerDrawer.getByRole("button", { name: "Explore nearby" })).toBeVisible();
    await layerDrawer.getByRole("button", { name: "Explore nearby" }).click();

    await expect(layerDrawer).toBeHidden();
    await expect(
      page.locator('section[aria-label="Nearby access drawer"]').getByRole("heading", {
        name: "Explore nearby",
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("ipad v2 keeps the category drawer staged over a live map", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await mockAppRoutes(page);

    await page.goto("/v2");
    await page.getByRole("button", { name: "Explore Nearby" }).click();

    const mapBox = await page.locator("#mapiso-capture").boundingBox();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    const drawerBox = await drawer.boundingBox();

    expect(mapBox?.height ?? 0).toBeGreaterThan(1000);
    expect(drawerBox?.height ?? 999).toBeLessThan(650);
    await expect(drawer.getByRole("button", { name: /Libraries/ })).toBeVisible();
  });

  test("public v2 libraries use normalized open-data source badges", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/v2");
    await page.getByRole("button", { name: "Explore Nearby" }).click();

    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("button", { name: /Libraries/ }).click();

    await expect(drawer.getByRole("heading", { name: "Libraries nearby" })).toBeVisible();
    await expect(drawer.getByText("NJ Open Data").first()).toBeVisible();
    await expect(drawer.getByText("Libraries loaded from NJ public source.")).toBeVisible();
    await drawer.getByRole("button", { name: "Nearby entries" }).click();
    await expect(page.getByText("Viewport Library A")).toBeVisible();
  });

  test("empty maps recover a visible scenario entrypoint after points are removed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");
    await page.getByLabel("Scenario profile").selectOption("asset-audit");
    await expect(page.getByText("Existing asset audit")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose your operating profile" })).toHaveCount(
      0,
    );

    const tableTitle = page.getByRole("heading", { name: "Location table" });
    await tableTitle.scrollIntoViewIfNeeded();

    const removeButtons = page.getByRole("button", { name: /^Remove / });

    while ((await removeButtons.count()) > 0) {
      await removeButtons.first().click();
    }

    await expect(page.getByText("Empty map").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Laundromats/ }).first()).toBeVisible();
  });

  test("laundromat preset loads laundry places from the current map view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");
    await page
      .getByRole("button", { name: "Run laundromat walkability in current map view" })
      .click();

    await expect(page.getByText("2 places").first()).toBeVisible();
    const poiPanel = page.locator('section[aria-label="POI layers"]:visible').first();
    const laundryLayer = poiPanel.getByText("Laundry in view");
    await laundryLayer.scrollIntoViewIfNeeded();
    await expect(laundryLayer).toBeVisible();
    await expect(page.getByText("Laundromat walkability test")).toBeVisible();
  });

  test("place search jumps to a selected result without using the command palette", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");
    await page.getByLabel("Search place or address").fill("Jersey City NJ");
    await page.getByRole("button", { name: "Search" }).first().click();
    await page.getByRole("button", { name: /Jersey City/ }).click();

    await expect(page.getByLabel("Search place or address")).toHaveValue("Jersey City");
    await expect(page.getByText("Search commands")).toHaveCount(0);
  });

  test("CSV import accepts civic asset columns with latitude and longitude out of order", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");

    const csv = [
      "facility_type,capacity,hours_open,utilization,staffing,annual_cost,funding_source,asset_name,street,city,state,longitude,latitude",
      "Computer lab,24,M-F 9-5,12 visits/week,2 FTE,$96000,CDBG,Lincoln Park Training Lab,200 Morton Ave,Albany,NY,-73.7607,42.6434",
      "Library,48,Mon-Sat,35%,6 FTE,$48000,City Capital,Arbor Hill Library,148 Henry Johnson Blvd,Albany,NY,-73.7521,42.6684",
      "Invalid,,,,,,Missing Coordinates,Unknown,Albany,NY,,",
    ].join("\n");

    await page.locator('input[type="file"]').setInputFiles({
      name: "civic-assets.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await expect(
      page.getByLabel("Edit name for Lincoln Park Training Lab").first(),
    ).toHaveValue("Lincoln Park Training Lab");
    await expect(page.getByLabel("Edit name for Arbor Hill Library").first()).toHaveValue(
      "Arbor Hill Library",
    );
    const table = page.locator("table");
    await expect(table.getByText("Computer lab")).toBeVisible();
    await expect(table.getByText("24").first()).toBeVisible();
    await expect(table.getByText("M-F 9-5")).toBeVisible();
    await expect(table.getByText("12 visits/week")).toBeVisible();
    await expect(table.getByText("CDBG")).toBeVisible();
    await expect(page.getByText("3 points").first()).toBeVisible();

    await page.getByLabel("Scenario profile").selectOption("asset-audit");
    await expect(page.getByRole("heading", { name: "Existing assets" })).toBeVisible();
    await expect(page.getByText("72").first()).toBeVisible();
    await expect(page.getByText("$144,000").first()).toBeVisible();
    await expect(page.getByText("2 funding sources captured")).toBeVisible();
    await page.getByRole("button", { name: "Generate asset service areas" }).click();
    await expect(page.getByText("Generated Just now").first()).toBeVisible();

    await page.getByRole("button", { name: "Generate candidate zones" }).click();
    await expect(page.getByText("Routed asset contours").first()).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export memo" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const markdown = readFileSync(downloadPath || "", "utf8");

    expect(markdown).toContain("## Imported Asset Inventory");
    expect(markdown).toContain("Lincoln Park Training Lab (Computer lab, capacity 24");
    expect(markdown).toContain("Imported asset capacity: 72");
    expect(markdown).toContain("Imported annual operating cost: $144,000");
    expect(markdown).toContain("utilization 12 visits/week");
    expect(markdown).toContain("funding CDBG");
    expect(markdown).toContain("Evidence assumptions");
    expect(markdown).toContain("Routed asset contours");
    expect(markdown).toContain("Candidate scoring includes generated routed profile-anchor or imported-asset contours");
  });

  test("share snapshot link restores scenario, locations, and civic asset metadata", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");

    const csv = [
      "facility_type,capacity,hours_open,utilization,annual_cost,funding_source,asset_name,street,city,state,longitude,latitude",
      "Computer lab,24,M-F 9-5,12 visits/week,$96000,CDBG,Lincoln Park Training Lab,200 Morton Ave,Albany,NY,-73.7607,42.6434",
      "Library,48,Mon-Sat,35%,$48000,City Capital,Arbor Hill Library,148 Henry Johnson Blvd,Albany,NY,-73.7521,42.6684",
    ].join("\n");

    await page.locator('input[type="file"]').setInputFiles({
      name: "civic-assets.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByLabel("Scenario profile").selectOption("asset-audit");
    await page.getByRole("button", { name: "Share snapshot" }).click();

    const sharedUrl = page.url();
    expect(sharedUrl).toContain("#mg=");

    const restored = await context.newPage();
    await restored.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(restored);
    await restored.goto(sharedUrl);

    await expect(restored.getByText("Existing asset audit")).toBeVisible();
    await expect(
      restored.getByLabel("Edit name for Lincoln Park Training Lab").first(),
    ).toHaveValue("Lincoln Park Training Lab");
    await expect(restored.locator("table").getByText("Computer lab")).toBeVisible();
    await expect(restored.locator("table").getByText("M-F 9-5")).toBeVisible();
    await expect(restored.locator("table").getByText("CDBG")).toBeVisible();

    const assetPanel = restored.locator('section[aria-label="Existing asset audit"]').first();
    await expect(assetPanel.getByText("72")).toBeVisible();
    await expect(assetPanel.getByText("$144,000")).toBeVisible();
    await expect(assetPanel.getByText("2 funding sources captured")).toBeVisible();
  });

  test("Ask MapGap turns a plain-language request into a place search, POI layer, and heatmap", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");
    await page
      .getByLabel("Ask MapGap prompt")
      .fill(
        "Show laundromats in Jersey City within 10 minutes and generate a heatmap for moving near work",
      );
    await page.getByRole("button", { name: "Run Ask MapGap" }).click();

    const poiPanel = page.locator('section[aria-label="POI layers"]:visible').first();
    const laundryLayer = poiPanel.getByText("Laundry in view");
    await laundryLayer.scrollIntoViewIfNeeded();
    await expect(laundryLayer).toBeVisible();
    await expect(page.getByText("Find laundry places in Jersey City and generate access heat.")).toBeVisible();
    await expect(page.getByText("Grounded plan")).toBeVisible();
    await expect(page.getByText("Intent parser")).toBeVisible();
    await expect(page.getByText("Query planner")).toBeVisible();
    await expect(page.getByText("Routing evidence")).toBeVisible();
    await expect(page.getByText("Profile enrichment")).toBeVisible();
    await expect(page.getByText("Provider data, uploaded assets, and routed contours")).toBeVisible();
    await expect(page.getByText("Generated Just now").first()).toBeVisible();
  });

  test("candidate zones score the current viewport from profile anchors and visible POIs", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Generate profile anchor service areas" }).click();
    await expect(page.getByText("Generated Just now").first()).toBeVisible();
    await page.getByRole("button", { name: "Grocery" }).first().click();
    await page.getByRole("button", { name: "Generate candidate zones" }).click();

    await expect(page.getByRole("heading", { name: "Candidate zones" })).toBeVisible();
    await expect(page.getByText("Top candidate")).toBeVisible();
    await expect(page.getByText(/\/100/).first()).toBeVisible();
    await expect(page.getByText("Required constraints").first()).toBeVisible();
    await expect(page.getByText("Assumptions").first()).toBeVisible();
    await expect(page.getByText("Distance proxy").first()).toBeVisible();
    await expect(page.getByText("Routed profile contours").first()).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export memo" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();

    expect(download.suggestedFilename()).toMatch(/^mapgap-decision-memo-.*\.md$/);
    expect(downloadPath).toBeTruthy();

    const markdown = readFileSync(downloadPath || "", "utf8");
    expect(markdown).toContain("# MapGap Decision Memo");
    expect(markdown).toContain("## Candidate Shortlist");
    expect(markdown).toContain("top candidate");
    expect(markdown).toContain("Evidence assumptions");
    expect(markdown).toContain("Distance proxy");
    expect(markdown).toContain("Routed profile contours");
    expect(markdown).toContain("Candidate scoring includes generated routed profile-anchor or imported-asset contours");
    expect(markdown).toContain("Sources And Caveats");
  });

  test("POI layers add iteratively and remove independently", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");
    const poiPanel = page.locator('section[aria-label="POI layers"]:visible').first();
    await poiPanel.getByRole("button", { name: "Grocery" }).click();
    await poiPanel.getByRole("button", { name: "Bookstores" }).click();
    await poiPanel.getByRole("button", { name: "Laundry" }).click();

    const groceryLayer = poiPanel.getByText("Grocery in view");
    const bookstoreLayer = poiPanel.getByText("Bookstore in view");
    const laundryLayer = poiPanel.getByText("Laundry in view");
    await groceryLayer.scrollIntoViewIfNeeded();
    await expect(groceryLayer).toBeVisible();
    await bookstoreLayer.scrollIntoViewIfNeeded();
    await expect(bookstoreLayer).toBeVisible();
    await laundryLayer.scrollIntoViewIfNeeded();
    await expect(laundryLayer).toBeVisible();

    await poiPanel.getByRole("button", { name: "Remove Grocery in view" }).click();

    await expect(poiPanel.getByText("Grocery in view")).toHaveCount(0);
    await bookstoreLayer.scrollIntoViewIfNeeded();
    await expect(bookstoreLayer).toBeVisible();
    await laundryLayer.scrollIntoViewIfNeeded();
    await expect(laundryLayer).toBeVisible();

    await poiPanel
      .getByPlaceholder("Optional refinement: top rated butcher, premium produce, late dinner")
      .fill("premium produce farmers markets top rated butchers");
    await poiPanel.getByRole("button", { name: "Add POIs" }).click();

    const customLayer = poiPanel.getByText("premium produce farmers markets top rated butchers");
    await customLayer.scrollIntoViewIfNeeded();
    await expect(customLayer).toBeVisible();
  });

  test("desktop map surface does not contain an overlapping generate action", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");
    await expect(page.locator("#mapiso-capture")).toBeVisible();
    await expect(page.locator("#mapiso-capture button")).toHaveCount(0);
  });

  test("phase 1 profile panel follows scenario selection and exposes editable weights", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAppRoutes(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    await expect(page.getByText("Capital Region relocation")).toBeVisible();
    await expect(page.getByText("Prospective job anchor", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate profile anchor service areas" })).toBeVisible();
    await expect(page.getByText("professional role jobs within 30 min")).toBeVisible();
    await expect(page.getByRole("slider", { name: "Affordability score weight" })).toBeVisible();

    await page.getByLabel("Scenario profile").selectOption("asset-audit");
    await expect(page.getByText("Existing asset audit")).toBeVisible();
    await expect(page.getByLabel("Profile", { exact: true }).getByText("Albany, NY")).toBeVisible();
    await expect(page.getByText("Existing asset reach max 15 min")).toBeVisible();

    const civicCapacity = page.getByRole("slider", {
      name: "Civic capacity score weight",
    });
    await expect(civicCapacity).toHaveValue("44");
    await civicCapacity.fill("36");
    await expect(civicCapacity).toHaveValue("36");
  });

  test("focused relocation route captures anchors, evidence, and candidate scores", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);

    await page.goto("/v2/relocate");
    await expect(page.getByRole("heading", { name: "Relocation brief" })).toBeVisible();
    await expect(page.getByLabel("Household scenario")).toHaveValue("relocation-household");
    await page.getByLabel("Household scenario").selectOption("dual-career");
    await expect(page.getByText("Albany job anchor")).toBeVisible();

    const relocationInputs = page.getByLabel("Relocation inputs");
    await relocationInputs.getByRole("button", { name: "Set here" }).first().click();
    await page.getByLabel("commute minutes").first().fill("25");

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Homes in this view" })).toBeVisible();
    await page.getByRole("button", { name: "Find homes in this view" }).click();
    await expect(page.getByText("3 map candidates")).toBeVisible();
    await expect(page.locator(".mapgap-housing-marker")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Add Illustrative 1-bedroom rental to shortlist" })
      .click();

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Coffee" }).click();
    await expect(page.getByText("1 layers")).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Score shortlist" }).click();
    await expect(page.getByText("Ranked shortlist")).toBeVisible();
    await expect(page.getByText("Best current fit")).toBeVisible();
    await expect(page.getByText(/\/100/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export brief" })).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });

  test("relocation housing accepts authorized Zillow and Craigslist CSV records", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAppRoutes(page);
    await page.goto("/v2/relocate");
    await page.getByRole("button", { name: "Homes" }).click();
    await page.getByText("Import authorized listing CSV").click();

    const csv = [
      "title,latitude,longitude,price,bedrooms,bathrooms,source,source_url",
      "Zillow candidate,42.65,-73.75,2150,2,1,Zillow,https://www.zillow.com/example",
      "Craigslist candidate,42.67,-73.78,1800,1,1,Craigslist,https://albany.craigslist.org/example",
    ].join("\n");
    await page.locator('input[type="file"][accept*="csv"]').setInputFiles({
      name: "authorized-housing.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText("Imported Zillow").first()).toBeVisible();
    await expect(page.getByText("Imported Craigslist").first()).toBeVisible();
    await expect(page.getByText("user-provided").first()).toBeVisible();
    await expect(page.locator(".mapgap-housing-marker")).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
  });

  test("relocation housing spends provider requests only on explicit search", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let housingRequests = 0;
    await mockAppRoutes(page, {
      onHousingRequest: () => {
        housingRequests += 1;
      },
    });
    await page.goto("/v2/relocate");
    await page.getByRole("button", { name: "Homes" }).click();

    await page.getByLabel("Housing tenure").selectOption("sale");
    await page.getByLabel("Maximum housing price").fill("400000");
    await page.getByLabel("Minimum bedrooms").selectOption("2");
    expect(housingRequests).toBe(0);

    await page.getByRole("button", { name: "Find homes in this view" }).click();
    await expect(page.getByText("3 map candidates")).toBeVisible();
    expect(housingRequests).toBe(1);

    await page.mouse.move(80, 210);
    await page.mouse.down();
    await page.mouse.move(150, 190, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByText("Map or filters changed.")).toBeVisible();
    expect(housingRequests).toBe(1);

    await page.getByLabel("Maximum housing price").fill("325000");
    await expect(page.getByRole("button", { name: "Refresh homes in this view" })).toBeVisible();
    expect(housingRequests).toBe(1);

    await page.getByRole("button", { name: "Refresh homes in this view" }).click();
    await expect(page.getByText("2 map candidates")).toBeVisible();
    expect(housingRequests).toBe(2);
  });

  test("focused civic route imports assets and exposes routed audit actions", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await mockAppRoutes(page);

    await page.goto("/v2/audit");
    await expect(page.getByRole("heading", { name: "Civic capacity pilot" })).toBeVisible();

    const csv = [
      "facility_type,capacity,hours_open,utilization,staffing,annual_cost,funding_source,asset_name,longitude,latitude",
      "Computer lab,24,M-F 9-5,12 visits/week,2 FTE,96000,CDBG,Lincoln Park Training Lab,-73.7607,42.6434",
      "Library,48,Mon-Sat,35%,6 FTE,48000,City Capital,Arbor Hill Library,-73.7521,42.6684",
    ].join("\n");

    await page.locator('input[type="file"]').setInputFiles({
      name: "civic-assets.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    const assetPanel = page.getByLabel("Existing asset audit");
    await expect(assetPanel.getByText("72")).toBeVisible();
    await expect(assetPanel.getByText("$144,000")).toBeVisible();
    await expect(assetPanel.getByRole("button", { name: "Generate asset service areas" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Generate candidate zones" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("manual water-barrier compensation is disabled by default", async () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/map/RasterIsochroneLayer.tsx"),
      "utf8",
    );

    expect(source).toContain("const ENABLE_WATER_BARRIER_ERASER = false;");
    expect(source).toContain("if (ENABLE_WATER_BARRIER_ERASER)");
  });
});
