import { useState } from "react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { prosemirrorDevtoolsStore } from "prosemirror-inspector";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/react";
import { playgroundDevtoolsExtension } from "./DevtoolsIntegrationExtension";
import { ProseMirrorEditor } from "./ProseMirrorEditor";
import { webMcp } from "./webmcp";

const prosemirrorPlugin = createProseMirrorDevtoolsPlugin({
  defaultPanel: "playground-integration",
  extensions: webMcp
    ? [playgroundDevtoolsExtension, webMcp.extension]
    : [playgroundDevtoolsExtension],
  store: prosemirrorDevtoolsStore,
});

export function App() {
  const [latencyEnabled, setLatencyEnabled] = useState(false);

  return (
    <main className="playground">
      <header className="playground-header">
        <h1>ProseMirror playground</h1>
        <span className="devtools-shortcut">
          Devtools <kbd>⌘⇧D</kbd>
        </span>
      </header>

      <section className="editor-workspace" aria-label="ProseMirror editor playground">
        <div className="plugin-bar">
          <div className="plugin-list">
            <span>plugins:</span>
            <code>history · keymap · wordCount</code>
          </div>

          <label className="plugin-toggle" title="Adds 6–8 ms to each transaction">
            <input
              checked={latencyEnabled}
              onChange={(event) => setLatencyEnabled(event.target.checked)}
              type="checkbox"
            />
            slow apply
          </label>
        </div>

        <ProseMirrorEditor
          customDispatch
          instanceId="playground-editor"
          label="Playground document"
          latencyEnabled={latencyEnabled}
        />
      </section>

      <TanStackDevtools
        config={{
          position: "bottom-right",
          hideUntilHover: false,
          openHotkey: ["CtrlOrMeta", "Shift", "D"],
        }}
        plugins={[prosemirrorPlugin]}
      />
    </main>
  );
}
