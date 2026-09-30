import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachProseMirrorDevtools, createProseMirrorDevtoolsStore } from "../src/core";
import { DispatchDocuments } from "../src/panel/features/dispatch/dispatch-details";
import { JsonTree } from "../src/panel/json-tree";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("lazy inspection", () => {
  it("does not read collapsed JSON getters and preserves expansion when values update", () => {
    const getter = vi.fn(() => "loaded");
    const [value, setValue] = createSignal({
      get type() {
        return getter();
      },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <JsonTree defaultExpandedDepth={0} value={value()} />, container);
    try {
      expect(getter).not.toHaveBeenCalled();
      container.querySelector<HTMLButtonElement>('[aria-label="Expand value"]')?.click();
      expect(getter).toHaveBeenCalledOnce();
      expect(container.textContent).toContain("loaded");
      setValue({ type: "updated" });
      expect(container.textContent).toContain("updated");
    } finally {
      dispose();
    }
  });

  it("limits wide JSON branches to a page and isolates throwing getters", () => {
    const value = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`item${i}`, i]));
    Object.defineProperty(value, "broken", {
      enumerable: true,
      get() {
        throw new Error("broken getter");
      },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <JsonTree value={value} />, container);
    try {
      expect(container.querySelectorAll(".pm-json-key")).toHaveLength(100);
      expect(container.textContent).toContain("151 remaining");
      container.querySelector<HTMLButtonElement>(".pm-button")?.click();
      expect(container.querySelectorAll(".pm-json-key")).toHaveLength(200);
      container.querySelector<HTMLButtonElement>(".pm-button")?.click();
      expect(container.querySelectorAll(".pm-json-key")).toHaveLength(251);
      expect(container.textContent).toContain("[Unable to read property]");
    } finally {
      dispose();
    }
  });

  it("serializes dispatch documents only when their disclosure is opened", () => {
    const view = createTestView(createTestState("hello"));
    const store = createProseMirrorDevtoolsStore();
    const attachment = attachProseMirrorDevtools({
      id: "editor",
      view,
      store,
      performanceMarks: false,
    });
    view.dispatch(appendTextTransaction(view.state, "!"));
    const record = store.getInstance("editor")!.transactions[0]!;
    const before = vi.spyOn(record, "docBefore", "get");
    const after = vi.spyOn(record, "docAfter", "get");
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <DispatchDocuments record={record} />, container);
    try {
      expect(before).not.toHaveBeenCalled();
      expect(after).not.toHaveBeenCalled();
      const disclosure = container.querySelector("details")!;
      disclosure.open = true;
      disclosure.dispatchEvent(new Event("toggle"));
      expect(before).toHaveBeenCalled();
      expect(after).toHaveBeenCalled();
      expect(container.textContent).toContain("paragraph");
    } finally {
      dispose();
      attachment.detach();
      view.destroy();
    }
  });
});
