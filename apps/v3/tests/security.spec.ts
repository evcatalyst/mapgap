import {expect, test} from "@playwright/test";
import {readFileSync, readdirSync} from "node:fs";
import {
  TOKEN_FREE_MAP_ORIGIN,
  TOKEN_FREE_MAP_STYLE,
  TOKEN_FREE_MAP_STYLE_URL,
  isTokenFreeMapStyle,
} from "../src/map/token-free-style";

const V2_URL = "https://mapgap-access.netlify.app/v2";
const V2_ORIGIN = new URL(V2_URL).origin;

test("V3 permits only its exact V2 frame and token-free basemap origins", async ({page}) => {
  const hostRequests: string[] = [];
  const successfulMapResources: string[] = [];
  const tileRequests: string[] = [];
  page.on("request", (request) => {
    if (request.frame() === page.mainFrame()) hostRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.ok() && response.url().startsWith(TOKEN_FREE_MAP_ORIGIN)) {
      successfulMapResources.push(response.url());
      if (/\.pbf(?:\?|$)/.test(response.url())) tileRequests.push(response.url());
    }
  });

  expect(isTokenFreeMapStyle(TOKEN_FREE_MAP_STYLE)).toBe(true);
  expect(TOKEN_FREE_MAP_STYLE.url).toBe(TOKEN_FREE_MAP_STYLE_URL);
  const documentResponse = await page.goto("/");
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});
  await expect(page.locator(".maplibregl-map")).toHaveCount(1);

  expect(successfulMapResources).toContain(TOKEN_FREE_MAP_STYLE_URL);
  expect(successfulMapResources.some((url) => /\.pbf(?:\?|$)/.test(url))).toBe(true);
  expect(tileRequests.length, "one right-side renderer should stay inside its initial tile cap").toBeLessThanOrEqual(56);

  const pageOrigin = new URL(page.url()).origin;
  const remoteHostOrigins = new Set(hostRequests
    .filter((url) => /^https?:/i.test(url))
    .map((url) => new URL(url).origin)
    .filter((origin) => origin !== pageOrigin));
  expect([...remoteHostOrigins]).toEqual([TOKEN_FREE_MAP_ORIGIN]);
  expect(credentialBearing(hostRequests)).toEqual([]);

  expect(isTokenFreeMapStyle({url: "https://tiles.example/style?token=hidden"})).toBe(false);
  expect(isTokenFreeMapStyle({url: "https://user:password@tiles.example/style"})).toBe(false);
  expect(isTokenFreeMapStyle({api: {authorization: "hidden"}})).toBe(false);

  const configuredCsp = readConfiguredCsp();
  expect(remoteOriginsFromDirective(configuredCsp, "frame-src")).toEqual([V2_ORIGIN]);
  expect(remoteOriginsFromDirective(configuredCsp, "connect-src")).toEqual([TOKEN_FREE_MAP_ORIGIN]);
  expect(remoteOriginsFromDirective(configuredCsp, "img-src")).toEqual([TOKEN_FREE_MAP_ORIGIN]);
  expect(tokensFromDirective(configuredCsp, "object-src")).toEqual(["'none'"]);
  expect(tokensFromDirective(configuredCsp, "frame-ancestors")).toEqual(["'none'"]);

  const deployedCsp = documentResponse?.headers()["content-security-policy"];
  if (process.env.PLAYWRIGHT_BASE_URL) expect(deployedCsp).toBeTruthy();
  if (deployedCsp) {
    expect(remoteOriginsFromDirective(deployedCsp, "frame-src")).toEqual([V2_ORIGIN]);
    expect(remoteOriginsFromDirective(deployedCsp, "connect-src")).toEqual([TOKEN_FREE_MAP_ORIGIN]);
    expect(remoteOriginsFromDirective(deployedCsp, "img-src")).toEqual([TOKEN_FREE_MAP_ORIGIN]);
  }

  const attribution = page.getByTestId("map-attribution");
  await expect(attribution).toContainText("OpenFreeMap");
  await expect(attribution).toContainText("© OpenMapTiles");
  await expect(attribution).toContainText("© OpenStreetMap");
  await expect(attribution).toBeVisible();
});

test("the V2 embed is constrained, titled, and grants only clipboard write", async ({page}) => {
  await page.goto("/");
  const iframe = page.getByTitle("MapGap V2 access map");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", V2_URL);
  await expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");

  const sandbox = new Set(((await iframe.getAttribute("sandbox")) ?? "").split(/\s+/).filter(Boolean));
  expect(sandbox).toEqual(new Set(["allow-scripts", "allow-forms", "allow-same-origin", "allow-popups", "allow-downloads"]));
  expect(sandbox.has("allow-top-navigation")).toBe(false);
  expect(sandbox.has("allow-modals")).toBe(false);

  const allow = (await iframe.getAttribute("allow")) ?? "";
  expect(allow).toContain("clipboard-write");
  expect(allow).toContain("geolocation 'none'");
  expect(allow).toContain("camera 'none'");
  expect(allow).toContain("microphone 'none'");
  expect(allow).not.toContain("clipboard-read");
});

test("the V3 runtime contains MapLibre and deck.gl but no Kepler dependency or bundle", async ({page}) => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {dependencies?: Record<string, string>};
  const dependencies = Object.keys(packageJson.dependencies ?? {});
  expect(dependencies).toContain("maplibre-gl");
  expect(dependencies.some((name) => name.startsWith("@deck.gl/"))).toBe(true);
  expect(dependencies.filter((name) => /kepler/i.test(name))).toEqual([]);

  await page.goto("/");
  const runtimeRequests: string[] = [];
  page.on("request", (request) => runtimeRequests.push(request.url()));
  await page.reload();
  expect(runtimeRequests.filter((url) => /(?:@kepler\.gl|kepler\.gl|keplergl)/i.test(url))).toEqual([]);

  const assets = readdirSync(new URL("../dist/assets/", import.meta.url)).filter((name) => name.endsWith(".js"));
  expect(assets.length).toBeGreaterThan(0);
  const runtimeText = assets.map((name) => readFileSync(new URL(`../dist/assets/${name}`, import.meta.url), "utf8")).join("\n");
  expect(runtimeText).not.toMatch(/@kepler\.gl\//i);
  expect(runtimeText).not.toMatch(/["']kepler\.gl["']/i);
});

function readConfiguredCsp() {
  const config = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
  const match = config.match(/Content-Security-Policy\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("V3 netlify.toml must define Content-Security-Policy");
  return match[1];
}

function tokensFromDirective(csp: string, directiveName: string) {
  const directive = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${directiveName} `));
  return directive ? directive.split(/\s+/).slice(1) : [];
}

function remoteOriginsFromDirective(csp: string, directiveName: string) {
  return [...new Set(tokensFromDirective(csp, directiveName)
    .filter((token) => /^https:\/\//.test(token))
    .map((url) => new URL(url).origin))];
}

function credentialBearing(urls: string[]) {
  return urls.filter((url) => {
    if (!/^https?:/i.test(url)) return false;
    const parsed = new URL(url);
    const keys = [...parsed.searchParams.keys()];
    return Boolean(parsed.username || parsed.password) || keys.some((key) =>
      /^(access[_-]?token|api[_-]?key|token|key|secret|auth|authorization|signature|sig|x-amz-)/i.test(key),
    );
  });
}
