import type { InspectionTarget, ProseMirrorInspectionClient } from "prosemirror-inspector/core";
import {
  exportProseMirrorRecording,
  parseProseMirrorRecording,
  RECORDING_MAX_BYTES,
  type ProseMirrorRecording,
} from "prosemirror-inspector/recordings";
import {
  mountProseMirrorRecordingInspector,
  type ProseMirrorRecordingInspectorMount,
} from "prosemirror-inspector/recordings-panel";

export interface RecordingControlsOptions {
  container: HTMLElement;
  client: ProseMirrorInspectionClient;
  target?: InspectionTarget;
}

function sameTarget(left: InspectionTarget, right: InspectionTarget): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.editorId === right.editorId &&
    left.sessionId === right.sessionId &&
    left.generation === right.generation
  );
}

export function mountRecordingControls(options: RecordingControlsOptions): () => void {
  const doc = options.container.ownerDocument;
  const section = doc.createElement("section");
  section.setAttribute("aria-label", "Diagnostic recordings");
  section.innerHTML = `<h2>Diagnostic recordings</h2>
    <p>Save a bounded diagnostic file or open one for read-only inspection.</p>
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
      <label>Export editor <select aria-label="Recording export editor"></select></label>
      <button type="button" data-action="refresh">Refresh editor sessions</button>
      <button type="button" data-action="export">Export diagnostic recording</button>
      <a data-action="download" hidden>Download last recording</a>
      <label>Import diagnostic recording <input aria-label="Import diagnostic recording" type="file" accept="application/json,.json"></label>
      <button type="button" data-action="open" disabled>Open exported recording</button>
    </div>
    <p role="status" aria-live="polite" data-recording-status>Choose the editor session to export.</p>
    <div data-recording-inspector style="height:680px;display:none"></div>`;
  options.container.append(section);
  const editorSelect = section.querySelector<HTMLSelectElement>("select");
  const exportButton = section.querySelector<HTMLButtonElement>('[data-action="export"]');
  const refreshButton = section.querySelector<HTMLButtonElement>('[data-action="refresh"]');
  const openButton = section.querySelector<HTMLButtonElement>('[data-action="open"]');
  const download = section.querySelector<HTMLAnchorElement>('[data-action="download"]');
  const fileInput = section.querySelector<HTMLInputElement>('input[type="file"]');
  const status = section.querySelector<HTMLElement>("[data-recording-status]");
  const viewer = section.querySelector<HTMLElement>("[data-recording-inspector]");
  if (
    !editorSelect ||
    !exportButton ||
    !refreshButton ||
    !openButton ||
    !download ||
    !fileInput ||
    !status ||
    !viewer
  )
    throw new Error("Recording controls could not mount.");
  let selectedTarget = options.target;
  let lastExport: string | undefined;
  let downloadURL: string | undefined;
  let inspector: ProseMirrorRecordingInspectorMount | undefined;
  let disposed = false;
  let importVersion = 0;
  const urlAPI = doc.defaultView?.URL ?? URL;
  const message = (text: string): void => {
    status.textContent = text;
  };
  const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
  const refresh = (initial = false): void => {
    const editors = options.client.listEditors();
    const requested = selectedTarget;
    if (requested && !editors.some((editor) => sameTarget(editor.target, requested)))
      selectedTarget = undefined;
    if (initial && options.target === undefined) selectedTarget = editors[0]?.target;
    editorSelect.replaceChildren();
    const placeholder = doc.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose editor session";
    editorSelect.append(placeholder);
    for (const editor of editors) {
      const option = doc.createElement("option");
      option.value = editor.target.editorId;
      option.textContent = `${editor.label} (${editor.target.editorId}), generation ${editor.target.generation}`;
      editorSelect.append(option);
    }
    editorSelect.value = selectedTarget?.editorId ?? "";
    exportButton.disabled = selectedTarget === undefined;
  };
  const openRecording = (recording: ProseMirrorRecording): void => {
    viewer.style.display = "block";
    if (inspector) inspector.update({ recording, theme: "light" });
    else inspector = mountProseMirrorRecordingInspector(viewer, { recording, theme: "light" });
    message(`Opened offline recording ${recording.id}.`);
  };
  refresh(true);
  editorSelect.addEventListener("change", () => {
    selectedTarget = options.client
      .listEditors()
      .find((editor) => editor.target.editorId === editorSelect.value)?.target;
    exportButton.disabled = selectedTarget === undefined;
  });
  refreshButton.addEventListener("click", () => {
    refresh();
    message(
      "Editor sessions refreshed. Choose a current session explicitly if the previous editor was reset.",
    );
  });
  exportButton.addEventListener("click", () => {
    try {
      if (!selectedTarget) throw new Error("Choose an editor session before exporting.");
      const recording = exportProseMirrorRecording({
        client: options.client,
        target: selectedTarget,
      });
      lastExport = JSON.stringify(recording);
      if (downloadURL) urlAPI.revokeObjectURL(downloadURL);
      downloadURL = urlAPI.createObjectURL(new Blob([lastExport], { type: "application/json" }));
      download.href = downloadURL;
      download.download = `prosemirror-recording-${recording.id}.json`;
      download.hidden = false;
      openButton.disabled = false;
      download.click();
      message(
        `Exported recording ${recording.id} with ${recording.dispatches.length} dispatch entries.`,
      );
    } catch (error) {
      refresh();
      message(`Export failed. ${errorMessage(error)}`);
    }
  });
  openButton.addEventListener("click", () => {
    try {
      if (lastExport) openRecording(parseProseMirrorRecording(lastExport));
    } catch (error) {
      message(`Recording rejected. ${errorMessage(error)}`);
    }
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    const version = ++importVersion;
    if (file.size > RECORDING_MAX_BYTES) {
      message("Recording rejected. The file exceeds the 2 MB import limit.");
      return;
    }
    void file
      .text()
      .then((text) => {
        if (!disposed && version === importVersion) openRecording(parseProseMirrorRecording(text));
      })
      .catch((error: unknown) => {
        if (!disposed && version === importVersion)
          message(`Recording rejected. ${errorMessage(error)}`);
      });
  });

  return () => {
    disposed = true;
    importVersion += 1;
    inspector?.unmount();
    if (downloadURL) urlAPI.revokeObjectURL(downloadURL);
    section.remove();
  };
}
