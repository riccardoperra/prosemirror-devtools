import { createEffect, createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type { DevtoolsTheme } from "../core/types";
import type { InspectionQuery, InspectionReadPoint, InspectionResult } from "../inspection/types";
import { resolveInspectionLimits, serializeInspectionValue } from "../inspection/serialization";
import { createProseMirrorRecordingClient } from "../recordings/client";
import type { ProseMirrorRecording } from "../recordings/types";
import { useResolvedTheme } from "./hooks/use-resolved-theme";
import type { ProseMirrorDevtoolsPanelStyle } from "./panel.types";
import { cx, ensurePanelStyles, panelStyles } from "./styles";
import { Badge } from "./ui/badge";
import { CopyDiagnosticContext } from "./ui/copy-diagnostic-context";
import { InspectionReadout } from "./ui/inspection-readout";

export interface RecordingInspectorProps {
  recording: ProseMirrorRecording;
  theme?: DevtoolsTheme;
  className?: string;
  style?: ProseMirrorDevtoolsPanelStyle;
  styleTarget?: Document;
}

type RecordingQueryKind = Exclude<InspectionQuery["kind"], "contribution">;
const queries: readonly { kind: RecordingQueryKind; title: string }[] = [
  { kind: "document", title: "Document" },
  { kind: "selection", title: "Selection" },
  { kind: "transaction", title: "Dispatch details" },
  { kind: "contributions", title: "Inspector projections" },
  { kind: "transactions", title: "Dispatch summaries" },
  { kind: "schema", title: "Schema" },
  { kind: "plugins", title: "Plugins" },
  { kind: "events", title: "Events" },
  { kind: "decorations", title: "Decorations" },
  { kind: "nodeViews", title: "NodeViews" },
  { kind: "capabilities", title: "Capabilities" },
];

/** Read-only recording UI. Every evidence read uses its isolated offline query client. */
export function RecordingInspector(props: RecordingInspectorProps): JSX.Element {
  const ownerDocument = (): Document => props.styleTarget ?? document;
  createEffect(() => ensurePanelStyles(ownerDocument()));
  const theme = useResolvedTheme(() => props.theme ?? "system", ownerDocument);
  const recording = createMemo(() => props.recording);
  const client = createMemo(() => createProseMirrorRecordingClient(recording()));
  const [selectedPoint, setSelectedPoint] = createSignal("current");
  const [phase, setPhase] = createSignal<"before" | "after">("after");
  const [kind, setKind] = createSignal<RecordingQueryKind>("document");
  createEffect(() => {
    client();
    setSelectedPoint("current");
    setPhase("after");
    setKind("document");
  });
  const editor = createMemo(() => client().listEditors()[0]);
  const point = createMemo<InspectionResult<InspectionReadPoint> | undefined>(() => {
    const target = editor()?.target;
    if (!target) return undefined;
    return client().pin({
      target,
      at:
        selectedPoint() === "current"
          ? { kind: "current" }
          : { kind: "transaction", id: Number(selectedPoint()), phase: phase() },
    });
  });
  const query = createMemo<InspectionQuery | undefined>(() => {
    const selected = kind();
    if (selected === "transaction")
      return selectedPoint() === "current"
        ? undefined
        : { kind: selected, id: Number(selectedPoint()) };
    return { kind: selected };
  });
  const result = createMemo(() => {
    const pinned = point();
    const selected = query();
    if (!pinned || !selected) return undefined;
    return pinned.kind === "available"
      ? client().read({ point: pinned.value, query: selected })
      : pinned;
  });
  const label = (): string =>
    queries.find((entry) => entry.kind === kind())?.title ?? "Recorded evidence";
  const context = (): string => {
    const value = serializeInspectionValue(
      {
        version: 1,
        source: client().source,
        target: editor()?.target ?? null,
        recordingId: props.recording.id,
        origin: props.recording.origin,
        point: point()?.point ?? null,
        query: query() ?? null,
        coverage: result()?.coverage ?? null,
      },
      resolveInspectionLimits({ maxBytes: 16_000, maxNodes: 2_000, maxStringLength: 2_000 }),
    );
    return JSON.stringify(
      value.kind === "available" ? value.value : { kind: value.kind, reason: value.reason },
    );
  };

  return (
    <section
      aria-label="ProseMirror recording inspector"
      class={cx(panelStyles.pmDevtools, props.className)}
      data-theme={theme()}
      data-density="compact"
      style={props.style}
    >
      <header class={panelStyles.pmHeader}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Diagnostic recording</span>
          <Badge tone="yellow">Offline source</Badge>
          <span>{props.recording.editor.label}</span>
        </div>
        <p class={panelStyles.pmPerformanceNote} style={{ "overflow-wrap": "anywhere" }}>
          Read-only source {client().source.id}. Recording {props.recording.id}. These observations
          do not attest to an action in the current browser.
        </p>
        <div class={panelStyles.pmPaneHeader}>
          <label>
            Read point{" "}
            <select
              aria-label="Recording read point"
              class={panelStyles.pmInstanceSelect}
              value={selectedPoint()}
              onChange={(event) => setSelectedPoint(event.currentTarget.value)}
            >
              <option value="current">Recorded current point</option>
              <For each={props.recording.dispatches}>
                {(dispatch) => (
                  <option value={dispatch.id}>
                    Dispatch #{dispatch.id}
                    {dispatch.kind === "unavailable" ? ` (${dispatch.result.kind})` : ""}
                  </option>
                )}
              </For>
            </select>
          </label>
          <Show when={selectedPoint() !== "current"}>
            <div class={panelStyles.pmViewSwitch} aria-label="Recorded dispatch phase" role="group">
              <For each={["before", "after"] as const}>
                {(value) => (
                  <button
                    type="button"
                    aria-pressed={phase() === value}
                    onClick={() => setPhase(value)}
                  >
                    {value === "before" ? "Before dispatch" : "After dispatch"}
                  </button>
                )}
              </For>
            </div>
          </Show>
          <label>
            Evidence{" "}
            <select
              aria-label="Recording evidence query"
              class={panelStyles.pmInstanceSelect}
              value={kind()}
              onChange={(event) => {
                const selected = queries.find(({ kind }) => kind === event.currentTarget.value);
                if (selected) setKind(selected.kind);
              }}
            >
              <For each={queries}>
                {(entry) => <option value={entry.kind}>{entry.title}</option>}
              </For>
            </select>
          </label>
          <CopyDiagnosticContext read={context} ownerDocument={ownerDocument()} />
        </div>
      </header>
      <div class={panelStyles.pmBody}>
        <div class={panelStyles.pmScroll}>
          <Show
            when={result()}
            fallback={
              <p role="status" class={panelStyles.pmPerformanceNote}>
                Choose a dispatch read point to inspect its details.
              </p>
            }
          >
            {(value) => <InspectionReadout label={label()} result={value()} />}
          </Show>
          <details
            class={panelStyles.pmDocumentDisclosure}
            aria-label="Recording origin and omissions"
          >
            <summary>Recording origin and omissions</summary>
            <p class={panelStyles.pmPerformanceNote} style={{ "overflow-wrap": "anywhere" }}>
              Origin editor {props.recording.origin.target.editorId}, session{" "}
              {props.recording.origin.target.sessionId}, generation{" "}
              {props.recording.origin.target.generation}. Captured{" "}
              {new Date(props.recording.createdAt).toISOString()}.
            </p>
            <ul>
              <For each={props.recording.omissions}>
                {(entry) => (
                  <li>
                    <strong>{entry.scope}</strong>. {entry.reason}
                  </li>
                )}
              </For>
            </ul>
          </details>
        </div>
      </div>
    </section>
  );
}
