import { writeFile } from "node:fs/promises";
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
  await page.getByRole("button", { name: "Undo in A", exact: true }).click();
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
