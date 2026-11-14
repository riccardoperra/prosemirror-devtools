#!/usr/bin/env node
// Serves pages-dist, checks that every example loads cleanly with the inspector open, and captures
// the screenshots in site/screenshots/. Run `pnpm build:pages` first.
import { spawn } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { examples } from "./examples.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputDir = `${root}site/screenshots`;
const base = process.env.PAGES_SITE_BASE ?? "/prosemirror-devtools/";
const port = Number(process.env.PORT ?? 4391);
const origin = `http://127.0.0.1:${port}`;
const viewport = { width: 1440, height: 900 };
// macOS Chromium scrolls on End instead of moving the caret.
const lineEnd = process.platform === "darwin" ? "Meta+ArrowRight" : "End";

/** Opens the panel the way a visitor would and resolves once it is on screen. */
async function openInspector(page, example) {
  if (example.inspector === "launcher") {
    await page.getByRole("button", { name: "Open TanStack Devtools", exact: true }).click();
  }
  const panel = page.getByRole("tablist", { name: "Inspector sections" }).first();
  await panel.waitFor({ state: "visible", timeout: 15_000 });
  return panel;
}

/** Types into the first editor so the Timeline has transactions to show. */
async function edit(page) {
  await page.locator('[contenteditable="true"]').first().click();
  await page.keyboard.press(lineEnd);
  await page.keyboard.type(" Inspected.", { delay: 20 });
}

/** Extra invoice views, each starting from a loaded invoice page. */
const invoiceExtras = [
  {
    file: "invoice-outline",
    async run(page) {
      const notes = page
        .getByRole("navigation", { name: "Document outline" })
        .getByRole("button", { name: /^Notes/ });
      await notes.click();
      await page.locator(".invoice-document h3.is-spotlit", { hasText: "Notes" }).waitFor();
    },
  },
  {
    file: "invoice-tab",
    async run(page, example) {
      await openInspector(page, example);
      await page.getByRole("tab", { name: "Invoice", exact: true }).click();
    },
  },
  {
    file: "invoice-webmcp",
    async run(page, example) {
      const scenario = page.locator(".scenario", { hasText: "Agent reads the invoice" });
      await scenario.locator("summary").click();
      await scenario.getByRole("button", { name: "Run Agent reads the invoice" }).click();
      await scenario.getByText("Dispatched", { exact: true }).waitFor();
      await openInspector(page, example);
      await page.getByRole("tab", { name: "WebMCP", exact: true }).click();
      await page.getByRole("button", { name: /Call history \(3\)/ }).waitFor();
    },
  },
  {
    file: "invoice-collaboration",
    query: `?room=screenshots-${Date.now()}&user=Ada`,
    async run(ada) {
      const [grace] = await Promise.all([
        ada.context().waitForEvent("page"),
        ada.getByRole("button", { name: "Open as second user", exact: true }).click(),
      ]);
      await grace.setViewportSize(viewport);
      await grace.locator(".line-item").first().waitFor();
      await ada.bringToFront();
      await ada.locator(".row-description").first().click();
      await ada.keyboard.press(lineEnd);
      await ada.keyboard.type(" (reviewed)");
      await grace.locator(".row-description", { hasText: "(reviewed)" }).first().waitFor();
      const caret = grace.locator(".collaboration-carets__label", { hasText: "Ada" });
      await caret.waitFor();
      await caret.scrollIntoViewIfNeeded();
      return grace;
    },
  },
];

function startServer() {
  const server = spawn(process.execPath, [`${root}scripts/preview-pages.mjs`], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  return new Promise((resolve, reject) => {
    server.once("exit", (code) => reject(new Error(`The preview server exited with ${code}.`)));
    server.stdout.once("data", () => resolve(server));
  });
}

/** Loads one page and records every failed request and console error it produces. */
async function load(browser, path) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const problems = [];
  context.on("response", (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  context.on("page", (page) => {
    page.on("pageerror", (error) => problems.push(`pageerror ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console ${message.text()}`);
    });
  });
  const page = await context.newPage();
  await page.goto(`${origin}${base}${path}`, { waitUntil: "networkidle" });
  return { context, page, problems };
}

async function capture(page, file) {
  const path = `${outputDir}/${file}.jpg`;
  await page.waitForTimeout(400);
  await page.screenshot({ path, type: "jpeg", quality: 80 });
  return { file: `${file}.jpg`, kb: Math.round(statSync(path).size / 1024) };
}

mkdirSync(outputDir, { recursive: true });
const server = await startServer();
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {},
);
const rows = [];
const shots = [];
try {
  for (const example of examples) {
    const { context, page, problems } = await load(browser, `${example.name}/`);
    let inspector = "visible";
    try {
      await edit(page);
      const panel = await openInspector(page, example);
      if (example.inspector === "inline") await panel.scrollIntoViewIfNeeded();
      shots.push(await capture(page, example.name));
    } catch (error) {
      inspector = `missing (${error.message.split("\n")[0]})`;
    }
    rows.push({ example: example.name, problems: [...problems], inspector });
    await context.close();

    if (example.name !== "invoice") continue;
    for (const extra of invoiceExtras) {
      const loaded = await load(browser, `${example.name}/${extra.query ?? ""}`);
      try {
        const shown = (await extra.run(loaded.page, example)) ?? loaded.page;
        shots.push(await capture(shown, extra.file));
      } catch (error) {
        loaded.problems.push(`capture failed: ${error.message.split("\n")[0]}`);
      }
      rows.push({ example: extra.file, problems: loaded.problems, inspector: "n/a" });
      await loaded.context.close();
    }
  }

  const landing = await load(browser, "");
  const thumbnails = await landing.page.$$eval(".card img", (images) =>
    Promise.all(images.map(async (image) => (await fetch(image.src)).status)),
  );
  if (thumbnails.length !== examples.length) {
    landing.problems.push(`${thumbnails.length} cards for ${examples.length} examples`);
  }
  for (const status of thumbnails.filter((status) => status >= 400)) {
    landing.problems.push(`thumbnail ${status}`);
  }
  rows.push({ example: "landing", problems: landing.problems, inspector: "n/a" });
  await landing.context.close();
} finally {
  await browser.close();
  server.kill();
}

console.log("\n| Page | 4xx and console errors | Inspector |\n| --- | --- | --- |");
for (const row of rows) {
  console.log(`| ${row.example} | ${row.problems.join("; ") || "none"} | ${row.inspector} |`);
}
console.log("\n| Screenshot | KB |\n| --- | --- |");
for (const shot of shots) console.log(`| ${shot.file} | ${shot.kb} |`);

const failed = rows.filter((row) => row.problems.length > 0 || row.inspector.startsWith("missing"));
if (failed.length > 0) {
  console.error(
    `\n${failed.length} page(s) failed: ${failed.map((row) => row.example).join(", ")}`,
  );
  process.exit(1);
}
