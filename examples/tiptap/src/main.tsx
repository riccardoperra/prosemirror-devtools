import { createHistoryInspector } from "prosemirror-inspector/inspectors/history";
import { createTiptapInspector } from "prosemirror-inspector/inspectors/tiptap";
import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import {
  createProseMirrorDevtoolsDiagnostics,
  createProseMirrorInspectionClient,
} from "prosemirror-inspector/core";
import { Extension, Node } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createProseMirrorDevtoolsStore } from "prosemirror-inspector/core";
import { ProseMirrorDevtoolsPanel } from "prosemirror-inspector/react";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
  suspendTiptapDevtools,
  resumeTiptapDevtools,
} from "prosemirror-inspector/tiptap";
import "prosemirror-inspector/styles.css";
import "./style.css";

const store = createProseMirrorDevtoolsStore();
const disposeBridge = import.meta.env.DEV
  ? installProseMirrorChromeBridge(createProseMirrorInspectionClient({ store }))
  : null;
const disposeWebMCP = import.meta.env.DEV
  ? await installProseMirrorWebMCPBridge(createProseMirrorInspectionClient({ store }))
  : null;
const fixture = "<ul><li><p>Alpha</p></li></ul><aside>Callout rendered by a node view</aside>";

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "aside" }],
  renderHTML: () => ["aside", { class: "callout" }, 0],
  addNodeView:
    () =>
    ({ node }) => {
      const dom = document.createElement("aside");
      dom.className = "callout";
      const contentDOM = document.createElement("span");
      dom.append(contentDOM);
      return { dom, contentDOM, update: (next) => next.type === node.type };
    },
});

function NativeTiptap({ instrumentPlugins }: { instrumentPlugins: boolean }) {
  const [extensions] = useState(() => [
    StarterKit.configure({ trailingNode: false }),
    Callout,
    ...(import.meta.env.DEV
      ? [
          Extension.create({
            name: "prosemirrorInspector",
            priority: 10000,
            addStorage: () => ({ diagnostics: createProseMirrorDevtoolsDiagnostics() }),
            onBeforeCreate() {
              setupTiptapDevtools(this.editor, {
                id: "native-tiptap",
                label: "Tiptap list fixture",
                store,
                instrumentPlugins,
                performanceMarks: false,
                diagnostics: this.storage.diagnostics,
                inspectors: [
                  createTiptapInspector({ editor: this.editor }),
                  createHistoryInspector(),
                ],
              });
            },
            onCreate() {
              attachTiptapDevtools(this.editor);
            },
            dispatchTransaction(props) {
              dispatchTiptapTransaction(this.editor, props);
            },
            onDestroy() {
              detachTiptapDevtools(this.editor);
              this.storage.diagnostics.dispose();
            },
          }),
        ]
      : []),
  ]);
  const editor = useEditor({
    extensions,
    content: fixture,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    enableExtensionDispatchTransaction: true,
    editorProps: {
      attributes: { "aria-label": "Tiptap editor", "aria-multiline": "true", role: "textbox" },
    },
  });
  useEffect(() => {
    if (!editor || !import.meta.env.DEV) return;
    resumeTiptapDevtools(editor);
    return () => suspendTiptapDevtools(editor);
  }, [editor]);
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            document: current.getJSON(),
            selection: current.state.selection.toJSON(),
            undo: current.can().undo(),
            redo: current.can().redo(),
          }
        : null,
  });
  return (
    <>
      <div className="toolbar">
        <button disabled={!editor} onClick={() => editor?.view.focus()}>
          Focus editor
        </button>
        <button disabled={!snapshot?.undo} onClick={() => editor?.commands.undo()}>
          Undo
        </button>
        <button disabled={!snapshot?.redo} onClick={() => editor?.commands.redo()}>
          Redo
        </button>
      </div>
      <EditorContent editor={editor} className="editor" />
      <details>
        <summary>Current document and selection</summary>
        <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      </details>
    </>
  );
}

function App() {
  const [generation, setGeneration] = useState(0);
  const [instrumentPlugins, setInstrumentPlugins] = useState(true);
  return (
    <main>
      <h1>Native Tiptap Inspector</h1>
      <p>
        Tiptap owns the EditorView and dispatcher. The inspector records Tiptap's native middleware
        once per application dispatch.
      </p>
      <div className="toolbar">
        <button onClick={() => setGeneration((value) => value + 1)}>Reset fixture</button>
        <label>
          Plugin instrumentation{" "}
          <select
            value={String(instrumentPlugins)}
            onChange={(event) => setInstrumentPlugins(event.target.value === "true")}
          >
            <option value="true">Before state creation</option>
            <option value="false">Dispatch only</option>
          </select>
        </label>
      </div>
      <p>
        {import.meta.env.DEV
          ? instrumentPlugins
            ? "Generated plugins are instrumented. Plugins added later with registerPlugin are outside hook coverage."
            : "Only native dispatches are recorded. Plugin hooks are outside coverage."
          : "Diagnostics are disabled in this production build."}
      </p>
      <NativeTiptap
        key={`${generation}-${instrumentPlugins}`}
        instrumentPlugins={instrumentPlugins}
      />
      {import.meta.env.DEV ? (
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
