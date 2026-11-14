<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { mountDemoEditor, type DemoEditorController } from "@prosemirror-devtools/demo-kit";

const { latencyEnabled } = defineProps<{ latencyEnabled: boolean }>();
const editorHost = useTemplateRef<HTMLElement>("editorHost");
let editor: DemoEditorController | undefined;

onMounted(() => {
  const host = editorHost.value;
  if (!host) return;
  editor = mountDemoEditor(host, {
    customDispatch: true,
    instanceId: "vue-playground-editor",
    label: "Vue playground document",
    latencyEnabled,
  });
});
watch(
  () => latencyEnabled,
  (enabled) => editor?.setLatencyEnabled(enabled),
);
onBeforeUnmount(() => editor?.destroy());
</script>

<template><div ref="editorHost" /></template>
