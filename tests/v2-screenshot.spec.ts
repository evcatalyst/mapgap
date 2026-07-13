import { expect, test, type Page } from "@playwright/test";

const neutralTile = `
  <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="#e7ece8" />
    <path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="#d9e1dc" stroke-width="1" />
  </svg>
`;

const viewports = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "iphone-standard", width: 390, height: 844 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "ipad-landscape", width: 1180, height: 820 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function mockScreenshotRoutes(page: Page) {
  await page.route(/tile\.openstreetmap\.org|basemaps\.cartocdn\.com/, async (route) => {
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: neutralTile });
  });

  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        message: "Valhalla routing is available.",
        openRouteService: false,
        valhalla: true,
        valhallaRequiresSecret: false,
        openCage: false,
      }),
    });
  });

  await page.route("**/api/service-points**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        category: "laundry",
        label: "Laundry",
        count: 3,
        sources: ["google_places"],
        warnings: [],
        points: [
          {
            id: "laundry-1",
            name: "Journal Square Laundromat",
            category: "laundry",
            source: "google_places",
            address: "10 Newark Avenue, Jersey City, NJ",
            confidence: "medium",
            location: { lat: 42.7798, lng: -73.8457 },
          },
          {
            id: "laundry-2",
            name: "Neighborhood Wash Center",
            category: "laundry",
            source: "google_places",
            address: "22 Union Street, Niskayuna, NY",
            confidence: "medium",
            location: { lat: 42.7698, lng: -73.8357 },
          },
          {
            id: "laundry-3",
            name: "Central Avenue Laundry",
            category: "laundry",
            source: "google_places",
            address: "44 Central Avenue, Schenectady, NY",
            confidence: "medium",
            location: { lat: 42.7898, lng: -73.8557 },
          },
        ],
      }),
    });
  });
}

for (const viewport of viewports) {
  test(`v2 ${viewport.name} visual baseline`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockScreenshotRoutes(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/v2");
    await expect(page.getByRole("button", { name: "Explore Nearby" })).toBeVisible();
    await expect(page).toHaveScreenshot(`${viewport.name}-initial.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });

    await page.getByRole("button", { name: "Explore Nearby" }).click();
    const drawer = page.locator('section[aria-label="Nearby access drawer"]');
    await drawer.getByRole("button", { name: /Laundry/ }).click();
    await expect(drawer.getByRole("heading", { name: "Laundry nearby" })).toBeVisible();
    await expect(drawer.getByText("3 places").first()).toBeVisible();
    await expect(page).toHaveScreenshot(`${viewport.name}-results.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });

    await expect(drawer.getByRole("button", { name: "Add as layer" })).toBeVisible();
    await page.getByRole("button", { name: "Open map layers" }).click();
    await expect(drawer).toBeHidden();
    const layerDrawer = page.getByRole("complementary", { name: "Map layers" });
    await expect(layerDrawer.getByRole("button", { name: "Add as layer" })).toBeVisible();
    await expect(page).toHaveScreenshot(`${viewport.name}-layer-entry.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });
    await layerDrawer.getByRole("button", { name: "Add as layer" }).click();
    await expect(page).toHaveScreenshot(`${viewport.name}-layers.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });
  });
}
