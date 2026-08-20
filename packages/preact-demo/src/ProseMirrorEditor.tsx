import { useEffect, useRef } from "preact/hooks";
import { mountDemoEditor, type DemoEditorController } from "@prosemirror-devtools/demo-kit";

export function ProseMirrorEditor({ latencyEnabled }: { latencyEnabled: boolean }) {
  const editorHost = useRef<HTMLDivElement>(null);
  const editor = useRef<DemoEditorController>();

  useEffect(() => {
    const host = editorHost.current;
    if (!host) return;

    editor.current = mountDemoEditor(host, {
      customDispatch: true,
      instanceId: "preact-playground-editor",
      label: "Preact playground document",
    });
    return () => editor.current?.destroy();
  }, []);

  useEffect(() => editor.current?.setLatencyEnabled(latencyEnabled), [latencyEnabled]);

  return <div ref={editorHost} />;
}
