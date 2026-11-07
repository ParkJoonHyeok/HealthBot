import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: {
    command: "node src/server.js",
    url: "http://127.0.0.1:3100/api/health",
    env: { PORT: "3100", HOSPITAL_DEMO: "true" },
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
