import { useEffect, useRef, useState } from "preact/hooks";
import { TanStackDevtools } from "@tanstack/preact-devtools";
import {
  createPlaygroundExtension,
  mountDemoEditor,
  type DemoEditorController,
} from "@prosemirror-devtools/demo-kit";
import { prosemirrorDevtoolsStore } from "prosemirror-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/preact";

const plugin = createProseMirrorDevtoolsPlugin({
  defaultPanel: "playground-integration",
  extensions: [createPlaygroundExtension("Preact")],
  store: prosemirrorDevtoolsStore,
});

export function App() {
  const editorHost = useRef<HTMLDivElement>(null);
  const editor = useRef<DemoEditorController>();
  const [latencyEnabled, setLatencyEnabled] = useState(false);

  useEffect(() => {
    if (!editorHost.current) return;
    editor.current = mountDemoEditor(editorHost.current, {
      customDispatch: true,
      instanceId: "preact-playground-editor",
      label: "Preact playground document",
    });
    return () => editor.current?.destroy();
  }, []);

  const toggleLatency = (enabled: boolean) => {
    setLatencyEnabled(enabled);
    editor.current?.setLatencyEnabled(enabled);
  };

  return (
    <main class="playground">
      <header class="playground-header">
        <h1>ProseMirror + Preact playground</h1>
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
          <label class="plugin-toggle" title="Adds 6–8 ms to each transaction">
            <input
              checked={latencyEnabled}
              onChange={(event) => toggleLatency(event.currentTarget.checked)}
              type="checkbox"
            />{" "}
            slow apply
          </label>
        </div>
        <div ref={editorHost} />
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
