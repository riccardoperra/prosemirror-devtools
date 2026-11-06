import { defineConfig, devices } from "@playwright/test";

const fixtures = [
  { name: "tanstack", developmentPort: 4174, productionPort: 4274 },
  { name: "standalone", developmentPort: 4180, productionPort: 4280 },
  { name: "tiptap", developmentPort: 4181, productionPort: 4281 },
  { name: "react-prosemirror", developmentPort: 4182, productionPort: 4282 },
  { name: "collab", developmentPort: 4183, productionPort: 4283 },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  webServer: fixtures.flatMap((fixture) => [
    {
      command: `pnpm --filter @prosemirror-devtools/${fixture.name}-demo exec vite --host 127.0.0.1 --port ${fixture.developmentPort} --strictPort`,
      url: `http://127.0.0.1:${fixture.developmentPort}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm --filter @prosemirror-devtools/${fixture.name}-demo exec vite preview --host 127.0.0.1 --port ${fixture.productionPort} --strictPort`,
      url: `http://127.0.0.1:${fixture.productionPort}`,
      reuseExistingServer: !process.env.CI,
    },
  ]),
});
