import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { available, callTool, editorTarget, object } from "./inspection-tools";

const initialDocument = {
  type: "doc",
  content: [
    {
      type: "bullet_list",
      content: [
        {
          type: "list_item",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha" }] }],
        },
      ],
    },
  ],
};
const splitDocument = {
  type: "doc",
  content: [
    {
      type: "bullet_list",
      content: [
        {
          type: "list_item",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha" }] }],
        },
        { type: "list_item", content: [{ type: "paragraph" }] },
      ],
    },
  ],
};

test("V2 and V4 use real Enter and Undo with pinned semantic evidence", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4180");
  const target = await editorTarget(page);
  const documentBefore = available(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "document" } }),
  );
  expect(documentBefore.value).toEqual(initialDocument);
  await page.getByRole("button", { name: "Focus editor", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Standalone editor", exact: true });
  await editor.press("End");
  await editor.press("Enter");
  await expect(editor.locator("li")).toHaveCount(2);
  const documentAfter = available(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "document" } }),
  );
  expect(documentAfter.value).toEqual(splitDocument);
  const point = object(documentAfter.point);
  const selection = available(
    await callTool(page, "prosemirror_read", { point, query: { kind: "selection" } }),
  );
  expect(selection.value).toMatchObject({ type: "text", anchor: 12, head: 12, empty: true });
  const dispatches = available(
    await callTool(page, "prosemirror_read", { point, query: { kind: "transactions" } }),
  );
  expect(dispatches.value).toMatchObject([
    { id: 1, applicationStatus: "applied", docChanged: true },
  ]);
  expect(Array.isArray(dispatches.value) && dispatches.value.length).toBe(1);
  const history = available(
    await callTool(page, "prosemirror_read", {
      point,
      query: { kind: "contribution", id: "prosemirror-history" },
    }),
  );
  expect(history.value).toMatchObject({ kind: "state", depths: { undoDepth: 1, redoDepth: 0 } });
  const splitScreenshot = testInfo.outputPath("standalone-list-split.png");
  await page.screenshot({ path: splitScreenshot, fullPage: true });
  await testInfo.attach("List split through Enter", {
    path: splitScreenshot,
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "Inspect dispatch #1", exact: true }).click();
  await page.getByRole("tab", { name: /^Performance/ }).click();
  await expect(page.getByRole("group", { name: "Dispatch selection", exact: true })).toContainText(
    "1 / 1",
  );
  await expect(page.getByLabel("Inspection context", { exact: true })).toContainText("Dispatch #1");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator("li")).toHaveCount(1);
  await expect(page.getByLabel("Inspection context", { exact: true })).toContainText("Dispatch #1");
  const undone = available(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "document" } }),
  );
  expect(undone.value).toEqual(initialDocument);
  expect(
    await callTool(page, "prosemirror_read", { point, query: { kind: "document" } }),
  ).toMatchObject({ kind: "expired" });
  const historical = available(
    await callTool(page, "prosemirror_inspect", {
      target,
      at: { kind: "transaction", id: 1 },
      query: { kind: "document" },
    }),
  );
  expect(historical.value).toEqual(splitDocument);
  const undoHistory = available(
    await callTool(page, "prosemirror_read", {
      point: undone.point,
      query: { kind: "contribution", id: "prosemirror-history" },
    }),
  );
  expect(undoHistory.value).toMatchObject({ depths: { undoDepth: 0, redoDepth: 1 } });
  await page.getByRole("button", { name: "Reset fixture", exact: true }).click();
  const replacement = await editorTarget(page);
  expect(replacement).not.toEqual(target);
  expect(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "document" } }),
  ).toMatchObject({ kind: "expired" });
  await expect(page.locator("[data-pm-decoration-overlay]")).toHaveCount(0);
  expect(errors).toEqual([]);
  const observationsPath = testInfo.outputPath("semantic-observations.json");
  await writeFile(
    observationsPath,
    JSON.stringify(
      {
        target,
        documentBefore,
        documentAfter,
        selection,
        dispatches,
        history,
        undone,
        historical,
        undoHistory,
        replacement,
      },
      null,
      2,
    ),
  );
  await testInfo.attach("Semantic observations", {
    path: observationsPath,
    contentType: "application/json",
  });
});

test("V5 repeats the list scenario through accessible UI without JavaScript evaluation", async ({
  page,
}, testInfo) => {
  await page.goto("http://127.0.0.1:4180");
  const editor = page.getByRole("textbox", { name: "Standalone editor", exact: true });
  await page.getByRole("button", { name: "Focus editor", exact: true }).click();
  await editor.press("End");
  await editor.press("Enter");
  await expect(editor.locator("li")).toHaveCount(2);
  await expect(page.getByRole("status").filter({ hasText: "Undo depth" })).toContainText(
    "Caret 12. Dispatches 1.",
  );
  await page.getByRole("button", { name: "Inspect dispatch #1", exact: true }).click();
  await page.getByRole("tab", { name: /^Events/ }).click();
  await expect(page.getByLabel("Event and command details", { exact: true })).toContainText(
    "handleKeyDown",
  );
  await expect(
    page.getByRole("button", { name: "Inspect dispatch #1 in standalone-list", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect dispatch #1 in standalone-list", exact: true })
    .click();
  await expect(
    page.getByRole("tablist", { name: "Timeline views" }).getByRole("tab", { selected: true }),
  ).toHaveText("Transactions");
  await page.getByRole("tab", { name: "Context", exact: true }).click();
  await expect(page.getByLabel("Installed inspectors", { exact: true })).toContainText(
    "Undo history",
  );
  await page.getByText("Technical details", { exact: true }).click();
  await expect(page.getByLabel("Semantic inspector evidence", { exact: true })).toContainText(
    "prosemirror-history",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator("li")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "Undo depth" })).toContainText(
    "Undo depth 0. Redo depth 1. Caret 8. Dispatches 2.",
  );
  await expect(page.getByLabel("Inspection context", { exact: true })).toContainText("Dispatch #1");
  await page.getByRole("button", { name: "Follow live", exact: true }).click();
  await expect(page.getByLabel("Inspection context", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tabpanel")).toContainText("Live editor");
  const screenshot = testInfo.outputPath("standalone-computer-use.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("UI-only undo and diagnostic evidence", {
    path: screenshot,
    contentType: "image/png",
  });
});

test("V6 attach-only capture leaves unobserved input evidence inconclusive", async ({ page }) => {
  await page.goto("http://127.0.0.1:4180");
  await page.getByRole("combobox", { name: "Capture profile", exact: true }).selectOption("attach");
  await expect(
    page.getByText(
      "Attach captures dispatches. Existing plugin hooks and input handlers are not instrumented.",
      { exact: true },
    ),
  ).toBeVisible();
  const target = await editorTarget(page);
  const editor = page.getByRole("textbox", { name: "Standalone editor", exact: true });
  await page.getByRole("button", { name: "Focus editor", exact: true }).click();
  await editor.press("Enter");
  await expect(editor.locator("li")).toHaveCount(2);
  const current = available(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "document" } }),
  );
  expect(current.value).toEqual(splitDocument);
  expect(
    await callTool(page, "prosemirror_check", {
      request: { target, query: { kind: "events" } },
      assertion: { path: [], predicate: { kind: "exists" }, completeness: "capture" },
    }),
  ).toMatchObject({ kind: "inconclusive", missing: ["unobserved"] });
  await page.getByRole("tab", { name: /^Events/ }).click();
  await expect(
    page.getByText(
      "No calls recorded. Use the editor’s keys, paste, or a named command. No transaction is required.",
      { exact: true },
    ),
  ).toBeVisible();
});

for (const fixture of [
  { name: "Tiptap", port: 4181, editor: "Tiptap editor" },
  { name: "React ProseMirror", port: 4182, editor: "React ProseMirror editor" },
]) {
  test(`V7 ${fixture.name} captures a native gesture once across repeated remounts`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${fixture.port}`);
    let previous: Record<string, unknown> | undefined;
    for (let round = 0; round < 3; round += 1) {
      const target = await editorTarget(page);
      if (previous) {
        expect(target).not.toEqual(previous);
        expect(
          await callTool(page, "prosemirror_inspect", {
            target: previous,
            query: { kind: "document" },
          }),
        ).toMatchObject({ kind: "expired" });
      }
      await page.getByRole("button", { name: "Focus editor", exact: true }).click();
      const editor = page.getByRole("textbox", { name: fixture.editor, exact: true });
      await editor.press(process.platform === "darwin" ? "Meta+ArrowRight" : "End");
      await expect
        .poll(async () => {
          const selected = available(
            await callTool(page, "prosemirror_inspect", {
              target,
              query: { kind: "selection" },
            }),
          );
          return object(selected.value).anchor;
        })
        .toBe(8);
      const before = available(
        await callTool(page, "prosemirror_inspect", { target, query: { kind: "transactions" } }),
      );
      if (!Array.isArray(before.value)) throw new Error("Expected dispatch summaries.");
      const beforeCount = before.value.length;
      await editor.press("Enter");
      await expect(editor.locator("li")).toHaveCount(2);
      const after = available(
        await callTool(page, "prosemirror_inspect", { target, query: { kind: "transactions" } }),
      );
      if (!Array.isArray(after.value)) throw new Error("Expected dispatch summaries.");
      expect(after.value).toHaveLength(beforeCount + 1);
      expect(after.value.at(-1)).toMatchObject({ applicationStatus: "applied", docChanged: true });
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(editor.locator("li")).toHaveCount(1);
      const undone = available(
        await callTool(page, "prosemirror_inspect", { target, query: { kind: "document" } }),
      );
      expect(JSON.stringify(undone.value)).toContain("Alpha");
      previous = target;
      await page.getByRole("button", { name: "Reset fixture", exact: true }).click();
    }
    expect(errors).toEqual([]);
  });
}

for (const fixture of [
  { name: "standalone", port: 4280, editor: "Standalone editor" },
  { name: "Tiptap", port: 4281, editor: "Tiptap editor" },
  { name: "React ProseMirror", port: 4282, editor: "React ProseMirror editor" },
]) {
  test(`V7 ${fixture.name} production build keeps editor actions and disables diagnostics`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${fixture.port}`);
    await expect(
      page.getByText("Diagnostics are disabled in this production build.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(callTool(page, "prosemirror_catalog")).rejects.toThrow(
      "No opted-in ProseMirror discovery bridge responded.",
    );
    const editor = page.getByRole("textbox", { name: fixture.editor, exact: true });
    await page.getByRole("button", { name: "Focus editor", exact: true }).click();
    await editor.press("End");
    await editor.press("Enter");
    await expect(editor.locator("li")).toHaveCount(2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(editor.locator("li")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("V5 narrow panel preserves readable navigation and context", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4180");
  await page.getByRole("button", { name: "Focus editor", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Standalone editor", exact: true });
  await editor.press("Enter");
  await page.getByRole("button", { name: "Inspect dispatch #1", exact: true }).click();
  await page.getByRole("tab", { name: "Document", exact: true }).click();
  await page.getByRole("tab", { name: "State", exact: true }).click();
  await expect(page.getByLabel("Inspection context", { exact: true })).toContainText("Dispatch #1");
  await expect(page.getByRole("button", { name: "Follow live", exact: true })).toBeVisible();
  const screenshot = testInfo.outputPath("standalone-narrow.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("Narrow historical context", {
    path: screenshot,
    contentType: "image/png",
  });
});
