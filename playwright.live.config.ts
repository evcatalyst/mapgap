import { defineConfig, devices } from "@playwright/test";

const liveBaseUrl = process.env.MAPGAP_LIVE_BASE_URL || "https://mapgap-access.netlify.app";

export default defineConfig({
  testDir: "./tests-live",
  timeout: 90_000,
  workers: 1,
  expect: {
    timeout: 20_000,
  },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-live" }]],
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `MAPGAP_API_PROXY_TARGET=${liveBaseUrl} npm run dev:vite -- --host 127.0.0.1 --port 5175 --strictPort`,
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
