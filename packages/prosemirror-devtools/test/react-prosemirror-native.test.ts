import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useEditorEffect,
} from "@handlewithcare/react-prosemirror";
import { act, createElement, StrictMode, useCallback, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorState, Plugin, PluginKey, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProseMirrorDevtoolsStore,
  type DevtoolsStore,
  type ProseMirrorDispatchRecorder,
} from "../src/core";
import { createReactProseMirrorDevtools } from "../src/adapters/react-prosemirror";
import { testSchema } from "./helpers";

const applyCount = new PluginKey<number>("native-apply-count");

function NativeEditor({ store }: { store: DevtoolsStore }) {
  const [state, setState] = useState(() =>
    EditorState.create({
      schema: testSchema,
      plugins: [
        reactKeys(),
        new Plugin({
          key: applyCount,
          state: { init: () => 0, apply: (_transaction, count: number) => count + 1 },
        }),
      ],
    }),
  );
  const model = useRef(state);
  const recorder = useRef<ProseMirrorDispatchRecorder | null>(null);
  const getState = useCallback(() => model.current, []);
  const dispatchTransaction = useCallback(function (this: EditorView, transaction: Transaction) {
    const apply = () => {
      const next = this.state.applyTransaction(transaction).state;
      model.current = next;
      setState(next);
    };
    if (recorder.current) recorder.current.record(transaction, apply);
    else apply();
  }, []);
  return createElement(
    ProseMirror,
    { state, dispatchTransaction },
    createElement(Connection, { store, recorder, getState }),
    createElement(ProseMirrorDoc, { "aria-label": "Native React ProseMirror editor" }),
  );
}

function Connection({
  store,
  recorder,
  getState,
}: {
  store: DevtoolsStore;
  recorder: { current: ProseMirrorDispatchRecorder | null };
  getState: () => EditorState;
}) {
  useEditorEffect(
    (view) => {
      const connection = createReactProseMirrorDevtools({
        id: "native-react",
        store,
        view,
        getState,
        performanceMarks: false,
      });
      recorder.current = connection;
      return () => {
        recorder.current = null;
        connection.dispose();
      };
    },
    [store, recorder, getState],
  );
  return null;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("native controlled React ProseMirror", () => {
  it("records the applied model exactly once before React commits the view", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const store = createProseMirrorDevtoolsStore();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(createElement(StrictMode, null, createElement(NativeEditor, { store }))),
      );
      const view = store.getInstance("native-react")?.view;
      expect(view).toBeDefined();
      if (!view) throw new Error("The native editor did not mount");
      await act(async () => view.dispatch(view.state.tr.insertText("x")));
      expect(view.state.doc.textContent).toBe("x");
      expect(container.querySelector("[contenteditable]")?.textContent).toBe("x");
      expect(applyCount.getState(view.state)).toBe(1);
      expect(store.getInstance("native-react")?.transactions).toHaveLength(1);
      expect(store.getInstance("native-react")?.transactions[0]?.applicationStatus).toBe("applied");
      expect(store.getInstance("native-react")?.transactions[0]?.viewUpdateDuration).toBeNull();
      expect(store.getInstance("native-react")?.transactions[0]?.docAfter).toEqual({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
      });
    } finally {
      await act(async () => root.unmount());
    }
    expect(store.getSnapshot().instances).toEqual([]);
  });

  it("recreates a controlled editor without reusing its session or applying twice", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const store = createProseMirrorDevtoolsStore();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          createElement(StrictMode, null, createElement(NativeEditor, { key: 1, store })),
        ),
      );
      const first = store.getInstance("native-react")?.view;
      if (!first) throw new Error("The native editor did not mount");
      await act(async () => first.dispatch(first.state.tr.insertText("first")));
      const previousSession = store.getInstance("native-react")?.transactions[0]?.sessionId;
      await act(async () =>
        root.render(
          createElement(StrictMode, null, createElement(NativeEditor, { key: 2, store })),
        ),
      );
      const second = store.getInstance("native-react")?.view;
      if (!second) throw new Error("The native editor did not remount");
      expect(first.isDestroyed).toBe(true);
      expect(second).not.toBe(first);
      expect(store.getSnapshot().instances).toHaveLength(1);
      await act(async () => second.dispatch(second.state.tr.insertText("second")));
      expect(second.state.doc.textContent).toBe("second");
      expect(applyCount.getState(second.state)).toBe(1);
      expect(store.getInstance("native-react")?.transactions).toHaveLength(1);
      expect(store.getInstance("native-react")?.transactions[0]?.sessionId).not.toBe(
        previousSession,
      );
    } finally {
      await act(async () => root.unmount());
    }
    expect(store.getSnapshot().instances).toEqual([]);
  });
});
