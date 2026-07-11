import { expect, test, type Page } from "@playwright/test";

async function mockAccessibilityRoutes(page: Page) {
  await page.route(/tile\.openstreetmap\.org|basemaps\.cartocdn\.com/, async (route) => {
    await route.fulfill({ status: 204, body: "" });
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
}

test("v2 supports keyboard entry, drawer dismissal, and focus return", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAccessibilityRoutes(page);
  await page.goto("/v2");

  const explore = page.getByRole("button", { name: "Explore Nearby" });
  let reachedExplore = false;

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    if (await explore.evaluate((element) => element === document.activeElement)) {
      reachedExplore = true;
      break;
    }
  }

  expect(reachedExplore).toBe(true);
  await page.keyboard.press("Enter");

  const drawer = page.locator('section[aria-label="Nearby access drawer"]');
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Close nearby drawer" }).click();
  await expect(explore).toBeFocused();
});

test("v2 category drawer exposes touch-sized controls and polite status", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockAccessibilityRoutes(page);
  await page.goto("/v2");
  await page.getByRole("button", { name: "Explore Nearby" }).click();

  const drawer = page.locator('section[aria-label="Nearby access drawer"]');
  const buttons = drawer.getByRole("button");
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible())) {
      continue;
    }

    const box = await button.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await expect(drawer.getByRole("status")).toContainText("Choose a category");
});

test("v2 honors reduced motion and keeps primary action contrast", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockAccessibilityRoutes(page);
  await page.goto("/v2");

  const explore = page.getByRole("button", { name: "Explore Nearby" });
  const styles = await explore.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      color: computed.color,
      transitionDuration: computed.transitionDuration,
    };
  });

  expect(styles.transitionDuration).toMatch(/1e-05s|0\.00001s|0\.01ms|0s/);
  expect(contrastRatio(styles.background, styles.color)).toBeGreaterThanOrEqual(4.5);
});

function contrastRatio(background: string, foreground: string) {
  const backgroundLuminance = luminance(background);
  const foregroundLuminance = luminance(foreground);
  const lighter = Math.max(backgroundLuminance, foregroundLuminance);
  const darker = Math.min(backgroundLuminance, foregroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color: string) {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number)
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });

  if (!channels || channels.length !== 3) {
    throw new Error(`Unsupported color: ${color}`);
  }

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
