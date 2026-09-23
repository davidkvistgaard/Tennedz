import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", workers: 1, retries: 0,
  globalTeardown: "./tests/support/teardown.mjs",
  use: { baseURL: "http://localhost:3100", channel: process.platform === "win32" ? "msedge" : "chromium", trace: "retain-on-failure" },
  webServer: { command: "node tests/support/server.mjs", url: "http://localhost:3100/login", reuseExistingServer: false, timeout: 60000, gracefulShutdown: { signal: "SIGTERM", timeout: 3000 } },
});
