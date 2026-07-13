import {expect, test, type Page} from "@playwright/test";

const V2_URL = "https://mapgap-access.netlify.app/v2";
const V2_ORIGIN = new URL(V2_URL).origin;
const MAP_ORIGIN = "https://tiles.openfreemap.org";
const DEPLOYED_V3_ORIGIN = "https://mapgap-v3-preview.netlify.app";

test("wide V3 keeps the real MapGap V2 beside one multi-layer intelligence map", async ({page}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#civic");

  const workspace = page.getByRole("region", {name: "MapGap V3 workspace"});
  await expect(workspace).toHaveAttribute("data-layout", "split");
  await expect(page.getByRole("heading", {name: "MapGap V2"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Location intelligence"})).toBeVisible();

  const v2 = page.getByTitle("MapGap V2 access map");
  await expect(v2).toBeVisible();
  await expect(v2).toHaveAttribute("src", V2_URL);
  if (isDeployedCompositionRun()) {
    const liveV2 = page.frameLocator("iframe.v2-frame");
    await expect(liveV2.getByText("Nearby is not always easy to reach", {exact: true})).toBeVisible({timeout: 30_000});
    await expect(liveV2.locator(".leaflet-container")).toBeVisible();
  }
  await expect(page.locator(".maplibregl-map")).toHaveCount(1);
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});

  const layerToggle = page.getByRole("button", {name: /Layers 3\/3/});
  await expect(layerToggle).toHaveAttribute("aria-expanded", "false");
  await layerToggle.click();
  await expect(layerToggle).toHaveAttribute("aria-expanded", "true");
  const controls = page.getByRole("complementary", {name: "Intelligence controls"});
  await expect(controls).toContainText("3 connected");
  await expect(controls).toContainText("3 overlays visible");
  await expect(page.getByTestId("intelligence-map")).toBeVisible();
  await expectPaintedIntelligenceMap(page);

  const layerNames = controls.locator(".layer-registry .layer-name strong");
  await expect(layerNames.nth(0)).toHaveText("Rent burden");
  await controls.getByRole("button", {name: "Move Rent burden down"}).click();
  await expect(layerNames.nth(0)).toHaveText("Facility capacity");
  await expect(layerNames.nth(1)).toHaveText("Rent burden");

  const rentLayer = controls.locator(".layer-registry li").filter({hasText: "Rent burden"});
  await rentLayer.getByRole("checkbox", {name: "Show"}).uncheck();
  await expect(controls).toContainText("2 overlays visible");

  const editor = page.getByTestId("layer-editor");
  const sliders = editor.getByRole("slider");
  await sliders.nth(0).fill("0.4");
  await expect(editor.getByText("40%", {exact: true})).toBeVisible();
  await sliders.nth(1).fill("50");
  await expect(editor.getByText("50", {exact: true})).toBeVisible();
  await expect(controls.locator("details.provenance")).toContainText("Publisher");
  await expect(controls.locator("details.provenance")).toContainText("Vintage");
  await expect(controls.locator("details.provenance")).toContainText("License");

  await controls.getByRole("button", {name: /Civic capacity/}).click();
  await expect(editor).toContainText("Facility capacity");
  const visual = editor.getByLabel("Visualization");
  await installNonBasemapFetchProbe(page);
  for (const mark of ["symbol", "heat", "hex", "grid", "h3"]) {
    await visual.selectOption(mark);
    await expect(visual).toHaveValue(mark);
  }
  expect(await readNonBasemapFetchProbe(page), "mark changes must reuse the in-memory point source").toEqual([]);
  const layersButton = page.locator(".intelligence-actions button").last();
  await layersButton.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const withThematicLayers = await page.locator(".maplibregl-canvas").screenshot();
  await layersButton.click();
  for (const checkbox of await controls.getByRole("checkbox").all()) {
    if (await checkbox.isChecked()) await checkbox.uncheck();
  }
  await layersButton.click();
  await page.waitForTimeout(500);
  const withoutThematicLayers = await page.locator(".maplibregl-canvas").screenshot();
  expect(Buffer.compare(withThematicLayers, withoutThematicLayers), "deck overlays must visibly change the map canvas").not.toBe(0);
  await expect(page.locator(".maplibregl-map")).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});

test("an exact-origin V2 bridge event updates shared selection and linked viewport context", async ({page}) => {
  await page.goto("/#civic");
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});

  await dispatchV2Message(page, {
    schema: "mapgap.v2.ready/v1",
    contextSchema: "mapgap.v2.context/v1",
  });
  await expect(page.getByRole("status").filter({hasText: "Context bridge ready"})).toBeVisible();

  await dispatchV2Message(page, {
    schema: "mapgap.v2.context/v1",
    revision: 1,
    context: {
      bbox: [-74.2, 40.5, -73.8, 40.86],
      category: "library",
      query: "libraries near the commute",
      activeExtensions: ["routing"],
      selectedPointId: "bridge-library",
      servicePoints: [{
        id: "bridge-library",
        name: "Bridge Library",
        category: "library",
        categoryLabel: "Libraries",
        location: {lat: 40.72, lng: -74.04},
        source: "official_local",
        address: "1 Test Plaza",
      }],
      isochrones: [],
      heatmapMode: "walk",
    },
  });

  await expect(page.getByTestId("shared-selection")).toContainText("Bridge Library");
  await expect(page.getByTestId("shared-selection")).toContainText("Source official_local");
  await expect(page.getByRole("button", {name: "Linked to V2"})).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-status")).toContainText("walk context · rev selected");

  await dispatchV2Message(page, {
    schema: "mapgap.v2.context/v1",
    revision: 2,
    context: {
      bbox: [-74.2, 40.5, -73.8, 40.86], category: "library", query: "libraries near the commute",
      activeExtensions: ["routing"], selectedPointId: null,
      servicePoints: [], isochrones: [], heatmapMode: "walk",
    },
  });
  await expect(page.getByTestId("shared-selection")).toContainText("Northside Computer Lab");

  // A stale revision cannot restore the old selection.
  await dispatchV2Message(page, {
    schema: "mapgap.v2.context/v1",
    revision: 1,
    context: {
      bbox: [-74.2, 40.5, -73.8, 40.86], category: "library", query: "stale",
      activeExtensions: [], selectedPointId: "bridge-library",
      servicePoints: [{id: "bridge-library", name: "Stale Library", category: "library", location: {lat: 40.72, lng: -74.04}, source: "official_local"}],
      isochrones: [], heatmapMode: "off",
    },
  });
  await expect(page.getByTestId("shared-selection")).toContainText("Northside Computer Lab");

  // A new ready epoch resets the revision and accepts the next revision one.
  await dispatchV2Message(page, {schema: "mapgap.v2.ready/v1", contextSchema: "mapgap.v2.context/v1"});
  await dispatchV2Message(page, {
    schema: "mapgap.v2.context/v1",
    revision: 1,
    context: {
      bbox: [-74.1, 40.6, -73.9, 40.8], category: "library", query: "new epoch",
      activeExtensions: [], selectedPointId: "new-library",
      servicePoints: [{id: "new-library", name: "New Epoch Library", category: "library", location: {lat: 40.73, lng: -74.03}, source: "official_local"}],
      isochrones: [], heatmapMode: "off",
    },
  });
  await expect(page.getByTestId("shared-selection")).toContainText("New Epoch Library");
});

test("deployed V3 proves the coordinated live V2 frame and bridge headers", async ({page, request}) => {
  test.skip(!isDeployedCompositionRun(), "Runs only against the fixed public V3 origin after the coordinated V2/V3 deployment.");
  const v3Response = await page.goto("/");
  const liveV2 = page.frameLocator("iframe.v2-frame");
  await expect(liveV2.getByText("Nearby is not always easy to reach", {exact: true})).toBeVisible({timeout: 30_000});
  await expect(liveV2.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByText("Context bridge ready", {exact: true})).toBeVisible({timeout: 30_000});
  await expect(page.locator(".map-status")).toContainText(/context/);

  expect(v3Response?.headers()["content-security-policy"]).toContain(`frame-src ${V2_ORIGIN}`);
  const v2Response = await request.get(V2_URL);
  expect(v2Response.headers()["content-security-policy"]).toContain(`frame-ancestors 'self' ${DEPLOYED_V3_ORIGIN}`);
});

test("relocation retains intelligence overlays without borrowing Albany housing", async ({page}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/#civic");
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});
  await page.getByRole("button", {name: "Relocation"}).click();
  await page.getByRole("button", {name: /Layers 3\/3/}).click();

  await expect.poll(() => pageErrors).toEqual([]);
  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "split");
  await expect(page.getByTestId("intelligence-controls")).toContainText("Candidate decisions");
  await expect(page.getByTestId("intelligence-controls")).toContainText("Nearby places");
  await expect(page.getByTestId("intelligence-controls")).toContainText("Profile anchors");
  await expect(page.getByTestId("intelligence-controls")).toContainText("3 overlays visible");
  await expect(page.getByTestId("intelligence-controls")).not.toContainText("Housing context");
  await expect(page.getByTestId("intelligence-controls")).not.toContainText("Rent burden");
  await expect(page.locator(".maplibregl-map")).toHaveCount(1);
  await expect(page.getByTitle("MapGap V2 access map")).toBeVisible();
});

test("a housing source failure is isolated to the right workbench", async ({page}) => {
  await page.goto("/?failSource=housing#civic");

  await page.getByRole("button", {name: /Layers 2\/3/}).click();
  const controls = page.getByTestId("intelligence-controls");
  await expect(controls).toContainText("2 connected");
  await expect(controls).toContainText("Housing source unavailable");
  await expect(controls).toContainText("2 overlays visible");
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});
  await expect(page.getByTitle("MapGap V2 access map")).toBeVisible();
  await expect(page.getByRole("heading", {name: "MapGap V2"})).toBeVisible();
});

test("portrait and phone switch surfaces without replacing or reloading the V2 iframe", async ({page}) => {
  await page.setViewportSize({width: 820, height: 1080});
  let v2Navigations = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.url().replace(/\/$/, "") === V2_URL) v2Navigations += 1;
  });
  await page.goto("/#civic");

  const iframe = page.getByTitle("MapGap V2 access map");
  const iframeHandle = await iframe.elementHandle();
  expect(iframeHandle).not.toBeNull();
  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "focus-mapgap");
  await expect(iframe).toBeVisible();
  await expect(page.locator(".maplibregl-map")).toHaveCount(0);

  const initialNavigationCount = v2Navigations;
  await page.getByRole("button", {name: "Intelligence"}).click();
  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "focus-intelligence");
  await expect(page.locator(".maplibregl-map")).toHaveCount(1);
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});
  expect(await iframeHandle!.evaluate((node) => node.isConnected && node === document.querySelector("iframe.v2-frame"))).toBe(true);

  // V2 is authoritative while camera linking is enabled, so a live debounced
  // bounds update may legitimately supersede a manual Intelligence pan. This
  // persistence assertion exercises the explicit independent-camera mode.
  await page.getByRole("button", {name: /^(Linked to V2|Link V2 when ready)$/}).click();
  await expect(page.getByRole("button", {name: "Independent camera"})).toHaveAttribute("aria-pressed", "false");

  const initialViewport = await page.getByTestId("v3-shell").getAttribute("data-intelligence-viewport");
  const canvasBox = await page.locator(".maplibregl-canvas").boundingBox();
  expect(canvasBox).not.toBeNull();
  if (canvasBox) {
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width / 2 + 90, canvasBox.y + canvasBox.height / 2, {steps: 6});
    await page.mouse.up();
  }
  await expect.poll(() => page.getByTestId("v3-shell").getAttribute("data-intelligence-viewport")).not.toBe(initialViewport);

  const layersButton = page.getByRole("button", {name: /Layers 3\/3/});
  await layersButton.click();
  const controls = page.getByTestId("intelligence-controls");
  await controls.getByRole("button", {name: /Civic capacity/}).click();
  await page.getByTestId("layer-editor").getByLabel("Visualization").selectOption("h3");
  await controls.getByRole("button", {name: "Move Facility capacity up"}).click();
  const persistedViewport = await page.getByTestId("v3-shell").getAttribute("data-intelligence-viewport");

  await page.getByRole("button", {name: "MapGap"}).click();
  await expect(iframe).toBeVisible();
  await expect(page.locator(".maplibregl-map")).toHaveCount(0);
  expect(await iframeHandle!.evaluate((node) => node.isConnected && node === document.querySelector("iframe.v2-frame"))).toBe(true);
  expect(v2Navigations).toBe(initialNavigationCount);

  await page.getByRole("button", {name: "Intelligence"}).click();
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});
  await expect(page.getByTestId("intelligence-controls")).toBeVisible();
  await expect(page.getByTestId("layer-editor").getByLabel("Visualization")).toHaveValue("h3");
  await expect(page.locator(".layer-registry .layer-name strong").first()).toHaveText("Facility capacity");
  await expect(page.getByTestId("v3-shell")).toHaveAttribute("data-intelligence-viewport", persistedViewport!);
  await page.getByRole("button", {name: "MapGap"}).click();

  await page.setViewportSize({width: 390, height: 844});
  await expect(page.getByTestId("comparison-layout")).toHaveAttribute("data-layout", "focus-mapgap");
  await expect(page.getByTestId("surface-mount-count")).toContainText("1 heavyweight surface mounted");
});

test("a right basemap outage retries without replacing or reloading MapGap V2", async ({page}) => {
  let basemapRequests = 0;
  let v2Navigations = 0;
  await page.route(`${MAP_ORIGIN}/**`, async (route) => {
    basemapRequests += 1;
    await route.abort("connectionfailed");
  });
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.url().replace(/\/$/, "") === V2_URL) v2Navigations += 1;
  });
  await page.goto("/");

  const iframe = page.getByTitle("MapGap V2 access map");
  const iframeHandle = await iframe.elementHandle();
  const recovery = page.getByTestId("basemap-error");
  await expect(recovery).toBeVisible({timeout: 20_000});
  await expect(recovery).toContainText("Sources and evidence remain unchanged. MapGap V2 is still live.");
  const initialBasemapRequests = basemapRequests;
  const initialV2Navigations = v2Navigations;
  await recovery.getByRole("button", {name: "Retry intelligence map"}).click();
  await expect.poll(() => basemapRequests).toBeGreaterThan(initialBasemapRequests);
  expect(v2Navigations).toBe(initialV2Navigations);
  expect(await iframeHandle!.evaluate((node) => node.isConnected && node === document.querySelector("iframe.v2-frame"))).toBe(true);
});

test("a lost WebGL context is contained and restarts only Intelligence", async ({page}) => {
  await page.goto("/");
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});
  const iframe = page.getByTitle("MapGap V2 access map");
  const iframeHandle = await iframe.elementHandle();
  await page.locator(".maplibregl-canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", {cancelable: true}));
  });

  const recovery = page.getByTestId("basemap-error");
  await expect(recovery).toHaveAttribute("data-failure-kind", "webgl");
  await expect(recovery).toContainText("Graphics context interrupted");
  await recovery.getByRole("button", {name: "Retry intelligence map"}).click();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByTestId("intelligence-mounted")).toContainText("MapLibre intelligence workbench mounted", {timeout: 30_000});
  expect(await iframeHandle!.evaluate((node) => node.isConnected && node === document.querySelector("iframe.v2-frame"))).toBe(true);
});

test("workspace landmarks and primary controls are keyboard reachable", async ({page}) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("navigation", {name: "Decision story"})).toBeVisible();
  await expect(page.getByRole("region", {name: "MapGap V3 workspace"})).toBeVisible();
  await expect(page.getByRole("complementary", {name: "Intelligence controls"})).toHaveCount(0);
  await expect(page.getByTitle("MapGap V2 access map")).toHaveAttribute("title", "MapGap V2 access map");

  const layerToggle = page.getByRole("button", {name: /Layers 3\/3/});
  await layerToggle.focus();
  await expect(layerToggle).toBeFocused();
  await expect(layerToggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(layerToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("complementary", {name: "Intelligence controls"})).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(layerToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("complementary", {name: "Intelligence controls"})).toHaveCount(0);
});

async function dispatchV2Message(page: Page, data: unknown) {
  await page.evaluate(({data, origin}) => {
    const frame = document.querySelector<HTMLIFrameElement>("iframe.v2-frame");
    if (!frame?.contentWindow) throw new Error("V2 iframe is not mounted");
    window.dispatchEvent(new MessageEvent("message", {data, origin, source: frame.contentWindow}));
  }, {data, origin: V2_ORIGIN});
}

async function installNonBasemapFetchProbe(page: Page) {
  await page.evaluate((mapOrigin) => {
    const host = window as typeof window & {__mapgapFetches?: string[]};
    host.__mapgapFetches = [];
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith(mapOrigin)) host.__mapgapFetches!.push(url);
      return original(input, init);
    };
  }, MAP_ORIGIN);
}

async function readNonBasemapFetchProbe(page: Page) {
  return page.evaluate(() => (window as typeof window & {__mapgapFetches?: string[]}).__mapgapFetches ?? []);
}

async function expectPaintedIntelligenceMap(page: Page) {
  const canvas = page.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const png = await page.screenshot({clip: {x: Math.floor(box.x + box.width * .2), y: Math.floor(box.y + box.height * .25), width: Math.max(1, Math.floor(box.width * .55)), height: Math.max(1, Math.floor(box.height * .35))}});
  expect(png.byteLength).toBeGreaterThan(5_000);
}

function isDeployedCompositionRun() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  if (!baseURL) return false;
  try { return new URL(baseURL).origin === DEPLOYED_V3_ORIGIN; } catch { return false; }
}
