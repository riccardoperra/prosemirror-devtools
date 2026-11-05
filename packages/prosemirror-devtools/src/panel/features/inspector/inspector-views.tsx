import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type { SerializedValue } from "../../../core/types";
import type { InspectionResult } from "../../../inspection/types";
import { usePanelInspection } from "../../panel-provider";
import { hasDedicatedInspectorPanel, INSPECTOR_PANEL_IDS } from "../../panel-registry";
import { cx, panelStyles } from "../../styles";
import { InspectionReadout } from "../../ui/inspection-readout";

interface Metric {
  readonly label: string;
  readonly value: number | string;
}

interface InspectorSummary {
  readonly metrics: readonly Metric[];
  readonly note?: string;
}

interface InspectorSource {
  readonly id: string;
  readonly label: string;
  readonly summarize: (value: SerializedValue) => InspectorSummary;
}

function field(value: SerializedValue | undefined, key: string): SerializedValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value[key] : undefined;
}

function count(value: SerializedValue | undefined): number | string {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : "Unavailable";
}

function undoMetrics(depths: SerializedValue | undefined): readonly Metric[] {
  return [
    { label: "Undo", value: count(field(depths, "undoDepth")) },
    { label: "Redo", value: count(field(depths, "redoDepth")) },
  ];
}

function connection(value: SerializedValue | undefined): string {
  switch (field(value, "connection")) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    default:
      return "Not observed";
  }
}

const undoSources: readonly InspectorSource[] = [
  {
    id: INSPECTOR_PANEL_IDS.history,
    label: "ProseMirror history",
    summarize(value) {
      const dispatch = field(value, "kind") === "dispatch";
      const root = field(value, "root");
      const metrics = undoMetrics(field(value, dispatch ? "after" : "depths"));
      if (field(root, "addToHistory") === "excluded") {
        return { metrics, note: "This dispatch was excluded from undo history." };
      }
      if (field(root, "historyTransaction") === true) {
        return { metrics, note: "This dispatch came from undo or redo." };
      }
      return { metrics };
    },
  },
  {
    id: INSPECTOR_PANEL_IDS.yjs,
    label: "Yjs collaboration",
    summarize(value) {
      const undo = field(value, "undo");
      if (field(undo, "kind") === "available")
        return { metrics: undoMetrics(field(undo, "value")) };
      return { metrics: undoMetrics(undefined), note: "No Yjs UndoManager was observed." };
    },
  },
];

const collaborationSources: readonly InspectorSource[] = [
  {
    id: INSPECTOR_PANEL_IDS.collab,
    label: "ProseMirror collaboration",
    summarize(value) {
      const state = field(value, "state");
      return {
        metrics: [
          { label: "Confirmed version", value: count(field(state, "version")) },
          { label: "Pending steps", value: count(field(state, "unconfirmedSteps")) },
        ],
      };
    },
  },
  {
    id: INSPECTOR_PANEL_IDS.yjs,
    label: "Yjs collaboration",
    summarize(value) {
      const update = field(value, "latestUpdate");
      const local = field(update, "local");
      const bytes = count(field(update, "bytes"));
      const metrics: Metric[] = [
        {
          label: "Latest update",
          value: typeof local === "boolean" ? (local ? "Local" : "Remote") : "Not observed",
        },
        { label: "Sampled connection", value: connection(field(value, "transport")) },
      ];
      if (typeof bytes === "number") metrics.push({ label: "Update size", value: `${bytes} B` });
      return { metrics };
    },
  },
];

function InspectorView(props: {
  readonly title: string;
  readonly sources: readonly InspectorSource[];
}): JSX.Element {
  const inspection = usePanelInspection();
  const inspectors = createMemo(() => inspection.instance()?.inspection?.inspectors);
  const [detailsOpen, setDetailsOpen] = createSignal(false);
  const sources = props.sources.map((source) => ({
    source,
    result: createMemo(() =>
      inspectors()?.some(
        ({ descriptor }) => descriptor.id === source.id && hasDedicatedInspectorPanel(descriptor),
      )
        ? inspection.read({ kind: "contribution", id: source.id })
        : undefined,
    ),
  }));

  return (
    <div
      class={cx(panelStyles.pmScroll, panelStyles.pmInspectionContext, panelStyles.pmInspectorView)}
    >
      <div class={panelStyles.pmInspectionContextHeading}>
        <h2>{props.title}</h2>
      </div>
      <For each={sources}>
        {({ source, result }) => (
          <Show when={result()}>
            {(reading) => {
              const summary = createMemo(() => {
                const sample = reading();
                return sample.kind === "available" ? source.summarize(sample.value) : undefined;
              });
              return (
                <section class={panelStyles.pmInspectorSource} aria-label={source.label}>
                  <h3>{source.label}</h3>
                  <Show
                    when={summary()}
                    fallback={<p role="status">{unavailableReason(reading())}</p>}
                  >
                    {(current) => (
                      <>
                        <dl class={panelStyles.pmInspectorMetrics}>
                          <For each={current().metrics}>
                            {(metric) => (
                              <div role="group" aria-label={metric.label}>
                                <dt>{metric.label}</dt>
                                <dd>{metric.value}</dd>
                              </div>
                            )}
                          </For>
                        </dl>
                        <Show when={current().note}>{(note) => <p>{note()}</p>}</Show>
                      </>
                    )}
                  </Show>
                </section>
              );
            }}
          </Show>
        )}
      </For>
      <details
        class={panelStyles.pmDocumentDisclosure}
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
      >
        <summary>Raw data</summary>
        <Show when={detailsOpen()}>
          <For each={sources}>
            {({ source, result }) => (
              <Show when={result()}>
                {(reading) => <InspectionReadout result={reading()} label={source.label} />}
              </Show>
            )}
          </For>
        </Show>
      </details>
    </div>
  );
}

function unavailableReason(result: InspectionResult): string {
  if (
    result.kind === "unobserved" &&
    result.point?.kind === "transaction" &&
    result.point.phase === "before"
  ) {
    return "Switch to After dispatch to see the recorded sample.";
  }
  return result.kind === "available" ? "" : result.reason;
}

export function UndoHistoryView(): JSX.Element {
  return <InspectorView title="Undo history" sources={undoSources} />;
}

export function CollaborationView(): JSX.Element {
  return <InspectorView title="Collaboration" sources={collaborationSources} />;
}
