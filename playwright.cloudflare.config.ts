import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-cloudflare",
  outputDir: "./test-results-cloudflare",
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:8787",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.MAPGAP_BROWSER_PATH || undefined,
      args: process.env.MAPGAP_BROWSER_ARGS ? JSON.parse(process.env.MAPGAP_BROWSER_ARGS) : undefined,
    },
  },
  webServer: {
    command: "npx wrangler dev --ip 127.0.0.1 --port 8787 --inspector-port 9231",
    url: "http://127.0.0.1:8787/api/health",
    timeout: 60_000,
    reuseExistingServer: false,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
});
