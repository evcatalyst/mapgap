import {expect, test} from "@playwright/test";

test("wide V3 is a synchronized access + housing map comparison, not a report beside a blank canvas", async ({page}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#civic");
  await expect(page.getByRole("heading", {name: "MapGap Analyst"})).toBeVisible();
  await expect(page.getByTestId("kepler-mounted")).toContainText("comparison workbench mounted");
  await expect(page.getByTestId("basemap-ready")).toContainText("2 map canvas basemap ready", {timeout: 30_000});
  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "dual");
  await expect(page.getByTestId("access-pane-header")).toContainText("Access heat");
  await expect(page.getByTestId("intelligence-pane-header")).toContainText("Location intelligence");
  await expect(page.getByTestId("intelligence-pane-header")).toContainText("ACS housing");
  await expect(page.locator(".maplibregl-map")).toHaveCount(2);
  await expectDualCanvasesShareViewport(page);
  await expect(page.getByTestId("camera-sync")).toHaveAttribute("data-camera-count", "2");
  await panLeftMapAndExpectCameraSync(page);
  await expectPaintedMap(page);

  const drawer = page.getByTestId("evidence-drawer");
  await expect(drawer).toContainText("Northside Computer Lab");
  await drawer.getByRole("button", {name: "Compare evidence"}).click();
  await drawer.getByRole("button", {name: /Census Tract 1,/}).click();
  await expect(drawer).toContainText("Census Tract 1, Albany, NY");
  await expect(drawer).toContainText("$1243");
  await expect(drawer).toContainText("56.14%");
  await expect(page.locator(".source-chip.housing")).toContainText("Housing 2024");
  await capture(page, "civic-wide");
  expect(pageErrors).toEqual([]);
});

test("relocation reuses the dual workbench without borrowing Albany housing", async ({page}) => {
  await page.goto("/#civic");
  await expect(page.getByTestId("basemap-ready")).toContainText("2 map canvas basemap ready", {timeout: 30_000});
  await page.getByRole("button", {name: "Relocation"}).click();

  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "dual");
  await expect(page.getByTestId("intelligence-pane-header")).toContainText("Candidates · nearby places");
  await expect(page.locator(".source-chip.housing")).toHaveCount(0);
  await expect(page.getByTestId("evidence-drawer")).toContainText("Nearby but fails routed commute");
  await expect(page.locator(".maplibregl-map")).toHaveCount(2);
});

test("iPad portrait and phone use one persistent canvas with Access/Intelligence switching", async ({page}) => {
  await page.setViewportSize({width: 820, height: 1080});
  await page.goto("/#civic");

  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "single-access");
  await expect(page.getByTestId("basemap-ready")).toContainText("1 map canvas basemap ready", {timeout: 30_000});
  await expect(page.locator(".maplibregl-map")).toHaveCount(1);
  const canvasCount = await page.locator(".map-workbench canvas").count();

  await page.getByRole("button", {name: "Intelligence"}).click();
  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "single-intelligence");
  await expect(page.locator(".maplibregl-map")).toHaveCount(1);
  expect(await page.locator(".map-workbench canvas").count()).toBe(canvasCount);
  await expect(page.getByTestId("evidence-drawer")).toContainText("Known capacity");
  await page.getByRole("button", {name: "Compare evidence"}).click();
  await page.getByRole("button", {name: /Census Tract 2\.01,/}).click();
  await expect(page.getByTestId("evidence-drawer")).toContainText("Census Tract 2.01, Albany, NY");

  await page.setViewportSize({width: 1180, height: 820});
  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "dual");
  await expect(page.locator(".maplibregl-map")).toHaveCount(2);
  await expect(page.getByTestId("basemap-ready")).toContainText("2 map canvas basemap ready", {timeout: 30_000});
  await expect(page.getByTestId("evidence-drawer")).toContainText("Census Tract 2.01, Albany, NY");
  await capture(page, "civic-ipad-portrait");
});

test("a housing source failure is localized to intelligence and leaves access interactive", async ({page}) => {
  await page.goto("/?failSource=housing#civic");
  await expect(page.getByTestId("housing-source-error")).toContainText("Access evidence is still live");
  await expect(page.getByTestId("basemap-ready")).toContainText("2 map canvas basemap ready", {timeout: 30_000});
  await expect(page.getByRole("button", {name: "Zoom in"})).toBeVisible();
  await expect(page.locator(".source-chip.housing")).toHaveCount(0);
  await expect(page.locator(".maplibregl-map")).toHaveCount(2);
});

async function expectDualCanvasesShareViewport(page: import("@playwright/test").Page) {
  const mapBox = await page.getByTestId("map-workbench").boundingBox();
  const boxes = await page.locator(".maplibregl-map").evaluateAll((maps) => maps.map((map) => {
    const rect = map.getBoundingClientRect();
    return {x: rect.x, width: rect.width, height: rect.height};
  }));
  expect(mapBox).not.toBeNull();
  expect(boxes).toHaveLength(2);
  if (!mapBox) return;
  expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThanOrEqual(2);
  expect(Math.abs(boxes[0].width * 2 - mapBox.width)).toBeLessThanOrEqual(3);
  expect(Math.abs(boxes[0].height - mapBox.height)).toBeLessThanOrEqual(3);
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width - 3);
}

async function expectPaintedMap(page: import("@playwright/test").Page) {
  const box = await page.getByTestId("map-workbench").boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const png = await page.screenshot({
    clip: {
      x: Math.floor(box.x + box.width * .18),
      y: Math.floor(box.y + box.height * .28),
      width: Math.floor(box.width * .64),
      height: Math.floor(box.height * .28),
    },
  });
  const colorBuckets = await page.evaluate(async (encoded) => {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], {type: "image/png"}));
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 80;
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
  expect(colorBuckets).toBeGreaterThan(24);
}

async function panLeftMapAndExpectCameraSync(page: import("@playwright/test").Page) {
  const left = await page.locator(".maplibregl-map").first().boundingBox();
  expect(left).not.toBeNull();
  if (!left) return;
  await page.mouse.move(left.x + left.width * .62, left.y + left.height * .46);
  await page.mouse.down();
  await page.mouse.move(left.x + left.width * .72, left.y + left.height * .51, {steps: 5});
  await page.mouse.up();
  await expect.poll(async () => Number(await page.getByTestId("camera-sync").getAttribute("data-camera-delta")), {
    timeout: 5_000,
    message: "linked Kepler viewports should converge without a propagation loop",
  }).toBeLessThan(0.0001);
}

async function capture(page: import("@playwright/test").Page, name: string) {
  const directory = process.env.V3_SCREENSHOT_DIR;
  if (directory) await page.screenshot({path: `${directory}/mapgap-v3-${name}.png`, fullPage: true});
}
