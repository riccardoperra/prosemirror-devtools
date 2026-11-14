import { createHistoryInspector } from "prosemirror-inspector/inspectors/history";
import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
import { Node } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createProseMirrorDevtoolsStore } from "prosemirror-inspector/core";
import { ProseMirrorDevtoolsPanel } from "prosemirror-inspector/react";
import { resumeTiptapDevtools, suspendTiptapDevtools } from "prosemirror-inspector/tiptap";
import "prosemirror-inspector/styles.css";
import "./style.css";
import { devtoolsEnabled } from "./env";
import { createTiptapDevtools } from "./tiptap-devtools";

const store = createProseMirrorDevtoolsStore();
const disposeBridge = devtoolsEnabled
  ? installProseMirrorChromeBridge(createProseMirrorInspectionClient({ store }))
  : null;
const disposeWebMCP = devtoolsEnabled
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
    ...(devtoolsEnabled
      ? [
          createTiptapDevtools({
            id: "native-tiptap",
            label: "Tiptap list fixture",
            store,
            instrumentPlugins,
            performanceMarks: false,
            diagnostics: true,
            inspectors: [createHistoryInspector()],
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
    if (!editor || !devtoolsEnabled) return;
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
        {devtoolsEnabled
          ? instrumentPlugins
            ? "Generated plugins are instrumented. Plugins added later with registerPlugin are outside hook coverage."
            : "Only native dispatches are recorded. Plugin hooks are outside coverage."
          : "Diagnostics are disabled in this production build."}
      </p>
      <NativeTiptap
        key={`${generation}-${instrumentPlugins}`}
        instrumentPlugins={instrumentPlugins}
      />
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
