import { createSignal } from "solid-js";
import { TanStackDevtools } from "@tanstack/solid-devtools";
import { createPlaygroundExtension } from "@prosemirror-devtools/demo-kit";
import { prosemirrorDevtoolsStore } from "prosemirror-inspector";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/solid";
import { ProseMirrorEditor } from "./ProseMirrorEditor";

const plugin = createProseMirrorDevtoolsPlugin({
  defaultPanel: "playground-integration",
  extensions: [createPlaygroundExtension("Solid")],
  store: prosemirrorDevtoolsStore,
});

export function App() {
  const [latencyEnabled, setLatencyEnabled] = createSignal(false);

  return (
    <main class="playground">
      <header class="playground-header">
        <h1>ProseMirror + Solid playground</h1>
        <span class="devtools-shortcut">
          Devtools <kbd>⌘⇧D</kbd>
        </span>
      </header>
      <section class="editor-workspace" aria-label="ProseMirror editor playground">
        <div class="plugin-bar">
          <div class="plugin-list">
            <span>plugins:</span>
            <code>history · keymap · wordCount</code>
          </div>
          <label class="plugin-toggle">
            <input
              checked={latencyEnabled()}
              onChange={(event) => setLatencyEnabled(event.currentTarget.checked)}
              type="checkbox"
            />{" "}
            slow apply
          </label>
        </div>
        <ProseMirrorEditor latencyEnabled={latencyEnabled()} />
      </section>
      <TanStackDevtools
        config={{
          position: "bottom-right",
          hideUntilHover: false,
          openHotkey: ["CtrlOrMeta", "Shift", "D"],
        }}
        plugins={[plugin]}
      />
    </main>
  );
}
