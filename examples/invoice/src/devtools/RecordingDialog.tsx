import { RecordingInspector } from "prosemirror-inspector/recordings-panel";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { viewedRecording } from "./actions";
import "./recording-dialog.css";

/**
 * Renders the exported Solid component rather than mountProseMirrorRecordingInspector, because that
 * mount is inert outside development and the Pages showcase is a production build.
 */
export function RecordingDialog() {
  const recording = useSyncExternalStore(viewedRecording.subscribe, viewedRecording.get);
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = body.current;
    if (!recording || !element) return;
    dialog.current?.showModal();
    return render(
      () => createComponent(RecordingInspector, { recording, styleTarget: document }),
      element,
    );
  }, [recording]);
  return (
    <dialog
      ref={dialog}
      className="recording-dialog"
      aria-label="Recording viewer"
      onClose={() => viewedRecording.set(null)}
    >
      <header>
        <h2>
          Recording · {recording?.editor.label} · {recording?.dispatches.length ?? 0} dispatches
        </h2>
        <button type="button" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </header>
      <div ref={body} className="recording-dialog-body" />
    </dialog>
  );
}
