import { baseKeymap, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Schema, type MarkType, type NodeType } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, wrapInList } from "prosemirror-schema-list";
import {
  AllSelection,
  EditorState,
  Plugin,
  PluginKey,
  type Command,
  type Transaction,
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  attachProseMirrorDevtools,
  instrumentProseMirrorPlugins,
  prosemirrorDevtoolsStore,
  type DevtoolsExtension,
  type RegisteredProseMirrorInstance,
} from "prosemirror-devtools";

const editorSchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
  marks: basicSchema.spec.marks,
});

function nodeType(name: string): NodeType {
  const type = editorSchema.nodes[name];
  if (!type) throw new Error(`The demo schema is missing the "${name}" node`);
  return type;
}

function markType(name: string): MarkType {
  const type = editorSchema.marks[name];
  if (!type) throw new Error(`The demo schema is missing the "${name}" mark`);
  return type;
}

const nodes = {
  blockquote: nodeType("blockquote"),
  bulletList: nodeType("bullet_list"),
  heading: nodeType("heading"),
  orderedList: nodeType("ordered_list"),
  paragraph: nodeType("paragraph"),
};
const marks = { em: markType("em"), strong: markType("strong") };

type EditorStats = { characters: number; words: number; selection: string; transactions: number };

function initialDocument() {
  return editorSchema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Editor playground" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Edit this document to inspect state, plugins, " },
          { type: "text", marks: [{ type: "strong" }], text: "transactions" },
          { type: "text", text: ", and timings." },
        ],
      },
      {
        type: "bullet_list",
        content: ["Formatting and history", "Word count and slow-apply plugins"].map((text) => ({
          type: "list_item",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        })),
      },
    ],
  });
}

function statsFor(state: EditorState, transactions: number): EditorStats {
  const text = state.doc.textBetween(0, state.doc.content.size, " ").trim();
  const { from, to } = state.selection;
  return {
    characters: text.length,
    words: text.length === 0 ? 0 : text.split(/\s+/u).length,
    selection: from === to ? String(from) : `${from}–${to}`,
    transactions,
  };
}

function spinFor(milliseconds: number): void {
  const start = performance.now();
  let checksum = 0;
  while (performance.now() - start < milliseconds) checksum = (checksum * 31 + 17) % 65_521;
  void checksum;
}

function disposeRegistration(registration: unknown): void {
  if (typeof registration === "function") return registration();
  if (!registration || typeof registration !== "object") return;
  for (const method of ["detach", "dispose", "destroy", "unregister"] as const) {
    const candidate = Reflect.get(registration, method);
    if (typeof candidate === "function") {
      candidate.call(registration);
      return;
    }
  }
}

export interface DemoEditorController {
  destroy(): void;
  setLatencyEnabled(enabled: boolean): void;
}

export function mountDemoEditor(
  container: HTMLElement,
  options: {
    instanceId: string;
    label: string;
    latencyEnabled?: boolean;
    customDispatch?: boolean;
  },
): DemoEditorController {
  const latency = { current: options.latencyEnabled ?? false };
  container.innerHTML = `
    <article class="editor-card">
      <div class="editor-toolbar" role="toolbar" aria-label="${options.label} formatting">
        <div class="editor-toolbar__group"><button data-command="paragraph">P</button><button data-command="heading">H2</button></div>
        <div class="editor-toolbar__divider"></div>
        <div class="editor-toolbar__group"><button data-command="bold" title="Bold (⌘B)">B</button><button data-command="italic" title="Italic (⌘I)">I</button></div>
        <div class="editor-toolbar__divider"></div>
        <div class="editor-toolbar__group"><button data-command="bullet">• List</button><button data-command="ordered">1. List</button><button data-command="quote">Quote</button></div>
        <div class="editor-toolbar__spacer"></div>
        <div class="editor-toolbar__group"><button data-command="undo" title="Undo (⌘Z)">↶</button><button data-command="redo" title="Redo (⇧⌘Z)">↷</button></div>
      </div>
      <div class="editor-surface"></div>
      <footer class="editor-card__footer" aria-label="Editor statistics">
        <span><strong data-stat="words">0</strong> words</span><span><strong data-stat="characters">0</strong> chars</span>
        <span>selection <strong data-stat="selection">1</strong></span><span class="editor-card__transaction-count"><strong data-stat="transactions">0</strong> tx</span>
      </footer>
    </article>`;

  const surface = container.querySelector<HTMLElement>(".editor-surface");
  if (!surface) throw new Error("Unable to create the demo editor surface");
  let view: EditorView;
  const renderStats = (stats: EditorStats) => {
    for (const [key, value] of Object.entries(stats)) {
      const target = container.querySelector<HTMLElement>(`[data-stat="${key}"]`);
      if (target) target.textContent = String(value);
    }
    updateButtons();
  };
  const statsKey = new PluginKey<EditorStats>(`demo-word-count-${options.instanceId}`);
  const slowPlugin = new Plugin({
    key: new PluginKey(`demo-latency-${options.instanceId}`),
    state: {
      init: () => ({ transactions: 0 }),
      apply: (_transaction, value: { transactions: number }) => {
        if (latency.current) spinFor(5.5 + (value.transactions % 4) * 0.7);
        return { transactions: value.transactions + 1 };
      },
    },
  });
  const statsPlugin = new Plugin<EditorStats>({
    key: statsKey,
    state: {
      init: (_config, state) => statsFor(state, 0),
      apply: (_transaction, value, _oldState, state) => statsFor(state, value.transactions + 1),
    },
    view: () => ({
      update: (editor) => renderStats(statsKey.getState(editor.state) ?? statsFor(editor.state, 0)),
    }),
  });
  const commands: Record<string, Command> = {
    paragraph: setBlockType(nodes.paragraph),
    heading: setBlockType(nodes.heading, { level: 2 }),
    bold: toggleMark(marks.strong),
    italic: toggleMark(marks.em),
    bullet: wrapInList(nodes.bulletList),
    ordered: wrapInList(nodes.orderedList),
    quote: wrapIn(nodes.blockquote),
    undo,
    redo,
  };
  const plugins = instrumentProseMirrorPlugins(
    [
      history(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-Shift-z": redo,
        "Mod-b": commands.bold!,
        "Mod-i": commands.italic!,
      }),
      keymap(baseKeymap),
      slowPlugin,
      statsPlugin,
    ],
    { instanceId: options.instanceId, store: prosemirrorDevtoolsStore },
  );
  view = new EditorView(surface, {
    state: EditorState.create({ schema: editorSchema, doc: initialDocument(), plugins }),
    ...(options.customDispatch
      ? {
          dispatchTransaction(this: EditorView, transaction: Transaction) {
            this.updateState(this.state.applyTransaction(transaction).state);
          },
        }
      : {}),
    attributes: {
      "aria-label": `${options.label} rich text editor`,
      "aria-multiline": "true",
      "data-editor-instance": options.instanceId,
      role: "textbox",
      spellcheck: "true",
    },
  });

  function updateButtons(): void {
    for (const button of container.querySelectorAll<HTMLButtonElement>("[data-command]")) {
      const name = button.dataset.command;
      const command = name ? commands[name] : undefined;
      if (!command) continue;
      button.className = "editor-toolbar__button";
      button.disabled = !command(view.state);
      const { $from } = view.state.selection;
      const active =
        (name === "paragraph" && $from.parent.type === nodes.paragraph) ||
        (name === "heading" &&
          $from.parent.type === nodes.heading &&
          $from.parent.attrs.level === 2) ||
        (name === "bold" &&
          marks.strong.isInSet(view.state.storedMarks ?? $from.marks()) !== undefined) ||
        (name === "italic" &&
          marks.em.isInSet(view.state.storedMarks ?? $from.marks()) !== undefined);
      button.setAttribute("aria-pressed", String(active));
    }
  }
  const onMouseDown = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-command]");
    if (!button) return;
    event.preventDefault();
    const command = commands[button.dataset.command ?? ""];
    if (command?.(view.state, view.dispatch, view)) view.focus();
  };
  container.addEventListener("mousedown", onMouseDown);
  const registration = attachProseMirrorDevtools({
    id: options.instanceId,
    label: options.label,
    view,
    store: prosemirrorDevtoolsStore,
    performanceExtension: true,
  });
  renderStats(statsFor(view.state, 0));

  return {
    setLatencyEnabled: (enabled) => {
      latency.current = enabled;
    },
    destroy: () => {
      container.removeEventListener("mousedown", onMouseDown);
      disposeRegistration(registration);
      view.destroy();
      container.replaceChildren();
    },
  };
}

function documentStats(instance: RegisteredProseMirrorInstance | undefined) {
  if (!instance) return { characters: 0, words: 0 };
  const text = instance.view.state.doc
    .textBetween(0, instance.view.state.doc.content.size, " ")
    .trim();
  return { characters: text.length, words: text.length === 0 ? 0 : text.split(/\s+/u).length };
}

export function createPlaygroundExtension(framework: string): DevtoolsExtension {
  return {
    id: `${framework.toLowerCase()}-playground-example`,
    panels: [
      {
        id: "playground-integration",
        title: "Integration",
        order: 60,
        requiresInstance: false,
        mount(container, context) {
          let latest = "Waiting for a batch";
          const render = () => {
            const instance = context.data.activeInstance();
            const instances = context.data.instanceDescriptors();
            const stats = documentStats(instance);
            const selection = instance
              ? instance.view.state.selection.from === instance.view.state.selection.to
                ? `Cursor at ${instance.view.state.selection.from}`
                : `${instance.view.state.selection.from}–${instance.view.state.selection.to}`
              : "No active editor";
            container.innerHTML = `
            <section class="playground-extension" data-density="${context.host.density}" data-theme="${context.host.theme}">
              <header class="playground-extension__command-bar"><div class="playground-extension__identity"><span class="playground-extension__status" data-connected="${Boolean(instance)}"><span></span>${instance ? "Live" : "Offline"}</span><span class="playground-extension__identity-copy"><small>${framework} extension</small><strong>Editor bridge</strong></span></div>
              <div class="playground-extension__actions" role="toolbar"><button data-action="focus" ${instance ? "" : "disabled"}>Focus</button><button data-action="select" ${instance ? "" : "disabled"}>Select all</button><button data-action="history" ${instance ? "" : "disabled"}>History</button><button data-action="clear" data-tone="danger" ${instance?.transactions.length ? "" : "disabled"}>Clear</button></div></header>
              <div class="playground-extension__metrics"><div><span>Editor</span><strong>${instance?.label ?? "None"}</strong><small>${instance?.id ?? `${instances.length} registered`}</small></div><div><span>Doc</span><strong>${stats.words} words</strong><small>${stats.characters} chars</small></div><div><span>Selection</span><strong>${selection}</strong><small>${instance?.view.state.selection.constructor.name ?? "—"}</small></div><div><span>History</span><strong>${instance?.transactions.length ?? 0} retained</strong><small>${instance ? `${instance.dispatchCount} observed` : "unbounded"}</small></div></div>
              <div class="playground-extension__rows"><div class="playground-extension__row"><span class="playground-extension__row-label"><strong>Dispatch stream</strong><small>subscribeDispatch</small></span><span class="playground-extension__row-value"><strong>${latest}</strong><small>Edit the document to inspect live transaction data.</small></span><code>${instance ? `${instance.view.state.doc.content.size} positions` : "state —"}</code></div><div class="playground-extension__row"><span class="playground-extension__row-label"><strong>Host context</strong><small>framework-neutral</small></span><dl class="playground-extension__host-values"><div><dt>Theme</dt><dd>${context.host.theme}</dd></div><div><dt>Density</dt><dd>${context.host.density}</dd></div><div><dt>Panel</dt><dd>${context.host.activePanelId}</dd></div><div><dt>Editors</dt><dd>${instances.length}</dd></div></dl><code>${context.host.signal.aborted ? "disposed" : "mounted"}</code></div></div>
            </section>`;
          };
          const unsubscribeActive = context.data.activeInstance.subscribe(render);
          const unsubscribeInstances = context.data.instanceDescriptors.subscribe(render);
          const unsubscribeDispatch = context.data.subscribeDispatch((events) => {
            const activeId = context.data.activeInstance()?.id;
            const event = [...events].reverse().find((item) => item.instanceId === activeId);
            if (event)
              latest = `#${event.record.id} · ${event.record.stepCount} steps · ${event.record.totalDuration.toFixed(2)} ms`;
            render();
          });
          const onClick = (event: Event) => {
            const action = (event.target as Element).closest<HTMLButtonElement>("[data-action]")
              ?.dataset.action;
            const instance = context.data.activeInstance();
            if (action === "focus") instance?.view.focus();
            if (action === "select" && instance) {
              instance.view.dispatch(
                instance.view.state.tr.setSelection(new AllSelection(instance.view.state.doc)),
              );
              instance.view.focus();
            }
            if (action === "history") context.host.selectPanel("history");
            if (action === "clear" && instance) context.actions.clearTransactions(instance.id);
          };
          container.addEventListener("click", onClick);
          render();
          return () => {
            unsubscribeActive();
            unsubscribeInstances();
            unsubscribeDispatch();
            container.removeEventListener("click", onClick);
          };
        },
      },
    ],
  };
}
