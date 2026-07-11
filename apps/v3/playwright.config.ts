import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const mobileViewport = process.env.PLAYWRIGHT_MOBILE === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: externalBaseURL || "http://127.0.0.1:4174",
    browserName: "chromium",
    viewport: mobileViewport ? {width: 390, height: 844} : { width: 1440, height: 960 },
  },
  webServer: externalBaseURL ? undefined : {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
