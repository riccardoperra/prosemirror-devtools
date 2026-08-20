<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { TanStackDevtools, type TanStackDevtoolsVuePlugin } from "@tanstack/vue-devtools";
import {
  createPlaygroundExtension,
  mountDemoEditor,
  type DemoEditorController,
} from "@prosemirror-devtools/demo-kit";
import { prosemirrorDevtoolsStore } from "prosemirror-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/vue";

const editorHost = ref<HTMLElement>();
const latencyEnabled = ref(false);
let editor: DemoEditorController | undefined;
const plugin = createProseMirrorDevtoolsPlugin({
  defaultPanel: "playground-integration",
  extensions: [createPlaygroundExtension("Vue")],
  store: prosemirrorDevtoolsStore,
}) as unknown as TanStackDevtoolsVuePlugin;
const config = {
  position: "bottom-right" as const,
  hideUntilHover: false,
  openHotkey: ["CtrlOrMeta", "Shift", "D"],
};

onMounted(() => {
  if (editorHost.value)
    editor = mountDemoEditor(editorHost.value, {
      customDispatch: true,
      instanceId: "vue-playground-editor",
      label: "Vue playground document",
    });
});
onBeforeUnmount(() => editor?.destroy());
function toggleLatency(event: Event) {
  latencyEnabled.value = (event.currentTarget as HTMLInputElement).checked;
  editor?.setLatencyEnabled(latencyEnabled.value);
}
</script>

<template>
  <main class="playground">
    <header class="playground-header">
      <h1>ProseMirror + Vue playground</h1>
      <span class="devtools-shortcut">Devtools <kbd>⌘⇧D</kbd></span>
    </header>
    <section class="editor-workspace" aria-label="ProseMirror editor playground">
      <div class="plugin-bar">
        <div class="plugin-list">
          <span>plugins:</span><code>history · keymap · wordCount</code>
        </div>
        <label class="plugin-toggle"
          ><input :checked="latencyEnabled" type="checkbox" @change="toggleLatency" /> slow
          apply</label
        >
      </div>
      <div ref="editorHost" />
    </section>
    <TanStackDevtools :config="config" :plugins="[plugin]" />
  </main>
</template>
