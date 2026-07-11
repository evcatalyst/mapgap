import { expect, test, type Locator } from "@playwright/test";
import sharp from "sharp";

test("analyst alpha mounts a Kepler canvas and explains routed candidate differences", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MapGap V3 Analyst Preview" })).toBeVisible();
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");
  await expect(page.locator(".project-status")).toContainText("4 visible evidence layers");
  await expect(page.getByTestId("map-legend")).toContainText("30-minute routed access");
  await expect(page.getByTestId("candidate-score-table")).toContainText("Nearby but fails routed commute");
  await expect(page.getByText("Required work commute:", { exact: true })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expectCanvasHasVisualLayers(page.locator("canvas").first());
  await captureScenario(page, "relocation");
  expect(pageErrors).toEqual([]);
});

test("switching to civic capacity retains a map workbench and a non-color evidence explanation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");

  await page.getByRole("button", { name: "Civic: capacity and underserved proxy" }).click();
  await expect(page.getByTestId("civic-capacity-table")).toContainText("Northside Computer Lab");
  await expect(page.getByTestId("underserved-evidence")).toContainText("deterministic alpha proxy");
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");
  await expect(page.locator(".project-status")).toContainText("4 visible evidence layers");
  await expect(page.getByTestId("map-legend")).toContainText("Underserved-capacity proxy");
  await expectCanvasHasVisualLayers(page.locator("canvas").first());
  await captureScenario(page, "civic");
});

async function expectCanvasHasVisualLayers(canvas: Locator) {
  const png = await canvas.screenshot();
  const {data, info} = await sharp(png).resize(160, 100, {fit: "fill"}).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const buckets = new Set<string>();
  for (let offset = 0; offset < data.length; offset += info.channels * 8) {
    buckets.add(`${data[offset] >> 4}:${data[offset + 1] >> 4}:${data[offset + 2] >> 4}`);
  }
  expect(buckets.size, "map canvas should contain multiple visibly distinct geometry colors").toBeGreaterThan(12);
}

async function captureScenario(page: import("@playwright/test").Page, scenario: string) {
  const directory = process.env.V3_SCREENSHOT_DIR;
  if (!directory) return;
  await page.screenshot({path: `${directory}/mapgap-v3-${scenario}-mobile.png`, fullPage: true});
}
