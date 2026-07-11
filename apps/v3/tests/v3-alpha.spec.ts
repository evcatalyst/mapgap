import { expect, test } from "@playwright/test";

test("analyst alpha mounts a Kepler canvas and explains routed candidate differences", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MapGap V3 Analyst Alpha" })).toBeVisible();
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");
  await expect(page.getByTestId("candidate-score-table")).toContainText("Nearby but fails routed commute");
  await expect(page.getByText("Required work commute:", { exact: true })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("switching to civic capacity retains a map workbench and a non-color evidence explanation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");

  await page.getByRole("button", { name: "Civic: capacity and underserved proxy" }).click();
  await expect(page.getByTestId("civic-capacity-table")).toContainText("Northside Computer Lab");
  await expect(page.getByTestId("underserved-evidence")).toContainText("deterministic alpha proxy");
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");
});
