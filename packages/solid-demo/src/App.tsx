import { createSignal, onCleanup, onMount } from "solid-js";
import { TanStackDevtools } from "@tanstack/solid-devtools";
import {
  createPlaygroundExtension,
  mountDemoEditor,
  type DemoEditorController,
} from "@prosemirror-devtools/demo-kit";
import { prosemirrorDevtoolsStore } from "prosemirror-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/solid";

const plugin = createProseMirrorDevtoolsPlugin({
  defaultPanel: "playground-integration",
  extensions: [createPlaygroundExtension("Solid")],
  store: prosemirrorDevtoolsStore,
});

export function App() {
  let editorHost: HTMLDivElement | undefined;
  let editor: DemoEditorController | undefined;
  const [latencyEnabled, setLatencyEnabled] = createSignal(false);
  onMount(() => {
    if (!editorHost) return;
    editor = mountDemoEditor(editorHost, {
      customDispatch: true,
      instanceId: "solid-playground-editor",
      label: "Solid playground document",
    });
  });
  onCleanup(() => editor?.destroy());
  const toggleLatency = (enabled: boolean) => {
    setLatencyEnabled(enabled);
    editor?.setLatencyEnabled(enabled);
  };

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
              onChange={(event) => toggleLatency(event.currentTarget.checked)}
              type="checkbox"
            />{" "}
            slow apply
          </label>
        </div>
        <div ref={(element) => (editorHost = element)} />
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
