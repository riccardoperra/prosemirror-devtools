import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

import { available, callTool, editorTarget } from "./inspection-tools";

test("I2 two standalone hosts keep independent read points and share one capture", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4180");
  const target = await editorTarget(page);
  await page.getByRole("button", { name: "Open another inspector", exact: true }).click();
  const first = page.locator("#inspector");
  const second = page.getByRole("region", { name: "Additional inspector", exact: true });
  await expect(second).toBeVisible();
  const editor = page.getByRole("textbox", { name: "Standalone editor", exact: true });
  await page.getByRole("button", { name: "Focus editor", exact: true }).click();
  await editor.press("Enter");
  await expect(editor.locator("li")).toHaveCount(2);
  await first.getByRole("button", { name: "Inspect dispatch #1", exact: true }).click();
  await second.getByRole("button", { name: "Inspect dispatch #1", exact: true }).click();
  await second.getByRole("button", { name: "Follow live", exact: true }).click();
  await editor.press("X");
  await expect(editor).toContainText("X");
  await expect(first.getByLabel("Inspection context", { exact: true })).toContainText(
    "Dispatch #1",
  );
  await expect(second.getByLabel("Inspection context", { exact: true })).toHaveCount(0);
  await expect(
    second.getByRole("button", { name: "Inspect dispatch #2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await second.getByRole("button", { name: "Inspect dispatch #2", exact: true }).click();
  await expect(second.getByLabel("Inspection context", { exact: true })).toContainText(
    "Dispatch #2",
  );
  await expect(first.getByLabel("Inspection context", { exact: true })).toContainText(
    "Dispatch #1",
  );
  const current = available(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "transactions" } }),
  );
  expect(current.value).toMatchObject([{ id: 1 }, { id: 2 }]);
  expect(await editorTarget(page)).toEqual(target);
  await page.getByRole("button", { name: "Close another inspector", exact: true }).click();
  await expect(second).toHaveCount(0);
  expect(await editorTarget(page)).toEqual(target);
  await expect(first.getByLabel("Inspection context", { exact: true })).toContainText(
    "Dispatch #1",
  );
  await expect(editor).toContainText("X");
  expect(errors).toEqual([]);
});

test("V4 exported recordings open offline after remount and never replace the live editor", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4180");
  const target = await editorTarget(page);
  const editor = page.getByRole("textbox", { name: "Standalone editor", exact: true });
  await page.getByRole("button", { name: "Focus editor", exact: true }).click();
  await editor.press("Enter");
  await expect(editor.locator("li")).toHaveCount(2);
  await page.getByRole("button", { name: "Refresh editor sessions", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Recording export editor", exact: true })
    .selectOption("standalone-list");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export diagnostic recording", exact: true }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath("exported-recording.json");
  await download.saveAs(path);
  const exported: unknown = JSON.parse(await readFile(path, "utf8"));
  expect(exported).toMatchObject({
    format: "prosemirror-inspector-recording",
    version: 1,
    origin: { target },
    dispatches: [{ id: 1 }],
  });
  await page.getByRole("button", { name: "Reset fixture", exact: true }).click();
  const replacement = await editorTarget(page);
  expect(replacement).not.toEqual(target);
  await expect(editor.locator("li")).toHaveCount(1);
  await page.getByLabel("Import diagnostic recording", { exact: true }).setInputFiles(path);
  const offline = page.getByRole("region", {
    name: "ProseMirror recording inspector",
    exact: true,
  });
  await expect(offline.getByText("Offline source", { exact: true })).toBeVisible();
  await expect(offline).toContainText("Read-only source recording:");
  await expect(offline.getByRole("button", { name: "Restore", exact: true })).toHaveCount(0);
  await offline
    .getByRole("combobox", { name: "Recording read point", exact: true })
    .selectOption("1");
  await offline
    .getByRole("combobox", { name: "Recording evidence query", exact: true })
    .selectOption("selection");
  await offline.getByRole("button", { name: "Before dispatch", exact: true }).click();
  await expect(offline.getByLabel("Selection", { exact: true })).toContainText(/anchor\s*:\s*8/);
  await offline.getByRole("button", { name: "After dispatch", exact: true }).click();
  await expect(offline.getByLabel("Selection", { exact: true })).toContainText(/anchor\s*:\s*12/);
  await offline
    .getByRole("combobox", { name: "Recording evidence query", exact: true })
    .selectOption("contributions");
  await expect(offline.getByLabel("Inspector projections", { exact: true })).toContainText(
    "prosemirror-history",
  );
  await expect(editor.locator("li")).toHaveCount(1);
  expect(await editorTarget(page)).toEqual(replacement);
  expect(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "document" } }),
  ).toMatchObject({ kind: "expired" });
  const screenshot = testInfo.outputPath("offline-recording-after-remount.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("Offline evidence beside a replacement live editor", {
    path: screenshot,
    contentType: "image/png",
  });
  const rejected = testInfo.outputPath("unsupported-recording.json");
  await writeFile(
    rejected,
    JSON.stringify({ format: "prosemirror-inspector-recording", version: 999 }),
  );
  await page.getByLabel("Import diagnostic recording", { exact: true }).setInputFiles(rejected);
  await expect(page.getByText(/^Recording rejected\./)).toBeVisible();
  await expect(offline.getByText("Offline source", { exact: true })).toBeVisible();
  await expect(editor.locator("li")).toHaveCount(1);
  expect(errors).toEqual([]);
  await testInfo.attach("Exported diagnostic recording", { path, contentType: "application/json" });
});
