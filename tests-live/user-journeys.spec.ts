import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const secret = process.env.MAPGAP_VALHALLA_SECRET;
const outputDir = resolve(process.cwd(), "docs/reports/user-journeys/screenshots");
const summaryPath = resolve(process.cwd(), "docs/reports/user-journeys/summary.json");

type JourneySummary = {
  id: string;
  title: string;
  viewport: string;
  clicks: number;
  screenshots: string[];
  notes: string[];
};

const summaries: JourneySummary[] = [];

function screenshotPath(name: string) {
  return resolve(outputDir, `${name}.png`);
}

async function capture(page: Page, name: string) {
  const path = screenshotPath(name);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function primeReadyApp(page: Page) {
  await page.goto("/");
  await expect(page.getByText("API ready").first()).toBeAttached();
  await expect(page.locator("#mapiso-capture")).toBeVisible();
}

test.describe.serial("MapGap user story journeys", () => {
  test.skip(!secret, "Set MAPGAP_VALHALLA_SECRET to run live user journeys.");

  test.beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  test.afterAll(() => {
    writeFileSync(summaryPath, JSON.stringify(summaries, null, 2));
  });

  test("Story 1 - first run to generated heatmap", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeReadyApp(page);

    const screenshots = [await capture(page, "01-first-run-desktop")];
    let clicks = 0;

    await expect(page.getByText("Valhalla access secret")).toHaveCount(0);
    await expect(page.getByLabel("Search place or address").first()).toBeVisible();
    screenshots.push(await capture(page, "02-public-routing-generate-visible"));

    await page.getByRole("button", { name: "Generate access heatmap" }).first().click();
    clicks += 1;
    await expect(page.getByText(/[1-9]\d* rings/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible({ timeout: 60_000 });
    screenshots.push(await capture(page, "03-generated-heatmap"));

    summaries.push({
      id: "story-1",
      title: "First run to generated heatmap",
      viewport: "1440x900",
      clicks,
      screenshots,
      notes: [
        "Public routing is server-managed; no Valhalla secret is shown in the default flow.",
        "Persistent top-bar generate action makes the next step visible.",
      ],
    });
  });

  test("Story 2 - quickly add and edit locations", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeReadyApp(page);

    const screenshots = [await capture(page, "04-add-point-action-visible")];
    let clicks = 0;

    await page.getByRole("button", { name: "Add point at map center" }).click();
    clicks += 1;
    await expect(page.getByText("2 points").first()).toBeVisible();
    screenshots.push(await capture(page, "05-point-added"));

    await page.getByRole("heading", { name: "Location table" }).scrollIntoViewIfNeeded();
    const newLocationInput = page.locator(
      'input[aria-label="Edit name for New location"]:visible',
    );
    await newLocationInput.fill("Second candidate");
    await expect(
      page.locator('input[aria-label="Edit name for Second candidate"]:visible'),
    ).toHaveValue("Second candidate");
    screenshots.push(await capture(page, "06-edit-point-table"));

    summaries.push({
      id: "story-2",
      title: "Quickly add and edit locations",
      viewport: "1440x900",
      clicks,
      screenshots,
      notes: [
        "Visible top-bar Add point avoids hunting inside the sidebar or command palette.",
        "Editing is still table-first; future versions should support adding named anchors directly from the profile layer.",
      ],
    });
  });

  test("Story 3 - relocation scenario profile review", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeReadyApp(page);

    const screenshots = [await capture(page, "07-relocation-profile")];

    await expect(page.getByText("Capital Region relocation")).toBeVisible();
    await expect(page.getByText("Prospective job anchor", { exact: true })).toBeVisible();
    await expect(page.getByText("professional role jobs within 30 min")).toBeVisible();
    await expect(page.getByRole("slider", { name: "Affordability score weight" })).toBeVisible();

    summaries.push({
      id: "story-3",
      title: "Relocation scenario profile review",
      viewport: "1440x900",
      clicks: 0,
      screenshots,
      notes: [
        "The profile layer is now visible before deeper controls.",
        "Score weights are inspectable, but the panel is dense and should later graduate into a guided wizard.",
      ],
    });
  });

  test("Story 4 - dual-career scenario", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeReadyApp(page);

    let clicks = 0;
    await page.getByLabel("Scenario profile").selectOption("dual-career");
    clicks += 1;
    await expect(page.getByText("Dual-career household")).toBeVisible();
    await expect(page.getByText("Albany job anchor", { exact: true })).toBeVisible();
    await expect(page.getByText("Schenectady job anchor", { exact: true })).toBeVisible();
    await expect(page.getByText("professional services jobs within 30 min")).toBeVisible();

    const screenshots = [await capture(page, "08-dual-career-profile")];

    summaries.push({
      id: "story-4",
      title: "Dual-career scenario",
      viewport: "1440x900",
      clicks,
      screenshots,
      notes: [
        "Scenario switch is fast and updates anchors/constraints.",
        "The current UI explains assumptions but does not yet generate candidate home zones.",
      ],
    });
  });

  test("Story 5 - mobile first run", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await primeReadyApp(page);

    const screenshots = [await capture(page, "09-mobile-first-run")];
    let clicks = 0;

    const metrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      docWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(Math.max(metrics.bodyWidth, metrics.docWidth)).toBeLessThanOrEqual(
      metrics.viewportWidth + 1,
    );

    await page.getByRole("button", { name: "Open sidebar" }).click();
    clicks += 1;
    await expect(page.getByRole("dialog", { name: "MapGap controls" })).toBeVisible();
    const drawer = page.getByRole("dialog", { name: "MapGap controls" });
    await expect(drawer.getByLabel("Search place or address")).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "POI layers" })).toBeVisible();
    screenshots.push(await capture(page, "10-mobile-public-controls"));

    await drawer.getByRole("button", { name: "Generate", exact: true }).click();
    clicks += 1;
    await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => undefined);
    screenshots.push(await capture(page, "11-mobile-generated"));

    await page.getByRole("heading", { name: "Location table" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Location table" })).toBeVisible();
    screenshots.push(await capture(page, "12-mobile-location-cards"));

    summaries.push({
      id: "story-5",
      title: "Mobile first run",
      viewport: "390x844",
      clicks,
      screenshots,
      notes: [
        "Mobile avoids horizontal overflow.",
        "Search, POIs, clear, and generate are reachable without a credential prompt.",
      ],
    });
  });

  test("Story 6 - export-ready evidence", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeReadyApp(page);

    const screenshots: string[] = [];
    let clicks = 0;

    await page.getByRole("button", { name: "Generate access heatmap" }).first().click();
    clicks += 1;
    await expect(page.getByText(/[1-9]\d* rings/).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Open commands and exports" }).click();
    clicks += 1;
    await expect(page.getByText("Export CSV")).toBeVisible();
    await expect(page.getByText("Export GeoJSON")).toBeVisible();
    await expect(page.getByText("Export PNG")).toBeVisible();
    screenshots.push(await capture(page, "13-export-ready"));

    summaries.push({
      id: "story-6",
      title: "Export-ready evidence",
      viewport: "1440x900",
      clicks,
      screenshots,
      notes: [
        "Export actions are grouped in the command palette to keep the top bar compact.",
        "The next product step should add a decision memo export, not only raw data exports.",
      ],
    });
  });

  test("Story 7 - iPad map and controls balance", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await primeReadyApp(page);

    const screenshots = [await capture(page, "14-ipad-first-run")];
    let clicks = 0;

    const metrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      docWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(Math.max(metrics.bodyWidth, metrics.docWidth)).toBeLessThanOrEqual(
      metrics.viewportWidth + 1,
    );

    await page.getByRole("button", { name: "Open sidebar" }).click();
    clicks += 1;
    const drawer = page.getByRole("dialog", { name: "MapGap controls" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel("Search place or address")).toBeVisible();
    screenshots.push(await capture(page, "15-ipad-public-controls"));

    await drawer.getByRole("button", { name: "Generate", exact: true }).click();
    clicks += 1;
    await expect(page.locator(".mapiso-raster-isochrones")).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => undefined);
    screenshots.push(await capture(page, "16-ipad-generated"));

    await page.getByRole("heading", { name: "Location table" }).scrollIntoViewIfNeeded();
    screenshots.push(await capture(page, "17-ipad-table-context"));

    summaries.push({
      id: "story-7",
      title: "iPad map and controls balance",
      viewport: "820x1180",
      clicks,
      screenshots,
      notes: [
        "The tablet breakpoint avoids horizontal overflow and keeps the primary map usable.",
        "Controls still use the drawer pattern; the next iteration should preserve more map context while editing profile details.",
      ],
    });
  });
});
