<script setup lang="ts">
import { ref } from "vue";
import { TanStackDevtools, type TanStackDevtoolsVuePlugin } from "@tanstack/vue-devtools";
import { createPlaygroundExtension } from "@prosemirror-devtools/demo-kit";
import { prosemirrorDevtoolsStore } from "prosemirror-inspector";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/vue";
import ProseMirrorEditor from "./ProseMirrorEditor.vue";

const latencyEnabled = ref(false);
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
        <label class="plugin-toggle">
          <input v-model="latencyEnabled" type="checkbox" /> slow apply
        </label>
      </div>
      <ProseMirrorEditor :latency-enabled="latencyEnabled" />
    </section>
    <TanStackDevtools :config="config" :plugins="[plugin]" />
  </main>
</template>
