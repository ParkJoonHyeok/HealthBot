import { defineConfig } from "@playwright/test";
const spring = process.env.HEALBOT_BACKEND === "spring";
const baseURL = spring ? "http://127.0.0.1:3101" : "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  use: {
    baseURL,
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: {
    command: spring
      ? "python backend/cloud_maven.py spring-boot:test-run -Dspring-boot.run.main-class=kr.healbot.BrowserTestApplication"
      : "node src/server.js",
    url: baseURL + "/api/health",
    timeout: 120000,
    env: { PORT: "3100", BACKEND_PORT: "3101", HOSPITAL_DEMO: "true" },
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
