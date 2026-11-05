import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

import { available, callTool, object } from "./inspection-tools";

const peers = ["A", "B"] satisfies readonly ("A" | "B")[];

test("V3 official collaboration converges while paused capture retains an explicit gap", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4183");
  await page.getByRole("checkbox", { name: "Hold delivery", exact: true }).check();
  const editors = {
    A: page.getByRole("textbox", { name: "Official collab editor A", exact: true }),
    B: page.getByRole("textbox", { name: "Official collab editor B", exact: true }),
  };
  for (const peer of peers) {
    await editors[peer].click();
    await editors[peer].press("End");
    await editors[peer].press(peer);
  }
  await expect(editors.A).toHaveText("Shared document.A");
  await expect(editors.B).toHaveText("Shared document.B");
  const discovered = object(await callTool(page, "prosemirror_editors"));
  if (!Array.isArray(discovered.editors)) throw new Error("Missing collaboration editors.");
  const first = discovered.editors.find(
    (entry: unknown) => object(object(entry).target).editorId === "official-A",
  );
  const target = object(object(first).target);
  const pending = available(
    await callTool(page, "prosemirror_inspect", {
      target,
      query: { kind: "contribution", id: "prosemirror-collab" },
    }),
  );
  expect(pending.value).toMatchObject({
    kind: "state",
    state: {
      version: 0,
      unconfirmedSteps: 1,
      origins: [{ pendingStepIndex: 0, docChanged: true }],
    },
  });
  await page.getByRole("button", { name: "Pause capture A", exact: true }).click();
  await page.getByRole("button", { name: "Deliver queued updates", exact: true }).click();
  await expect(editors.A).toHaveText("Shared document.AB");
  await expect(editors.B).toHaveText("Shared document.AB");
  const confirmed = available(
    await callTool(page, "prosemirror_inspect", {
      target,
      query: { kind: "contribution", id: "prosemirror-collab" },
    }),
  );
  expect(confirmed.value).toMatchObject({
    state: { version: 2, unconfirmedSteps: 0 },
    transport: {
      kind: "application-observed",
      counts: { sends: 1, receives: 2, acknowledgements: 1 },
      latest: { signal: { kind: "receive", dispatch: { kind: "unknown" } } },
    },
  });
  expect(confirmed.coverage).toMatchObject({ complete: false, gaps: [{ reason: "paused" }] });
  const traceVerdict = await callTool(page, "prosemirror_check", {
    request: { target, query: { kind: "transactions" } },
    assertion: { path: [], predicate: { kind: "exists" }, completeness: "capture" },
  });
  expect(traceVerdict).toMatchObject({ kind: "inconclusive", missing: ["complete-capture"] });
  expect(errors).toEqual([]);
  const screenshot = testInfo.outputPath("official-collaboration-paused.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("Converged peers during capture pause", {
    path: screenshot,
    contentType: "image/png",
  });
  const observations = testInfo.outputPath("collaboration-observations.json");
  await writeFile(
    observations,
    JSON.stringify({ target, pending, confirmed, traceVerdict }, null, 2),
  );
  await testInfo.attach("Official collaboration evidence", {
    path: observations,
    contentType: "application/json",
  });
});

test("V3 Yjs collaboration keeps the other peer's edit when undoing local work", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4183");
  await page.getByRole("checkbox", { name: "Hold delivery", exact: true }).check();
  await page
    .getByRole("combobox", { name: "Collaboration system", exact: true })
    .selectOption("yjs");
  const editors = {
    A: page.getByRole("textbox", { name: "Tiptap Yjs editor A", exact: true }),
    B: page.getByRole("textbox", { name: "Tiptap Yjs editor B", exact: true }),
  };
  for (const peer of peers) {
    await editors[peer].click();
    await editors[peer].press("End");
    await editors[peer].press(peer);
  }
  await expect(editors.A).toHaveText("Shared Yjs document.A");
  await expect(editors.B).toHaveText("Shared Yjs document.B");
  await page.getByRole("button", { name: "Deliver queued updates", exact: true }).click();
  await expect(editors.A).toHaveText(/^Shared Yjs document\.(AB|BA)$/);
  await expect(editors.B).toHaveText(await editors.A.innerText());
  const discovered = object(await callTool(page, "prosemirror_editors"));
  if (!Array.isArray(discovered.editors)) throw new Error("Missing Yjs editors.");
  const first = discovered.editors.find(
    (entry: unknown) => object(object(entry).target).editorId === "yjs-A",
  );
  const target = object(object(first).target);
  const synchronized = available(
    await callTool(page, "prosemirror_inspect", {
      target,
      query: { kind: "contribution", id: "yjs" },
    }),
  );
  expect(synchronized.value).toMatchObject({
    binding: "yjs",
    undo: { kind: "available", value: { undoDepth: 1, redoDepth: 0 } },
    scope: "independent-document-and-provider-signals",
  });
  expect(
    await callTool(page, "prosemirror_inspect", {
      target,
      query: { kind: "contribution", id: "prosemirror-collab" },
    }),
  ).toMatchObject({ kind: "unsupported" });
  const panel = page.getByRole("tabpanel");
  await page.getByRole("tab", { name: "Collaboration", exact: true }).click();
  await expect(panel.getByRole("group", { name: "Latest update", exact: true })).toContainText(
    "Remote",
  );
  await expect(panel.getByRole("group", { name: "Confirmed version", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Undo history", exact: true }).click();
  await expect(panel.getByRole("group", { name: "Undo", exact: true })).toHaveText("Undo1");
  await page.getByRole("button", { name: "Undo in A", exact: true }).click();
  await expect(panel.getByRole("group", { name: "Undo", exact: true })).toHaveText("Undo0");
  await expect(panel.getByRole("group", { name: "Redo", exact: true })).toHaveText("Redo1");
  await page.getByRole("button", { name: "Deliver queued updates", exact: true }).click();
  await expect(editors.A).toHaveText("Shared Yjs document.B");
  await expect(editors.B).toHaveText("Shared Yjs document.B");
  const undone = available(
    await callTool(page, "prosemirror_inspect", {
      target,
      query: { kind: "contribution", id: "yjs" },
    }),
  );
  expect(undone.value).toMatchObject({
    undo: { kind: "available", value: { undoDepth: 0, redoDepth: 1 } },
  });
  expect(errors).toEqual([]);
  const screenshot = testInfo.outputPath("yjs-local-undo.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("Yjs local undo preserves remote work", {
    path: screenshot,
    contentType: "image/png",
  });
});

test("kitchen sink combines collaboration, history, rendering and offline recording", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4183");
  await expect(
    page.getByRole("heading", { name: "ProseMirror Inspector kitchen sink" }),
  ).toBeVisible();
  const panel = page.getByRole("tabpanel");
  await page.getByRole("tab", { name: "Collaboration", exact: true }).click();
  const version = panel.getByRole("group", { name: "Confirmed version", exact: true });
  const pending = panel.getByRole("group", { name: "Pending steps", exact: true });
  await expect(version).toHaveText("Confirmed version0");
  await expect(pending).toHaveText("Pending steps0");
  await expect(panel.getByText("Raw data", { exact: true })).toBeVisible();
  await expect(panel.getByText("unconfirmedSteps", { exact: true })).not.toBeVisible();
  await page.getByRole("checkbox", { name: "Hold delivery", exact: true }).check();
  const first = page.getByRole("textbox", { name: "Official collab editor A", exact: true });
  const second = page.getByRole("textbox", { name: "Official collab editor B", exact: true });
  const initial = await first.innerText();
  await page.getByRole("button", { name: "Insert sample in A", exact: true }).click();
  await expect(first).not.toHaveText(initial);
  await expect(second).toHaveText(initial);
  await expect(pending).toHaveText("Pending steps1");
  const edited = await first.innerText();

  const { editors } = object(await callTool(page, "prosemirror_editors"));
  if (!Array.isArray(editors)) throw new Error("Expected both kitchen sink editors.");
  const editor = editors.find(
    (entry: unknown) => object(object(entry).target).editorId === "official-A",
  );
  const target = object(object(editor).target);
  const history = available(
    await callTool(page, "prosemirror_inspect", {
      target,
      query: { kind: "contribution", id: "prosemirror-history" },
    }),
  );
  expect(history.value).toMatchObject({ depths: { undoDepth: 1, redoDepth: 0 } });
  const read = async (query: Record<string, string>) =>
    available(await callTool(page, "prosemirror_read", { point: history.point, query })).value;
  expect(await read({ kind: "contribution", id: "prosemirror-collab" })).toMatchObject({
    state: { version: 0, unconfirmedSteps: 1 },
  });
  expect(await read({ kind: "events", name: "Insert sample" })).toMatchObject([
    { kind: "command", name: "Insert sample" },
  ]);
  expect(await read({ kind: "decorations" })).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ranges: expect.arrayContaining(
          ["inline", "node", "widget"].map((kind) => expect.objectContaining({ kind })),
        ),
      }),
    ]),
  );
  expect(await read({ kind: "nodeViews" })).toEqual(
    expect.arrayContaining([expect.objectContaining({ nodeType: "paragraph", destroyed: false })]),
  );

  const deliver = page.getByRole("button", { name: "Deliver queued updates", exact: true });
  await deliver.click();
  await expect(second).toHaveText(edited);
  await expect(version).toHaveText("Confirmed version1");
  await expect(pending).toHaveText("Pending steps0");
  await page.getByRole("button", { name: "Undo in A", exact: true }).click();
  await deliver.click();
  await expect(second).toHaveText(initial);
  await page.getByRole("button", { name: "Redo in A", exact: true }).click();
  await deliver.click();
  await expect(second).toHaveText(edited);

  await page
    .getByRole("combobox", { name: "Recording export editor", exact: true })
    .selectOption("official-A");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export diagnostic recording", exact: true }).click();
  const path = testInfo.outputPath("kitchen-sink-recording.json");
  await (await download).saveAs(path);
  const recording = object(JSON.parse(await readFile(path, "utf8")));
  expect(recording).toMatchObject({
    format: "prosemirror-inspector-recording",
    origin: { target },
  });
  expect(Array.isArray(recording.dispatches) && recording.dispatches.length > 0).toBe(true);
  await page.getByRole("button", { name: "Open exported recording", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "ProseMirror recording inspector", exact: true }),
  ).toContainText("Offline source");
  await expect(first).toHaveText(edited);
  await expect(second).toHaveText(edited);
  expect(errors).toEqual([]);
});

test("V7 collaboration production build keeps both systems functional without diagnostics", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4283");
  await page.getByRole("checkbox", { name: "Hold delivery", exact: true }).check();
  for (const system of ["official", "yjs"]) {
    await page
      .getByRole("combobox", { name: "Collaboration system", exact: true })
      .selectOption(system);
    await expect(
      page.getByText("Diagnostics are disabled in this production build.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(callTool(page, "prosemirror_catalog")).rejects.toThrow(
      "No opted-in ProseMirror discovery bridge responded.",
    );
    const prefix = system === "official" ? "Official collab editor" : "Tiptap Yjs editor";
    const first = page.getByRole("textbox", { name: `${prefix} A`, exact: true });
    const second = page.getByRole("textbox", { name: `${prefix} B`, exact: true });
    await first.click();
    await first.press("End");
    await first.press("X");
    await page.getByRole("button", { name: "Deliver queued updates", exact: true }).click();
    await expect(second).toHaveText(await first.innerText());
  }
  expect(errors).toEqual([]);
});
