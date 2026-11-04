import { EditorState, Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createSnapshot,
  persistSnapshots,
} from "../src/core";
import { ProseMirrorDevtoolsPanel } from "../src/panel/panel";
import { createTestState, createTestView } from "./helpers";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function setup(panel: string) {
  const store = createProseMirrorDevtoolsStore();
  const initial = createTestState("hello");
  const counter = new Plugin({
    key: new PluginKey("counter"),
    state: { init: () => 0, apply: (_transaction, value) => value + 1 },
  });
  let model = EditorState.create({
    schema: initial.schema,
    doc: initial.doc,
    selection: TextSelection.create(initial.doc, 6),
    plugins: [counter],
  });
  const view = createTestView(model);
  const session = createProseMirrorDevtoolsSession({
    id: "controlled",
    label: "Controlled",
    store,
    getState: () => model,
    performanceMarks: false,
  });
  const recorder = session.createDispatchRecorder(view, { getState: () => model });
  persistSnapshots("controlled", [createSnapshot("controlled", view, "Before")]);
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = render(
    () => <ProseMirrorDevtoolsPanel store={store} defaultPanel={panel} />,
    host,
  );
  return {
    host,
    view,
    update() {
      const transaction = model.tr.insertText("!", 6);
      recorder.record(transaction, () => {
        model = model.applyTransaction(transaction).state;
      });
    },
    commit() {
      view.updateState(model);
    },
    cleanup() {
      dispose();
      session.dispose();
      view.destroy();
    },
  };
}

describe("controlled model panel reads", () => {
  it.each(["state", "selection", "schema", "plugins"])(
    "updates %s before the rendered view commits",
    (panel) => {
      const fixture = setup(panel);
      try {
        fixture.update();
        expect(fixture.view.state.doc.textContent).toBe("hello");
        if (panel === "state") {
          expect(fixture.host.textContent).toContain("6 chars");
          expect(fixture.host.querySelector('[data-node-type="text"]')?.textContent).toContain(
            '"hello!"',
          );
        } else if (panel === "selection") {
          expect(
            fixture.host.querySelector('[aria-label="Selection endpoint"]')?.textContent,
          ).toContain("Head 7");
        } else if (panel === "schema") {
          expect(
            fixture.host.querySelector<HTMLInputElement>(
              '[aria-label="Schema inspection position"]',
            )?.value,
          ).toBe("7");
        } else {
          expect(fixture.host.querySelector(".pm-json-number")?.textContent).toBe("1");
        }
      } finally {
        fixture.cleanup();
      }
    },
  );

  it("invalidates restore previews and refuses actions until the view commits", () => {
    const fixture = setup("snapshots");
    const button = (text: string) =>
      Array.from(fixture.host.querySelectorAll<HTMLButtonElement>("button")).find(
        (item) => item.textContent === text,
      );
    try {
      button("Preview restore")?.click();
      expect(button("Restore to Controlled")?.disabled).toBe(false);
      fixture.update();
      expect(button("Restore to Controlled")?.disabled).toBe(true);
      button("Preview restore")?.click();
      expect(fixture.host.textContent).toContain("still rendering the latest change");
      fixture.commit();
      button("Preview restore")?.click();
      expect(button("Restore to Controlled")?.disabled).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
});
