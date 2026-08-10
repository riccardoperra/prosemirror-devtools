import { useEffect, useRef, useState } from "react";
import { baseKeymap, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Schema, type MarkType, type NodeType } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, wrapInList } from "prosemirror-schema-list";
import { EditorState, Plugin, PluginKey, type Command, type Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  attachProseMirrorDevtools,
  instrumentProseMirrorPlugins,
  prosemirrorDevtoolsStore,
} from "prosemirror-devtools";

const editorSchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
  marks: basicSchema.spec.marks,
});

function requireNodeType(name: string): NodeType {
  const type = editorSchema.nodes[name];
  if (!type) {
    throw new Error(`The demo schema is missing the "${name}" node`);
  }
  return type;
}

function requireMarkType(name: string): MarkType {
  const type = editorSchema.marks[name];
  if (!type) {
    throw new Error(`The demo schema is missing the "${name}" mark`);
  }
  return type;
}

const nodeTypes = {
  blockquote: requireNodeType("blockquote"),
  bulletList: requireNodeType("bullet_list"),
  heading: requireNodeType("heading"),
  orderedList: requireNodeType("ordered_list"),
  paragraph: requireNodeType("paragraph"),
};

const markTypes = {
  em: requireMarkType("em"),
  strong: requireMarkType("strong"),
};

type ProseMirrorEditorProps = {
  customDispatch?: boolean;
  instanceId: string;
  label: string;
  latencyEnabled: boolean;
};

type EditorStats = {
  characters: number;
  words: number;
  selection: string;
  transactions: number;
};

const initialStats: EditorStats = {
  characters: 0,
  words: 0,
  selection: "1",
  transactions: 0,
};

function createInitialDocument() {
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
          {
            type: "text",
            marks: [{ type: "strong" }],
            text: "transactions",
          },
          { type: "text", text: ", and timings." },
        ],
      },
      {
        type: "bullet_list",
        content: [
          {
            type: "list_item",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Formatting and history" }],
              },
            ],
          },
          {
            type: "list_item",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Word count and slow-apply plugins" }],
              },
            ],
          },
        ],
      },
    ],
  });
}

function spinFor(milliseconds: number) {
  const startedAt = performance.now();
  let checksum = 0;

  while (performance.now() - startedAt < milliseconds) {
    checksum = (checksum * 31 + 17) % 65_521;
  }

  return checksum;
}

function createPlugins(
  instanceId: string,
  latencyEnabled: { current: boolean },
  onUpdate: (stats: EditorStats) => void,
) {
  const slowPlugin = new Plugin<{
    enabled: boolean;
    lastDurationMs: number;
    transactions: number;
  }>({
    key: new PluginKey(`demo-latency-${instanceId}`),
    state: {
      init: () => ({ enabled: false, lastDurationMs: 0, transactions: 0 }),
      apply: (_transaction, value) => {
        const enabled = latencyEnabled.current;
        const duration = enabled ? 5.5 + (value.transactions % 4) * 0.7 : 0;

        if (enabled) {
          // The changing duration makes the timing chart easier to read while
          // keeping the demo responsive.
          spinFor(duration);
        }

        return {
          enabled,
          lastDurationMs: duration,
          transactions: value.transactions + 1,
        };
      },
    },
  });

  const statsPluginKey = new PluginKey<EditorStats>(`demo-word-count-${instanceId}`);
  const statsPlugin = new Plugin<EditorStats>({
    key: statsPluginKey,
    state: {
      init: (_config, state) => readEditorStats(state, 0),
      apply: (_transaction, value, _oldState, newState) =>
        readEditorStats(newState, value.transactions + 1),
    },
    view: () => ({
      update: (view) => {
        const stats = statsPluginKey.getState(view.state);
        if (stats) {
          onUpdate(stats);
        }
      },
    }),
  });

  const rawPlugins = [
    history(),
    keymap({
      "Mod-z": undo,
      "Mod-y": redo,
      "Mod-Shift-z": redo,
      "Mod-b": toggleMark(markTypes.strong),
      "Mod-i": toggleMark(markTypes.em),
    }),
    keymap(baseKeymap),
    slowPlugin,
    statsPlugin,
  ];

  return instrumentProseMirrorPlugins(rawPlugins, {
    instanceId,
    store: prosemirrorDevtoolsStore,
  });
}

function readEditorStats(state: EditorState, transactions: number): EditorStats {
  const text = state.doc.textBetween(0, state.doc.content.size, " ").trim();
  const { from, to } = state.selection;

  return {
    characters: text.length,
    words: text.length === 0 ? 0 : text.split(/\s+/u).length,
    selection: from === to ? String(from) : `${from}–${to}`,
    transactions,
  };
}

function disposeRegistration(registration: unknown) {
  if (typeof registration === "function") {
    registration();
    return;
  }

  if (typeof registration !== "object" || registration === null) {
    return;
  }

  for (const method of ["detach", "dispose", "destroy", "unregister"] as const) {
    const candidate = Reflect.get(registration, method);
    if (typeof candidate === "function") {
      candidate.call(registration);
      return;
    }
  }
}

function isMarkActive(view: EditorView, markName: "strong" | "em") {
  const { state } = view;
  const marks = state.storedMarks ?? state.selection.$from.marks();
  return markTypes[markName].isInSet(marks) !== undefined;
}

function isBlockActive(view: EditorView, block: "paragraph" | "heading") {
  const { $from } = view.state.selection;

  if (block === "heading") {
    return $from.parent.type === nodeTypes.heading && $from.parent.attrs.level === 2;
  }

  return $from.parent.type === nodeTypes.paragraph;
}

type ToolbarButtonProps = {
  active?: boolean;
  command: Command;
  disabled?: boolean;
  label: string;
  onRun: (command: Command) => void;
  shortcut?: string;
};

function ToolbarButton({
  active,
  command,
  disabled = false,
  label,
  onRun,
  shortcut,
}: ToolbarButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className="editor-toolbar__button"
      disabled={disabled}
      onClick={() => onRun(command)}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      title={shortcut ? `${label} (${shortcut})` : label}
      type="button"
    >
      {label}
    </button>
  );
}

export function ProseMirrorEditor({
  customDispatch = false,
  instanceId,
  label,
  latencyEnabled,
}: ProseMirrorEditorProps) {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const latencyEnabledRef = useRef(latencyEnabled);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [stats, setStats] = useState<EditorStats>(initialStats);

  latencyEnabledRef.current = latencyEnabled;

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) {
      return;
    }

    const state = EditorState.create({
      schema: editorSchema,
      doc: createInitialDocument(),
      plugins: createPlugins(instanceId, latencyEnabledRef, setStats),
    });

    const view = new EditorView(host, {
      state,
      ...(customDispatch
        ? {
            dispatchTransaction(this: EditorView, transaction: Transaction) {
              const applied = this.state.applyTransaction(transaction);
              this.updateState(applied.state);
            },
          }
        : {}),
      attributes: {
        "aria-label": `${label} rich text editor`,
        "aria-multiline": "true",
        "data-editor-instance": instanceId,
        role: "textbox",
        spellcheck: "true",
      },
    });

    const registration: unknown = attachProseMirrorDevtools({
      id: instanceId,
      label,
      view,
      store: prosemirrorDevtoolsStore,
      performanceExtension: true,
    });

    setEditorView(view);
    setStats(readEditorStats(view.state, 0));

    return () => {
      disposeRegistration(registration);
      view.destroy();
      setEditorView(null);
    };
  }, [customDispatch, instanceId, label]);

  const run = (command: Command) => {
    if (!editorView) {
      return;
    }

    if (command(editorView.state, editorView.dispatch, editorView)) {
      editorView.focus();
    }
  };

  const canRun = (command: Command) => (editorView ? command(editorView.state) : false);

  const paragraph = setBlockType(nodeTypes.paragraph);
  const heading = setBlockType(nodeTypes.heading, { level: 2 });
  const bold = toggleMark(markTypes.strong);
  const italic = toggleMark(markTypes.em);
  const bulletList = wrapInList(nodeTypes.bulletList);
  const orderedList = wrapInList(nodeTypes.orderedList);
  const quote = wrapIn(nodeTypes.blockquote);

  return (
    <article className="editor-card">
      <div className="editor-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        <div className="editor-toolbar__group">
          <ToolbarButton
            active={editorView ? isBlockActive(editorView, "paragraph") : false}
            command={paragraph}
            disabled={!canRun(paragraph)}
            label="P"
            onRun={run}
          />
          <ToolbarButton
            active={editorView ? isBlockActive(editorView, "heading") : false}
            command={heading}
            disabled={!canRun(heading)}
            label="H2"
            onRun={run}
          />
        </div>
        <div className="editor-toolbar__divider" />
        <div className="editor-toolbar__group">
          <ToolbarButton
            active={editorView ? isMarkActive(editorView, "strong") : false}
            command={bold}
            disabled={!canRun(bold)}
            label="B"
            onRun={run}
            shortcut="⌘B"
          />
          <ToolbarButton
            active={editorView ? isMarkActive(editorView, "em") : false}
            command={italic}
            disabled={!canRun(italic)}
            label="I"
            onRun={run}
            shortcut="⌘I"
          />
        </div>
        <div className="editor-toolbar__divider" />
        <div className="editor-toolbar__group">
          <ToolbarButton
            command={bulletList}
            disabled={!canRun(bulletList)}
            label="• List"
            onRun={run}
          />
          <ToolbarButton
            command={orderedList}
            disabled={!canRun(orderedList)}
            label="1. List"
            onRun={run}
          />
          <ToolbarButton command={quote} disabled={!canRun(quote)} label="Quote" onRun={run} />
        </div>
        <div className="editor-toolbar__spacer" />
        <div className="editor-toolbar__group">
          <ToolbarButton
            command={undo}
            disabled={!canRun(undo)}
            label="↶"
            onRun={run}
            shortcut="⌘Z"
          />
          <ToolbarButton
            command={redo}
            disabled={!canRun(redo)}
            label="↷"
            onRun={run}
            shortcut="⇧⌘Z"
          />
        </div>
      </div>

      <div className="editor-surface" ref={editorHostRef} />

      <footer className="editor-card__footer" aria-label="Editor statistics">
        <span>
          <strong>{stats.words}</strong> words
        </span>
        <span>
          <strong>{stats.characters}</strong> chars
        </span>
        <span>
          selection <strong>{stats.selection}</strong>
        </span>
        <span className="editor-card__transaction-count">
          <strong>{stats.transactions}</strong> tx
        </span>
      </footer>
    </article>
  );
}
