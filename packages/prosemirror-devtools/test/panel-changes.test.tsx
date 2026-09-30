import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";

import { attachProseMirrorDevtools, createProseMirrorDevtoolsStore } from "../src/core";
import { ProseMirrorDevtoolsPanel } from "../src/panel/panel";
import { ChangesView } from "../src/panel/features/changes/changes-view";
import { createTestState, createTestView } from "./helpers";

afterEach(() => document.body.replaceChildren());

it("shows step changes and updates the position probe's association in History", () => {
  const store = createProseMirrorDevtoolsStore();
  const view = createTestView(createTestState("hello"));
  const attachment = attachProseMirrorDevtools({
    id: "editor",
    store,
    view,
    performanceMarks: false,
  });
  view.dispatch(view.state.tr.insertText("XYZ", 2));
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(
    () => <ProseMirrorDevtoolsPanel store={store} defaultPanel="history" />,
    container,
  );
  try {
    Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Changes & mapping")!
      .click();
    const input = container.querySelector<HTMLInputElement>(
      '[aria-label="Position before dispatch"]',
    )!;
    input.value = "2";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(container.querySelector('[role="status"]')?.textContent).toContain("2 → 5");
    const association = container.querySelector<HTMLSelectElement>(
      '[aria-label="Position association"]',
    )!;
    association.value = "-1";
    association.dispatchEvent(new Event("change", { bubbles: true }));
    expect(container.querySelector('[role="status"]')?.textContent).toContain("2 → 2");
    expect(container.textContent).toContain("XYZ");
    expect(
      container.querySelector('[aria-label="Changed ranges in selected step"]'),
    ).not.toBeNull();
  } finally {
    dispose();
    attachment.detach();
    view.destroy();
  }
});

it("does not inspect submitted step documents when application was unobserved", () => {
  const store = createProseMirrorDevtoolsStore();
  const view = createTestView(createTestState("hello"));
  const attachment = attachProseMirrorDevtools({
    id: "editor",
    store,
    view,
    performanceMarks: false,
  });
  view.dispatch(view.state.tr.insertText("XYZ", 2));
  const record = store.getInstance("editor")!.transactions[0]!;
  const readChange = vi.spyOn(record.transactions[0]!.stepDetails![0]!, "change", "get");
  const container = document.createElement("div");
  const dispose = render(
    () => <ChangesView record={{ ...record, applicationStatus: "unknown" }} />,
    container,
  );
  try {
    expect(container.textContent).toContain("Applied steps were not observed");
    expect(readChange).not.toHaveBeenCalled();
  } finally {
    dispose();
    attachment.detach();
    view.destroy();
    readChange.mockRestore();
  }
});
