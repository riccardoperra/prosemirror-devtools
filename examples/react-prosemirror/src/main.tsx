import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useEditorEffect,
  useEditorEventCallback,
} from "@handlewithcare/react-prosemirror";
import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, splitListItem } from "prosemirror-schema-list";
import { EditorState, TextSelection, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { StrictMode, useCallback, useRef, useState, type RefObject } from "react";
import { createRoot } from "react-dom/client";
import { createProseMirrorDevtoolsStore } from "prosemirror-inspector/core";
import {
  createReactProseMirrorDevtools,
  type ReactProseMirrorDevtools,
} from "prosemirror-inspector/react-prosemirror";
import { ProseMirrorDevtoolsPanel } from "prosemirror-inspector/react";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-inspector/styles.css";
import "./style.css";
import { devtoolsEnabled } from "./env";

const store = createProseMirrorDevtoolsStore();
const disposeBridge = devtoolsEnabled
  ? installProseMirrorChromeBridge(createProseMirrorInspectionClient({ store }))
  : null;
const disposeWebMCP = devtoolsEnabled
  ? await installProseMirrorWebMCPBridge(createProseMirrorInspectionClient({ store }))
  : null;
const schema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
  marks: basicSchema.spec.marks,
});
const listItem = schema.nodes.list_item;
if (!listItem) throw new Error("The fixture requires list_item");
const splitItem = splitListItem(listItem);

function initialState(): EditorState {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "bullet_list",
        content: [
          {
            type: "list_item",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha" }] }],
          },
        ],
      },
    ],
  });
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 8),
    plugins: [
      reactKeys(),
      history(),
      keymap({ Enter: splitItem, "Mod-z": undo, "Mod-Shift-z": redo }),
      keymap(baseKeymap),
    ],
  });
}

function Connection({
  recorder,
  getState,
}: {
  recorder: RefObject<ReactProseMirrorDevtools | null>;
  getState: () => EditorState;
}) {
  useEditorEffect(
    (view) => {
      if (!devtoolsEnabled) return;
      const connection = createReactProseMirrorDevtools({
        id: "native-react-prosemirror",
        label: "Controlled React list fixture",
        store,
        view,
        getState,
        performanceMarks: false,
      });
      recorder.current = connection;
      return () => {
        if (recorder.current === connection) recorder.current = null;
        connection.dispose();
      };
    },
    [recorder, getState],
  );
  return null;
}

function Toolbar({ state }: { state: EditorState }) {
  const focus = useEditorEventCallback((view) => view.focus());
  const runUndo = useEditorEventCallback((view) => undo(view.state, view.dispatch, view));
  const runRedo = useEditorEventCallback((view) => redo(view.state, view.dispatch, view));
  return (
    <div className="toolbar">
      <button onClick={focus}>Focus editor</button>
      <button disabled={!undo(state)} onClick={runUndo}>
        Undo
      </button>
      <button disabled={!redo(state)} onClick={runRedo}>
        Redo
      </button>
    </div>
  );
}

function ControlledEditor() {
  const [state, setState] = useState(initialState);
  const model = useRef(state);
  const recorder = useRef<ReactProseMirrorDevtools | null>(null);
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
  return (
    <>
      <ProseMirror state={state} dispatchTransaction={dispatchTransaction}>
        <Connection recorder={recorder} getState={getState} />
        <Toolbar state={state} />
        <div className="editor">
          <ProseMirrorDoc
            role="textbox"
            aria-label="React ProseMirror editor"
            aria-multiline="true"
          />
        </div>
      </ProseMirror>
      <details>
        <summary>Current controlled model and selection</summary>
        <pre>
          {JSON.stringify(
            { document: state.doc.toJSON(), selection: state.selection.toJSON() },
            null,
            2,
          )}
        </pre>
      </details>
    </>
  );
}

function App() {
  const [generation, setGeneration] = useState(0);
  return (
    <main>
      <h1>Controlled React ProseMirror Inspector</h1>
      <p>
        React ProseMirror owns rendering. The application applies each transaction once, updates its
        controlled model, and records that model before React commits the view.
      </p>
      <button onClick={() => setGeneration((value) => value + 1)}>Reset fixture</button>
      <p>
        {devtoolsEnabled
          ? "Native model application is captured. React commits and uninstrumented plugin hooks are outside timing coverage."
          : "Diagnostics are disabled in this production build."}
      </p>
      <ControlledEditor key={generation} />
      {devtoolsEnabled ? (
        <div className="inspector">
          <ProseMirrorDevtoolsPanel store={store} defaultPanel="history" theme="light" />
        </div>
      ) : null}
    </main>
  );
}

const container = document.querySelector("#app");
if (!container) throw new Error("Missing application container");
const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
function dispose(): void {
  window.removeEventListener("pagehide", dispose);
  disposeBridge?.();
  disposeWebMCP?.();
  root.unmount();
}
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
