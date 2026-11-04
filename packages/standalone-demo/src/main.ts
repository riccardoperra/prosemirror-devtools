import { installProseMirrorChromeBridge } from "prosemirror-inspector/agent";
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
import { baseKeymap } from "prosemirror-commands";
import { history, redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, splitListItem } from "prosemirror-schema-list";
import { EditorState, TextSelection, type Command } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
} from "prosemirror-inspector/core";
import { createHistoryInspector } from "prosemirror-inspector/inspectors/history";
import { mountProseMirrorDevtools } from "prosemirror-inspector/standalone";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-inspector/styles.css";
import "./style.css";
import { mountComparisonControls } from "./comparison-ui";
import { mountRecordingControls } from "./recording-ui";

const schema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
  marks: basicSchema.spec.marks,
});
const listItem = schema.nodes.list_item;
if (!listItem) throw new Error("The fixture requires list_item");
const splitItem = splitListItem(listItem);
const store = createProseMirrorDevtoolsStore();
const inspectionClient = import.meta.env.DEV ? createProseMirrorInspectionClient({ store }) : null;
const disposeBridge = inspectionClient ? installProseMirrorChromeBridge(inspectionClient) : null;
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing application container");
app.innerHTML = `<main>
  <h1>Standalone ProseMirror Inspector</h1>
  <p>Press Enter at the end of Alpha to create a second empty list item and move the caret to position 12. Undo restores the original list and caret at position 8.</p>
  <div class="toolbar">
    <button id="focus">Focus editor</button><button id="undo">Undo</button><button id="redo">Redo</button><button id="reset">Reset fixture</button>
    <label>Capture profile <select id="profile"><option value="instrumented">Instrument before state</option><option value="attach">Attach only</option></select></label>
  </div>
  <p id="coverage"></p><div id="editor" class="editor"></div>
  <output id="status" aria-live="polite"></output>
  <details><summary>Current document and selection</summary><pre id="state"></pre></details>
  <div id="inspector" class="inspector" aria-label="ProseMirror Inspector"></div>
</main>`;
function element<T extends HTMLElement>(selector: string, type: { new (): T }): T {
  const found = app?.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing ${selector}`);
  return found;
}
const editorContainer = element("#editor", HTMLDivElement);
const inspectorContainer = element("#inspector", HTMLDivElement);
const status = element("#status", HTMLOutputElement);
const stateOutput = element("#state", HTMLPreElement);
const coverage = element("#coverage", HTMLParagraphElement);
const profile = element("#profile", HTMLSelectElement);
const undoButton = element("#undo", HTMLButtonElement);
const redoButton = element("#redo", HTMLButtonElement);
let disposeEditor = () => {};
let runCommand: (name: string, command: Command) => void = () => {};
let focusEditor = () => {};

function reset(): void {
  disposeEditor();
  const historyPlugin = history();
  const session = import.meta.env.DEV
    ? createProseMirrorDevtoolsSession({
        id: "standalone-list",
        label: "Standalone list fixture",
        store,
        diagnostics: true,
        performanceMarks: false,
        inspectors: [createHistoryInspector({ plugin: historyPlugin })],
      })
    : null;
  const plugins = [
    historyPlugin,
    keymap({ Enter: splitItem, "Mod-z": undo, "Mod-Shift-z": redo, "Mod-y": redo }),
    keymap(baseKeymap),
  ];
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
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 8),
    plugins:
      session && profile.value === "instrumented" ? session.instrumentPlugins(plugins) : plugins,
  });
  const view = new EditorView(editorContainer, {
    state,
    attributes: { role: "textbox", "aria-label": "Standalone editor", "aria-multiline": "true" },
    dispatchTransaction(transaction) {
      view.updateState(view.state.applyTransaction(transaction).state);
      render();
    },
  });
  session?.attach(view);
  function render(): void {
    const current = view.state;
    status.textContent = `Undo depth ${undoDepth(current)}. Redo depth ${redoDepth(current)}. Caret ${current.selection.anchor}. Dispatches ${store.getInstance("standalone-list")?.dispatchCount ?? 0}.`;
    stateOutput.textContent = JSON.stringify(
      { document: current.doc.toJSON(), selection: current.selection.toJSON() },
      null,
      2,
    );
    undoButton.disabled = !undo(current);
    redoButton.disabled = !redo(current);
  }
  const unsubscribe = store.subscribe(render);
  coverage.textContent = !session
    ? "Diagnostics are disabled in this production build."
    : profile.value === "instrumented"
      ? "Plugins are instrumented before EditorState creation. Input handlers and plugin hooks are observed."
      : "Attach captures dispatches. Existing plugin hooks and input handlers are not instrumented.";
  focusEditor = () => view.focus();
  runCommand = (name, command) => {
    const execute = () => command(view.state, view.dispatch, view);
    if (session?.diagnostics) session.diagnostics.traceCommand(name, execute);
    else execute();
    view.focus();
  };
  render();
  disposeEditor = () => {
    unsubscribe();
    session?.dispose();
    view.destroy();
  };
}
reset();
const panel = import.meta.env.DEV
  ? mountProseMirrorDevtools(inspectorContainer, { store, defaultPanel: "history", theme: "light" })
  : null;
if (!panel) inspectorContainer.hidden = true;
const cleanupRecordings = inspectionClient
  ? mountRecordingControls({ container: app, client: inspectionClient })
  : () => {};
const disposeComparison = import.meta.env.DEV
  ? mountComparisonControls({ container: app, store })
  : () => {};
const clickHandlers = [
  [element("#focus", HTMLButtonElement), () => focusEditor()],
  [undoButton, () => runCommand("Undo", undo)],
  [redoButton, () => runCommand("Redo", redo)],
  [element("#reset", HTMLButtonElement), reset],
] satisfies [HTMLButtonElement, () => void][];
for (const [button, listener] of clickHandlers) button.addEventListener("click", listener);
profile.addEventListener("change", reset);
function dispose(): void {
  window.removeEventListener("pagehide", dispose);
  disposeBridge?.();
  for (const [button, listener] of clickHandlers) button.removeEventListener("click", listener);
  profile.removeEventListener("change", reset);
  cleanupRecordings();
  disposeComparison();
  disposeEditor();
  panel?.unmount();
}
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
