import { expect, test } from "@playwright/test";

test("analyst alpha opens on a real map and explains routed candidate differences", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MapGap V3 Analyst" })).toBeVisible();
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");
  await expect(page.getByTestId("basemap-ready")).toContainText("Basemap tiles ready", { timeout: 30_000 });
  await expectViewportNear(page, {longitude: -74.075, latitude: 40.726});
  await expect(page.getByTestId("kepler-mounted")).toContainText("4 evidence layers mapped");
  await expect(page.getByTestId("map-legend")).toContainText("30-minute routed access");
  await expect(page.getByTestId("candidate-score-table")).toContainText("Nearby but fails routed commute");
  await expect(page.getByText("Required work commute:", { exact: true })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByRole("button", {name: "Zoom in"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Zoom out"})).toBeVisible();
  await expectMapOwnsViewport(page);
  await expectMapCanvasFitsContainer(page);
  await expectMinimumContrast(page, [".panel-kicker", ".metric-grid dt", ".section-heading div p", ".candidate-rank small"]);
  await settlePaint(page);
  await expectCanvasHasVisualLayers(page);
  await captureScenario(page, "relocation");
  expect(pageErrors).toEqual([]);
});

test("switching to civic capacity retains a map workbench and a non-color evidence explanation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");
  await expect(page.getByTestId("basemap-ready")).toContainText("Basemap tiles ready", { timeout: 30_000 });

  await page.getByRole("button", { name: "Civic: capacity and underserved proxy" }).click();
  await expect(page.getByTestId("civic-capacity-table")).toContainText("Northside Computer Lab");
  await expect(page.getByTestId("underserved-evidence")).toContainText("deterministic alpha proxy");
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");
  await expect(page.getByTestId("basemap-ready")).toContainText("Basemap tiles ready", { timeout: 30_000 });
  await expectViewportNear(page, {longitude: -73.78, latitude: 42.665});
  await expect(page.getByTestId("kepler-mounted")).toContainText("4 evidence layers mapped");
  await expect(page.getByTestId("map-legend")).toContainText("Underserved-capacity proxy");
  await expect(page.getByTestId("map-legend")).toContainText("size = capacity");
  await expect(page.getByRole("heading", { name: "MapGap V3 Analyst" })).toBeVisible();
  expect(await page.locator(".v3-header").evaluate((header) => {
    const rect = header.getBoundingClientRect();
    const topmost = document.elementFromPoint(rect.left + 24, rect.top + rect.height / 2);
    return Boolean(topmost && header.contains(topmost));
  }), "the map compositor must not cover the product header").toBe(true);
  await expectMinimumContrast(page, [".asset-card > div > p", ".asset-card dt"]);
  await settlePaint(page);
  await expectCanvasHasVisualLayers(page);
  await captureScenario(page, "civic");
});

test("compact desktop still gives the map at least two thirds of the viewport", async ({page}) => {
  await page.setViewportSize({width: 1024, height: 768});
  await page.goto("/");
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");
  await expectMapOwnsViewport(page);
});

async function expectCanvasHasVisualLayers(page: import("@playwright/test").Page) {
  const box = await page.getByTestId("map-workbench").boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const png = await page.screenshot({
    clip: {
      x: Math.floor(box.x + box.width * 0.15),
      y: Math.floor(box.y + box.height * 0.32),
      width: Math.floor(box.width * 0.7),
      height: Math.floor(box.height * 0.35),
    },
  });
  const bucketCount = await page.evaluate(async (encoded) => {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const blob = new Blob([bytes], {type: "image/png"});
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 100;
    const context = canvas.getContext("2d", {willReadFrequently: true})!;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const buckets = new Set<string>();
    for (let offset = 0; offset < data.length; offset += 32) {
      buckets.add(`${data[offset] >> 4}:${data[offset + 1] >> 4}:${data[offset + 2] >> 4}`);
    }
    bitmap.close();
    return buckets.size;
  }, png.toString("base64"));
  expect(bucketCount, "an overlay-free map region should contain painted cartography and evidence colors").toBeGreaterThan(20);
}

async function expectMapOwnsViewport(page: import("@playwright/test").Page) {
  const viewport = page.viewportSize();
  const box = await page.getByTestId("map-workbench").boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  if (!viewport || !box) return;
  expect(box.y, "map must start in the first viewport").toBeLessThanOrEqual(80);
  expect(box.width / viewport.width, "map should own most of the available width").toBeGreaterThanOrEqual(0.65);
  if (viewport.width <= 980) {
    expect(box.height / viewport.height, "mobile map should own at least 60% of the first viewport").toBeGreaterThanOrEqual(0.6);
  }
}

async function expectMapCanvasFitsContainer(page: import("@playwright/test").Page) {
  const mapBox = await page.getByTestId("map-workbench").boundingBox();
  const canvasBoxes = await page.locator(".map-workbench canvas").evaluateAll((canvases) =>
    canvases.map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {width: rect.width, height: rect.height};
    }),
  );
  expect(mapBox).not.toBeNull();
  expect(canvasBoxes.length).toBeGreaterThan(0);
  if (!mapBox) return;
  for (const canvas of canvasBoxes) {
    expect(Math.abs(canvas.width - mapBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(canvas.height - mapBox.height)).toBeLessThanOrEqual(2);
  }
}

async function settlePaint(page: import("@playwright/test").Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function expectMinimumContrast(page: import("@playwright/test").Page, selectors: string[]) {
  for (const selector of selectors) {
    const ratios = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
      const parseRgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (rgb: number[]) => {
        const channels = rgb.map((value) => {
          const normalized = value / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const foreground = parseRgb(getComputedStyle(element).color);
      let backgroundElement: Element | null = element;
      let background = [255, 255, 255];
      while (backgroundElement) {
        const computed = getComputedStyle(backgroundElement).backgroundColor;
        if (computed !== "rgba(0, 0, 0, 0)" && computed !== "transparent") {
          background = parseRgb(computed);
          break;
        }
        backgroundElement = backgroundElement.parentElement;
      }
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    }));
    expect(ratios.length, `${selector} should match visible text`).toBeGreaterThan(0);
    for (const ratio of ratios) expect(ratio, `${selector} text should meet 4.5:1 contrast`).toBeGreaterThanOrEqual(4.5);
  }
}

async function expectViewportNear(
  page: import("@playwright/test").Page,
  expected: {longitude: number; latitude: number},
) {
  const viewport = page.getByTestId("map-viewport");
  await expect(viewport).toContainText("Map viewport fitted");
  const values = await viewport.evaluate((element) => ({
    longitude: Number(element.getAttribute("data-longitude")),
    latitude: Number(element.getAttribute("data-latitude")),
    zoom: Number(element.getAttribute("data-zoom")),
  }));
  expect(Math.abs(values.longitude - expected.longitude)).toBeLessThan(0.08);
  expect(Math.abs(values.latitude - expected.latitude)).toBeLessThan(0.08);
  expect(values.zoom).toBeGreaterThan(11);
}

async function captureScenario(page: import("@playwright/test").Page, scenario: string) {
  const directory = process.env.V3_SCREENSHOT_DIR;
  if (!directory) return;
  const viewport = page.viewportSize();
  const mode = viewport && viewport.width <= 980 ? "mobile" : "desktop";
  await page.screenshot({path: `${directory}/mapgap-v3-${scenario}-${mode}.png`, fullPage: mode === "mobile"});
}
