import { expect, test } from "@playwright/test";
import {
  TOKEN_FREE_MAP_ORIGIN,
  TOKEN_FREE_MAP_STYLE,
  TOKEN_FREE_MAP_STYLE_URL,
  isTokenFreeMapStyle,
} from "../src/map/token-free-style";

test("V3 loads a real token-free basemap from one approved origin with complete attribution", async ({ page }) => {
  const requests: string[] = [];
  const successfulMapResources: string[] = [];
  const tileRequests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (response.ok() && response.url().startsWith(TOKEN_FREE_MAP_ORIGIN)) {
      successfulMapResources.push(response.url());
      if (/\.pbf(?:\?|$)/.test(response.url())) tileRequests.push(response.url());
    }
  });

  expect(isTokenFreeMapStyle(TOKEN_FREE_MAP_STYLE)).toBe(true);
  expect(TOKEN_FREE_MAP_STYLE.url).toBe(TOKEN_FREE_MAP_STYLE_URL);
  const documentResponse = await page.goto("/");
  await expect(page.getByTestId("kepler-mounted")).toContainText("comparison workbench mounted");
  await expect(page.getByTestId("basemap-ready")).toContainText("2 map canvas basemap ready", { timeout: 30_000 });

  expect(successfulMapResources).toContain(TOKEN_FREE_MAP_STYLE_URL);
  expect(successfulMapResources.some((url) => /\.pbf(?:\?|$)/.test(url))).toBe(true);
  expect(tileRequests.length, "synchronized dual maps should stay inside the qualified initial tile cap").toBeLessThanOrEqual(96);

  const pageOrigin = new URL(page.url()).origin;
  const remoteOrigins = new Set(
    requests
      .filter((url) => /^https?:/i.test(url))
      .map((url) => new URL(url).origin)
      .filter((origin) => origin !== pageOrigin),
  );
  expect([...remoteOrigins]).toEqual([TOKEN_FREE_MAP_ORIGIN]);

  const credentialBearing = requests.filter((url) => {
    if (!/^https?:/i.test(url)) return false;
    const parsed = new URL(url);
    const keys = [...parsed.searchParams.keys()];
    return Boolean(parsed.username || parsed.password) || keys.some((key) =>
      /^(access[_-]?token|api[_-]?key|token|key|secret|auth|authorization|signature|sig|x-amz-)/i.test(key),
    );
  });
  expect(credentialBearing).toEqual([]);

  expect(isTokenFreeMapStyle({url: "https://tiles.example/style?token=hidden"})).toBe(false);
  expect(isTokenFreeMapStyle({url: "https://user:password@tiles.example/style"})).toBe(false);
  expect(isTokenFreeMapStyle({api: {authorization: "hidden"}})).toBe(false);

  const deployedCsp = documentResponse?.headers()["content-security-policy"];
  if (process.env.PLAYWRIGHT_BASE_URL) expect(deployedCsp).toBeTruthy();
  if (deployedCsp) {
    expect(remoteOriginsFromDirective(deployedCsp, "connect-src")).toEqual([TOKEN_FREE_MAP_ORIGIN]);
    expect(remoteOriginsFromDirective(deployedCsp, "img-src")).toEqual([TOKEN_FREE_MAP_ORIGIN]);
  }

  const attribution = page.getByTestId("map-attribution");
  await expect(attribution).toContainText("OpenFreeMap");
  await expect(attribution).toContainText("© OpenMapTiles");
  await expect(attribution).toContainText("Data from OpenStreetMap");
  await expect(attribution).toBeVisible();
});

test("a basemap outage offers retry and V2 recovery instead of a permanent blank map", async ({ page }) => {
  await page.route(`${TOKEN_FREE_MAP_ORIGIN}/**`, (route) => route.abort("connectionfailed"));
  await page.goto("/");

  const recovery = page.getByTestId("basemap-error");
  await expect(recovery).toBeVisible({ timeout: 20_000 });
  await expect(recovery).toContainText("project and analysis evidence remain unchanged");
  await expect(recovery.getByRole("button", {name: "Retry"})).toBeVisible();
  await expect(page.getByRole("link", {name: "Open V2"})).toHaveAttribute("href", /\/v2$/);
});

function remoteOriginsFromDirective(csp: string, directiveName: string) {
  const directive = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${directiveName} `));
  if (!directive) return [];
  return [...new Set((directive.match(/https:\/\/[^\s;]+/g) ?? []).map((url) => new URL(url).origin))];
}
