import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import type { RegisteredProseMirrorInstance } from "../src/core";
import { StateView } from "../src/panel/features/state/state-view";
import { createTestState, createTestView } from "./helpers";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const originalActEnvironment = reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT;

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

async function renderStateView(text: string, from = 1, to = from) {
  const initialState = createTestState(text);
  const state = initialState.apply(
    initialState.tr.setSelection(TextSelection.create(initialState.doc, from, to)),
  );
  const view = createTestView(state);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<StateView instance={createInstance(view)} />);
  });

  return { container, root, view };
}

async function cleanup(root: Root, view: RegisteredProseMirrorInstance["view"]) {
  await act(async () => root.unmount());
  view.destroy();
}

afterEach(() => {
  if (originalActEnvironment === undefined) {
    delete reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT;
  } else {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
  document.body.replaceChildren();
});

describe("State panel", () => {
  it("keeps text previews on inline nodes and shows open/close ranges", async () => {
    const { container, root, view } = await renderStateView("hello");

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
      await cleanup(root, view);
    }
  });

  it("switches between structure and JSON in the document pane", async () => {
    const { container, root, view } = await renderStateView("hello");

    try {
      expect(container.querySelector('[data-node-type="doc"]')).not.toBeNull();
      expect(container.querySelector(".pm-document-json")).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Show document JSON"]')?.click();
      });

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

      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('[aria-label="Show document structure"]')
          ?.click();
      });
      expect(container.querySelector('[data-node-type="doc"]')).not.toBeNull();
    } finally {
      await cleanup(root, view);
    }
  });

  it("marks fully and partially selected node rows", async () => {
    const { container, root, view } = await renderStateView("hello", 1, 6);

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
      await cleanup(root, view);
    }
  });

  it("selects an entire node only from its dedicated action", async () => {
    const { container, root, view } = await renderStateView("hello");

    try {
      const paragraphRow = container.querySelector<HTMLElement>('[data-node-type="paragraph"]');
      const inspectButton = paragraphRow?.querySelector<HTMLButtonElement>(".pm-doc-row-main");
      const selectButton = paragraphRow?.querySelector<HTMLButtonElement>(
        '[aria-label="Select paragraph node in the editor"]',
      );

      await act(async () => inspectButton?.click());
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.empty).toBe(true);

      await act(async () => selectButton?.click());
      expect(view.state.selection).toBeInstanceOf(NodeSelection);
      expect(view.state.selection.from).toBe(0);
      expect(view.state.selection.to).toBe(7);
    } finally {
      await cleanup(root, view);
    }
  });
});
