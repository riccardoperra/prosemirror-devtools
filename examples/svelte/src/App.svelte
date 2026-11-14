<script lang="ts">
  import { TanStackDevtools, type TanStackDevtoolsSvelteInit } from "@tanstack/svelte-devtools";
  import { createPlaygroundExtension } from "@prosemirror-devtools/demo-kit";
  import { prosemirrorDevtoolsStore } from "prosemirror-inspector";
  import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/svelte";
  import ProseMirrorEditor from "./ProseMirrorEditor.svelte";

  let latencyEnabled = $state(false);
  const plugin = createProseMirrorDevtoolsPlugin({ defaultPanel: "playground-integration", extensions: [createPlaygroundExtension("Svelte")], store: prosemirrorDevtoolsStore });
  const config = {
    position: "bottom-right",
    hideUntilHover: false,
    openHotkey: ["CtrlOrMeta", "Shift", "D"],
  } satisfies NonNullable<TanStackDevtoolsSvelteInit["config"]>;
</script>

<main class="playground">
  <header class="playground-header"><h1>ProseMirror + Svelte playground</h1><span class="devtools-shortcut">Devtools <kbd>⌘⇧D</kbd></span></header>
  <section class="editor-workspace" aria-label="ProseMirror editor playground">
    <div class="plugin-bar"><div class="plugin-list"><span>plugins:</span><code>history · keymap · wordCount</code></div><label class="plugin-toggle"><input bind:checked={latencyEnabled} type="checkbox" /> slow apply</label></div>
    <ProseMirrorEditor {latencyEnabled} />
  </section>
  <TanStackDevtools {config} plugins={[plugin]} />
</main>
