import { expect, test } from "@playwright/test";
import { TOKEN_FREE_MAP_STYLE, isTokenFreeMapStyle } from "../src/map/token-free-style";

test("the V3 alpha uses a token-free MapLibre style and makes no Mapbox request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  expect(isTokenFreeMapStyle(TOKEN_FREE_MAP_STYLE)).toBe(true);
  await page.goto("/");
  await expect(page.getByTestId("kepler-mounted")).toContainText("Kepler workbench mounted");

  const tokenBearing = requests.filter((url) => /(mapbox|access[_-]?token|api[_-]?key)/i.test(url));
  expect(tokenBearing).toEqual([]);
});
