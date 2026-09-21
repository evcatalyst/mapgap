import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/worker/**",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.MAPGAP_BROWSER_PATH || undefined,
      args: process.env.MAPGAP_BROWSER_ARGS ? JSON.parse(process.env.MAPGAP_BROWSER_ARGS) : undefined,
    },
  },
  webServer: {
    command: "npm run dev:vite -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
