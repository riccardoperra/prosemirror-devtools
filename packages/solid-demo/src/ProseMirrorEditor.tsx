import { createEffect, onCleanup, onMount } from "solid-js";
import { mountDemoEditor, type DemoEditorController } from "@prosemirror-devtools/demo-kit";

export function ProseMirrorEditor(props: { latencyEnabled: boolean }) {
  let editorHost: HTMLDivElement | undefined;
  let editor: DemoEditorController | undefined;

  onMount(() => {
    if (!editorHost) return;
    editor = mountDemoEditor(editorHost, {
      customDispatch: true,
      instanceId: "solid-playground-editor",
      label: "Solid playground document",
      latencyEnabled: props.latencyEnabled,
    });
  });
  createEffect(() => editor?.setLatencyEnabled(props.latencyEnabled));
  onCleanup(() => editor?.destroy());

  return <div ref={(element) => (editorHost = element)} />;
}
