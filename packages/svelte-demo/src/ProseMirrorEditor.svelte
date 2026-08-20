<script lang="ts">
  import { onMount } from "svelte";
  import { mountDemoEditor, type DemoEditorController } from "@prosemirror-devtools/demo-kit";

  let { latencyEnabled }: { latencyEnabled: boolean } = $props();
  let editorHost = $state<HTMLElement>();
  let editor: DemoEditorController | undefined;

  onMount(() => {
    if (!editorHost) return;
    editor = mountDemoEditor(editorHost, {
      customDispatch: true,
      instanceId: "svelte-playground-editor",
      label: "Svelte playground document",
      latencyEnabled,
    });
    return () => editor?.destroy();
  });
  $effect(() => editor?.setLatencyEnabled(latencyEnabled));
</script>

<div bind:this={editorHost}></div>
