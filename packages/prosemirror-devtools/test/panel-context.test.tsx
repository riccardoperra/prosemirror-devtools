import { render } from "solid-js/web";
import { Schema } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachProseMirrorDevtools,
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createPluginStateInspector,
  type DevtoolsExtension,
} from "../src/core";
import { ProseMirrorDevtoolsPanel } from "../src/panel/panel";
import { createTestState, createTestView } from "./helpers";

afterEach(() => document.body.replaceChildren());

function tab(host: HTMLElement, title: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((button) =>
    button.textContent?.startsWith(title),
  );
}

describe("host inspection context", () => {
  it("reads historical projections without querying live plugin state and copies an explicit context", () => {
    const store = createProseMirrorDevtoolsStore();
    const counter = new Plugin({ state: { init: () => 0, apply: (_tr, value) => value + 1 } });
    const session = createProseMirrorDevtoolsSession({
      id: "historical",
      store,
      performanceMarks: false,
      inspectors: [
        createPluginStateInspector({ id: "counter", plugin: counter, serialize: (value) => value }),
      ],
    });
    const view = createTestView(createTestState("", session.instrumentPlugins([counter])));
    session.attach(view);
    view.dispatch(view.state.tr.insertText("first"));
    view.dispatch(view.state.tr.insertText("second"));
    const getState = vi.spyOn(counter, "getState");
    const host = document.createElement("div");
    document.body.append(host);
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel store={store} defaultPanel="history" />,
      host,
    );
    try {
      host.querySelector<HTMLButtonElement>('[aria-label="Inspect dispatch #1"]')?.click();
      tab(host, "Plugins")?.click();
      expect(host.querySelector('[aria-label="Historical plugin state"]')?.textContent).toContain(
        "Historical plugin state requires an explicitly registered semantic serializer",
      );
      expect(
        host.querySelector('[aria-label="Captured inspector projections"]')?.textContent,
      ).toContain('"counter"');
      expect(getState).not.toHaveBeenCalled();
      tab(host, "Context")?.click();
      expect(host.querySelector('[aria-label="Installed inspectors"]')?.textContent).toContain(
        "counter",
      );
      expect(host.querySelector('[aria-label="Inspection context"]')?.textContent).toContain(
        "Dispatch #1",
      );
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Copy diagnostic context")
        ?.click();
      const copied =
        host.querySelector<HTMLTextAreaElement>('[aria-label="Diagnostic context JSON"]')?.value ??
        "";
      const context = JSON.parse(copied);
      expect(context.target).toMatchObject({
        editorId: "historical",
        sessionId: session.sessionId,
      });
      expect(context.point).toMatchObject({
        kind: "transaction",
        transactionId: 1,
        phase: "after",
      });
      expect(context.evidence.coverage).toHaveProperty("complete");
      expect(new TextEncoder().encode(copied).length).toBeLessThanOrEqual(16_000);
      tab(host, "Rendering")?.click();
      expect(host.querySelector('[aria-label="Historical decorations"]')?.textContent).toContain(
        "disabled",
      );
      expect(host.querySelector("[data-pm-decoration-overlay]")).toBeNull();
    } finally {
      dispose();
      getState.mockRestore();
      session.dispose();
      view.destroy();
    }
  });

  it("opens exact dispatch evidence from events and keeps calls without dispatches inspectable", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "events",
      store,
      diagnostics: true,
      performanceMarks: false,
    });
    const view = createTestView();
    session.attach(view);
    session.diagnostics?.traceCommand("No change", () => false);
    const host = document.createElement("div");
    document.body.append(host);
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel store={store} defaultPanel="events" />,
      host,
    );
    try {
      expect(host.querySelector('[aria-label="Event and command details"]')?.textContent).toContain(
        "No dispatch observed",
      );
      expect(host.querySelector('[aria-label="Event and command details"]')?.textContent).toContain(
        "unhandled",
      );
      session.diagnostics?.traceCommand("Insert", () => {
        view.dispatch(view.state.tr.insertText("a"));
        return true;
      });
      host
        .querySelector<HTMLButtonElement>('[aria-label="Inspect dispatch #1 in events"]')
        ?.click();
      expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
        "Transactions",
      );
      expect(host.querySelector('[aria-label="Dispatch 1 inspector"]')).not.toBeNull();
      tab(host, "Events")?.click();
      expect(host.querySelector('[data-event-id="2"]')?.getAttribute("aria-pressed")).toBe("true");
    } finally {
      dispose();
      session.dispose();
      view.destroy();
    }
  });

  it("links a selection endpoint to document structure and real schema constraints", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "text*", toDOM: () => ["p", 0] },
        text: {},
      },
      marks: { strong: { toDOM: () => ["strong", 0] } },
    });
    const doc = schema.node(
      "doc",
      null,
      schema.node("paragraph", null, schema.text("hello", [schema.mark("strong")])),
    );
    const view = createTestView(EditorState.create({ schema, doc }));
    const store = createProseMirrorDevtoolsStore();
    const attachment = attachProseMirrorDevtools({
      id: "schema",
      view,
      store,
      performanceMarks: false,
    });
    const host = document.createElement("div");
    document.body.append(host);
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel store={store} defaultPanel="selection" />,
      host,
    );
    try {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Schema at endpoint")
        ?.click();
      expect(
        host.querySelector<HTMLInputElement>('[aria-label="Schema inspection position"]')?.value,
      ).toBe("1");
      const constraints = host.querySelector(
        '[aria-label="Schema constraints at selected position"]',
      );
      expect(constraints?.textContent).toContain("allowedMarks");
      expect(constraints?.textContent).toContain('"strong"');
      expect(constraints?.textContent).toContain('"text"');
      tab(host, "State")?.click();
      expect(host.querySelector('[data-node-type="text"]')?.getAttribute("data-inspected")).toBe(
        "true",
      );
      host.querySelector<HTMLButtonElement>('[aria-label="Show document DOM"]')?.click();
      expect(host.querySelector('[data-dom-role="mark"] .pm-doc-row-main')?.textContent).toBe(
        "<strong>strong 1–6",
      );
    } finally {
      dispose();
      attachment.detach();
      view.destroy();
    }
  });

  it("keeps editor navigation local to each host and its extensions", () => {
    const store = createProseMirrorDevtoolsStore();
    const first = createTestView(createTestState("first"));
    const second = createTestView(createTestState("second"));
    const firstRegistration = store.register({ id: "first", view: first });
    const secondRegistration = store.register({ id: "second", view: second });
    const a = document.createElement("div");
    const b = document.createElement("div");
    document.body.append(a, b);
    const extension: DevtoolsExtension = {
      id: "target",
      panels: [
        {
          id: "target-panel",
          title: "Target",
          mount(element, context) {
            const update = () => {
              element.textContent = context.data.activeInstanceId();
            };
            update();
            return context.data.activeInstanceId.subscribe(update);
          },
        },
      ],
    };
    const disposeA = render(
      () => (
        <ProseMirrorDevtoolsPanel
          store={store}
          extensions={[extension]}
          defaultPanel="target-panel"
        />
      ),
      a,
    );
    const disposeB = render(() => <ProseMirrorDevtoolsPanel store={store} />, b);
    try {
      const select = a.querySelector<HTMLSelectElement>(
        '[aria-label="Active ProseMirror instance"]',
      )!;
      select.value = "second";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(a.querySelector(".pm-extension-panel")?.textContent).toBe("second");
      expect(
        b.querySelector<HTMLSelectElement>('[aria-label="Active ProseMirror instance"]')?.value,
      ).toBe("first");
      expect(store.getActiveInstanceId()).toBe("first");
    } finally {
      disposeA();
      disposeB();
      firstRegistration();
      secondRegistration();
      first.destroy();
      second.destroy();
    }
  });

  it("preserves an exact dispatch across Transactions and Performance until following live", async () => {
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView();
    const attachment = attachProseMirrorDevtools({
      id: "editor",
      view,
      store,
      performanceMarks: false,
    });
    view.dispatch(view.state.tr.insertText("a"));
    view.dispatch(view.state.tr.insertText("b"));
    const host = document.createElement("div");
    document.body.append(host);
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel store={store} defaultPanel="history" />,
      host,
    );
    try {
      expect(tab(host, "Transactions")).toBeDefined();
      host.querySelector<HTMLButtonElement>('[aria-label="Inspect dispatch #1"]')?.click();
      tab(host, "Performance")?.click();
      await vi.waitFor(
        () => expect(host.querySelector('[aria-label="Dispatch 1 inspector"]')).not.toBeNull(),
        { timeout: 10_000 },
      );
      view.dispatch(view.state.tr.insertText("c"));
      expect(host.querySelector('[aria-label="Dispatch 1 inspector"]')).not.toBeNull();
      tab(host, "Transactions")?.click();
      expect(
        host.querySelector('[aria-label="Inspect dispatch #1"]')?.getAttribute("aria-pressed"),
      ).toBe("true");
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Follow live")
        ?.click();
      expect(
        host.querySelector('[aria-label="Inspect dispatch #3"]')?.getAttribute("aria-pressed"),
      ).toBe("true");
    } finally {
      dispose();
      attachment.detach();
      view.destroy();
    }
  });
});
