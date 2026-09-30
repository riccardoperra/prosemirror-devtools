import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView, type NodeView } from "prosemirror-view";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProseMirrorDevtoolsDiagnostics,
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  instrumentProseMirrorPlugins,
} from "../src/core";
import { createTestState, createTestView } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("opt-in diagnostics", () => {
  it("traces handler and command nesting with dispatches without retaining input payloads", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      store,
      diagnostics: true,
      performanceMarks: false,
    });
    const diagnostics = session.diagnostics!;
    let receiver: unknown;
    const handler = vi.fn(function (this: unknown, view: EditorView) {
      receiver = this;
      return diagnostics.traceCommand("Insert content", () => {
        view.dispatch(view.state.tr.insertText("secret text"));
        return true;
      });
    });
    const original = new Plugin({ props: { handleKeyDown: handler } });
    const [wrapped] = session.instrumentPlugins([original]);
    const view = createTestView(createTestState("", [wrapped!]));
    session.attach(view);
    const listener = vi.fn();
    diagnostics.subscribe(listener);
    const event = new KeyboardEvent("keydown", { key: "s", code: "KeyS", ctrlKey: true });

    expect(wrapped!.props.handleKeyDown?.call(wrapped!, view, event)).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(receiver).toBe(original);
    expect(store.getInstance("editor")?.diagnostics).toBe(diagnostics);
    expect(diagnostics.getSnapshot().events).toMatchObject([
      {
        id: 1,
        parentId: null,
        name: "handleKeyDown",
        kind: "prop",
        handled: true,
        dispatches: [{ instanceId: "editor", id: 1 }],
      },
      {
        id: 2,
        parentId: 1,
        name: "Insert content",
        kind: "command",
        handled: true,
        dispatches: [{ instanceId: "editor", id: 1 }],
      },
    ]);
    expect(diagnostics.getSnapshot().events[0]?.metadata).toMatchObject({
      type: "keydown",
      code: "KeyS",
      ctrlKey: true,
    });
    expect(diagnostics.getSnapshot().events[0]?.metadata).not.toHaveProperty("key");
    expect(JSON.stringify(diagnostics.getSnapshot())).not.toContain("secret text");
    expect(listener).toHaveBeenCalled();
    session.dispose();
    view.destroy();
  });

  it("runs void DOM handlers once and publishes events without a transaction", () => {
    const diagnostics = createProseMirrorDevtoolsDiagnostics();
    const store = createProseMirrorDevtoolsStore();
    const handler = vi.fn(() => undefined);
    const [wrapped] = instrumentProseMirrorPlugins(
      [new Plugin({ props: { handleDOMEvents: { paste: handler } } })],
      { instanceId: "editor", store, diagnostics },
    );
    const listener = vi.fn();
    diagnostics.subscribe(listener);
    const view = { state: createTestState() } as EditorView;

    expect(
      wrapped!.props.handleDOMEvents!.paste!.call(wrapped!, view, {
        type: "paste",
        clipboardData: { text: "private" },
        data: "private",
      } as unknown as ClipboardEvent),
    ).toBeUndefined();
    expect(handler).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    expect(diagnostics.getSnapshot().events[0]).toMatchObject({
      kind: "dom-event",
      name: "paste",
      handled: null,
      metadata: { type: "paste" },
    });
    diagnostics.dispose();
  });

  it("bounds event capture, preserves thrown values, and stops recording after disposal", () => {
    const diagnostics = createProseMirrorDevtoolsDiagnostics({ limit: 2 });
    diagnostics.traceCommand("First", () => false);
    diagnostics.traceCommand("Second", () => true);
    let caught: unknown = "not thrown";
    try {
      diagnostics.traceCommand("Throw", () => {
        throw undefined;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeUndefined();
    expect(
      diagnostics.getSnapshot().events.map(({ id, name, error }) => ({ id, name, error })),
    ).toEqual([
      { id: 2, name: "Second", error: null },
      { id: 3, name: "Throw", error: "undefined" },
    ]);
    diagnostics.clearEvents();
    expect(diagnostics.getSnapshot().events).toEqual([]);
    diagnostics.dispose();
    const run = vi.fn(() => "still works");
    expect(diagnostics.traceCommand("Disabled", run)).toBe("still works");
    expect(run).toHaveBeenCalledOnce();
    expect(diagnostics.getSnapshot().events).toEqual([]);
  });

  it("captures actual decoration results once, normalizes kinds, and detects stale documents", () => {
    const store = createProseMirrorDevtoolsStore();
    const diagnostics = createProseMirrorDevtoolsDiagnostics();
    const state = createTestState("word");
    const dangerous = vi.fn(() => {
      throw new Error("must not execute");
    });
    const spec = Object.defineProperty({ id: "highlight" }, "hidden", {
      enumerable: true,
      get: dangerous,
    });
    const set = DecorationSet.create(state.doc, [
      Decoration.inline(1, 3, { class: "highlight" }, spec),
      Decoration.node(0, state.doc.firstChild!.nodeSize, { class: "paragraph" }),
      Decoration.widget(2, () => document.createElement("span"), { key: "widget" }),
    ]);
    const decorations = vi.fn(() => set);
    const [wrapped] = instrumentProseMirrorPlugins([new Plugin({ props: { decorations } })], {
      instanceId: "editor",
      store,
      diagnostics,
    });
    expect(wrapped!.props.decorations?.call(wrapped!, state)).toBe(set);
    expect(decorations).toHaveBeenCalledOnce();
    const captured = diagnostics.getSnapshot().decorations[0]!;
    expect(captured.stale).toBe(false);
    expect(captured.ranges.map(({ kind }) => kind).sort()).toEqual(["inline", "node", "widget"]);
    expect(dangerous).not.toHaveBeenCalled();

    diagnostics.traceCommand("Unrelated", () => true);
    expect(diagnostics.getSnapshot().decorations[0]).toBe(captured);
    expect(decorations).toHaveBeenCalledOnce();
    const nextState = state.apply(state.tr.insertText("next"));
    const view = createTestView(nextState);
    const session = createProseMirrorDevtoolsSession({ id: "editor", store, diagnostics });
    session.attach(view);
    expect(diagnostics.getSnapshot().decorations[0]?.stale).toBe(true);
    session.dispose();
    view.destroy();
    diagnostics.dispose();
  });

  it("tracks class NodeView lifecycle and positions and supplies missing destroy cleanup", () => {
    const diagnostics = createProseMirrorDevtoolsDiagnostics({ limit: 2 });
    const store = createProseMirrorDevtoolsStore();
    let position = 0;
    class ParagraphView implements NodeView {
      readonly #dom = document.createElement("p");
      get dom() {
        return this.#dom;
      }
      update() {
        return true;
      }
    }
    const instance = new ParagraphView();
    const factory = vi.fn(() => instance);
    const [wrapped] = instrumentProseMirrorPlugins(
      [new Plugin({ props: { nodeViews: { paragraph: factory } } })],
      { instanceId: "editor", store, diagnostics },
    );
    const view = { state: createTestState("word") } as EditorView;
    const node = view.state.doc.firstChild!;
    const result = wrapped!.props.nodeViews!.paragraph!(
      node,
      view,
      () => position,
      [],
      DecorationSet.empty,
    );
    expect(result.dom).toBe(instance.dom);
    expect(factory).toHaveBeenCalledOnce();
    expect(diagnostics.getSnapshot().nodeViews[0]).toMatchObject({
      nodeType: "paragraph",
      position: 0,
      updates: 0,
      destroys: 0,
      destroyed: false,
    });
    position = 7;
    expect(result.update?.(node, [], DecorationSet.empty)).toBe(true);
    expect(diagnostics.getSnapshot().nodeViews[0]).toMatchObject({ position: 7, updates: 1 });
    const current = diagnostics.getSnapshot().nodeViews[0];
    diagnostics.traceCommand("Unrelated", () => true);
    expect(diagnostics.getSnapshot().nodeViews[0]).toBe(current);
    diagnostics.clearNodeViews();
    expect(diagnostics.getSnapshot().nodeViews[0]).toMatchObject({
      position: 7,
      updates: 0,
      destroyed: false,
    });
    result.update?.(node, [], DecorationSet.empty);
    expect(diagnostics.getSnapshot().nodeViews[0]?.updates).toBe(1);
    result.destroy?.();
    expect(diagnostics.getSnapshot().nodeViews[0]).toMatchObject({
      destroyed: true,
      destroys: 1,
      position: null,
    });
    diagnostics.clearNodeViews();
    expect(diagnostics.getSnapshot().nodeViews).toEqual([]);
    diagnostics.dispose();
  });

  it("isolates wrappers by diagnostics identity and disables stale session callbacks", () => {
    const store = createProseMirrorDevtoolsStore();
    const first = createProseMirrorDevtoolsDiagnostics();
    const second = createProseMirrorDevtoolsDiagnostics();
    const original = new Plugin({ props: { handleKeyDown: () => true } });
    const [one] = instrumentProseMirrorPlugins([original], {
      instanceId: "editor",
      store,
      diagnostics: first,
    });
    const [two] = instrumentProseMirrorPlugins([original], {
      instanceId: "editor",
      store,
      diagnostics: second,
    });
    expect(one).not.toBe(two);
    const session = createProseMirrorDevtoolsSession({ id: "session", store, diagnostics: first });
    const [stale] = session.instrumentPlugins([original]);
    session.dispose();
    expect(
      stale!.props.handleKeyDown?.call(
        stale!,
        { state: createTestState() } as EditorView,
        new KeyboardEvent("keydown"),
      ),
    ).toBe(true);
    expect(first.getSnapshot().events).toEqual([]);
    first.traceCommand("Caller-owned", () => true);
    expect(first.getSnapshot().events).toHaveLength(1);
    first.dispose();
    second.dispose();
  });
});
