import { NodeSelection, TextSelection } from "prosemirror-state";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import type { RegisteredProseMirrorInstance } from "../src/core";
import { StateView } from "../src/panel/features/state/state-view";
import { JsonTree } from "../src/panel/json-tree";
import { createTestState, createTestView } from "./helpers";

function createInstance(
  view: RegisteredProseMirrorInstance["view"],
): RegisteredProseMirrorInstance {
  return {
    id: "editor",
    label: "Editor",
    view,
    registeredAt: 0,
    updatedAt: 0,
    dispatchCount: 0,
    transactionLimit: 100,
    transactions: [],
    pluginTimings: [],
  };
}

function renderStateView(text: string, from = 1, to = from) {
  const initialState = createTestState(text);
  const state = initialState.apply(
    initialState.tr.setSelection(TextSelection.create(initialState.doc, from, to)),
  );
  const view = createTestView(state);
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(() => <StateView instance={createInstance(view)} />, container);

  return { container, dispose, view };
}

function cleanup(dispose: () => void, view: RegisteredProseMirrorInstance["view"]): void {
  dispose();
  view.destroy();
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("State panel", () => {
  it("keeps text previews on inline nodes and shows open/close ranges", () => {
    const { container, dispose, view } = renderStateView("hello");

    try {
      const docRow = container.querySelector<HTMLElement>('[data-node-type="doc"]');
      const paragraphRow = container.querySelector<HTMLElement>('[data-node-type="paragraph"]');
      const textRow = container.querySelector<HTMLElement>('[data-node-type="text"]');

      expect(docRow?.querySelector(".pm-node-text")).toBeNull();
      expect(paragraphRow?.querySelector(".pm-node-text")).toBeNull();
      expect(textRow?.querySelector(".pm-node-text")?.textContent).toBe('"hello"');
      expect(
        paragraphRow?.querySelector('[aria-label="Open position 0, close position 7"]'),
      ).not.toBeNull();
      expect(
        textRow?.querySelector('[aria-label="Open position 1, close position 6"]'),
      ).not.toBeNull();
    } finally {
      cleanup(dispose, view);
    }
  });

  it("switches between structure and JSON in the document pane", () => {
    const { container, dispose, view } = renderStateView("hello");

    try {
      expect(container.querySelector('[data-node-type="doc"]')).not.toBeNull();
      expect(container.querySelector(".pm-document-json")).toBeNull();

      container.querySelector<HTMLButtonElement>('[aria-label="Show document JSON"]')?.click();

      expect(container.querySelector('[data-node-type="doc"]')).toBeNull();
      expect(container.querySelector(".pm-document-json .pm-json")?.textContent).toContain('"doc"');
      expect(container.querySelector(".pm-document-json .pm-json")?.textContent).toContain(
        "paragraph",
      );
      expect(
        Array.from(
          container.querySelectorAll(".pm-section-title"),
          (element) => element.textContent,
        ),
      ).not.toContain("Document JSON");

      container.querySelector<HTMLButtonElement>('[aria-label="Show document structure"]')?.click();
      expect(container.querySelector('[data-node-type="doc"]')).not.toBeNull();
    } finally {
      cleanup(dispose, view);
    }
  });

  it("marks fully and partially selected node rows", () => {
    const { container, dispose, view } = renderStateView("hello", 1, 6);

    try {
      expect(
        container.querySelector('[data-node-type="doc"]')?.getAttribute("data-editor-selection"),
      ).toBe("partial");
      expect(
        container
          .querySelector('[data-node-type="paragraph"]')
          ?.getAttribute("data-editor-selection"),
      ).toBe("full");
      expect(
        container.querySelector('[data-node-type="text"]')?.getAttribute("data-editor-selection"),
      ).toBe("full");
    } finally {
      cleanup(dispose, view);
    }
  });

  it("selects an entire node only from its dedicated action", () => {
    const { container, dispose, view } = renderStateView("hello");

    try {
      const paragraphRow = container.querySelector<HTMLElement>('[data-node-type="paragraph"]');
      const inspectButton = paragraphRow?.querySelector<HTMLButtonElement>(".pm-doc-row-main");
      const selectButton = paragraphRow?.querySelector<HTMLButtonElement>(
        '[aria-label="Select paragraph node in the editor"]',
      );

      inspectButton?.click();
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.empty).toBe(true);

      selectButton?.click();
      expect(view.state.selection).toBeInstanceOf(NodeSelection);
      expect(view.state.selection.from).toBe(0);
      expect(view.state.selection.to).toBe(7);
    } finally {
      cleanup(dispose, view);
    }
  });
});

describe("JsonTree", () => {
  it("renders raw circular values without preprocessing", () => {
    const value: { label: string; self?: unknown } = { label: "root" };
    value.self = value;
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <JsonTree defaultExpandedDepth={2} value={value} />, container);

    expect(container.textContent).toContain("[Circular]");
    dispose();
  });
});
