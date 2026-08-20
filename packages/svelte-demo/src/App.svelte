<script lang="ts">
  import { onMount } from "svelte";
  import { TanStackDevtools } from "@tanstack/svelte-devtools";
  import { createPlaygroundExtension, mountDemoEditor, type DemoEditorController } from "@prosemirror-devtools/demo-kit";
  import { prosemirrorDevtoolsStore } from "prosemirror-devtools";
  import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/svelte";

  let editorHost = $state<HTMLElement>();
  let editor: DemoEditorController | undefined;
  let latencyEnabled = $state(false);
  const plugin = createProseMirrorDevtoolsPlugin({ defaultPanel: "playground-integration", extensions: [createPlaygroundExtension("Svelte")], store: prosemirrorDevtoolsStore });
  const config = { position: "bottom-right", hideUntilHover: false, openHotkey: ["CtrlOrMeta", "Shift", "D"] } as const;
  onMount(() => {
    if (!editorHost) return;
    editor = mountDemoEditor(editorHost, { customDispatch: true, instanceId: "svelte-playground-editor", label: "Svelte playground document" });
    return () => editor?.destroy();
  });
  function toggleLatency(event: Event) {
    latencyEnabled = (event.currentTarget as HTMLInputElement).checked;
    editor?.setLatencyEnabled(latencyEnabled);
  }
</script>

<main class="playground">
  <header class="playground-header"><h1>ProseMirror + Svelte playground</h1><span class="devtools-shortcut">Devtools <kbd>⌘⇧D</kbd></span></header>
  <section class="editor-workspace" aria-label="ProseMirror editor playground">
    <div class="plugin-bar"><div class="plugin-list"><span>plugins:</span><code>history · keymap · wordCount</code></div><label class="plugin-toggle"><input checked={latencyEnabled} type="checkbox" onchange={toggleLatency} /> slow apply</label></div>
    <div bind:this={editorHost}></div>
  </section>
  <TanStackDevtools {config} plugins={[plugin]} />
</main>
