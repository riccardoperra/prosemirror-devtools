import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import { Node as ProseMirrorNode } from "prosemirror-model";

import { restoreDocument } from "../../../core/snapshots";
import { getRecordedTransactionDocument } from "../../../core/store/transaction-record";
import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { formatDateTime, formatMs, formatTime } from "../../formatters";
import { JsonTree } from "../../json-tree";
import { useOptionalPanelInspection } from "../../panel-provider";
import { cx, panelStyles } from "../../styles";
import { Badge } from "../../ui/badge";
import { ViewSwitch } from "../../ui/view-switch";
import { ChangesView } from "../changes/changes-view";
import { DocumentDiffView } from "../changes/document-diff-view";
import { DispatchMarkers } from "../dispatch/dispatch-details";
import { DispatchEffects } from "../dispatch/dispatch-effects";
import { TransactionBadges } from "../dispatch/transaction-badges";
import { DispatchHeadlineText, StepLine } from "./step-line";
import {
  describeSelection,
  summarizeDispatch,
  summarizeTransactions,
  transactionOrigin,
  type TransactionSummary,
} from "./summarize-dispatch";

export interface HistoryDispatchInspectorProps {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
}

function Field(props: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <>
      <dt>{props.label}</dt>
      <dd>{props.children}</dd>
    </>
  );
}

function MetaValue(props: { value: unknown }): JSX.Element {
  return (
    <Show
      when={props.value !== null && typeof props.value === "object"}
      fallback={
        <span class={panelStyles.pmStepSubject}>
          {JSON.stringify(props.value) ?? String(props.value)}
        </span>
      }
    >
      <JsonTree defaultExpandedDepth={0} value={props.value} />
    </Show>
  );
}

/** Lazy JSON behind a disclosure: the payload renders only once opened. */
function JsonDisclosure(props: { label: string; children: () => JSX.Element }): JSX.Element {
  const [open, setOpen] = createSignal(false);
  return (
    <details
      class={panelStyles.pmDisclosure}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{props.label}</summary>
      <Show when={open()}>{props.children()}</Show>
    </details>
  );
}

function TransactionSection(props: {
  record: TransactionRecord;
  summary: TransactionSummary;
  onPlugin?: ((key: string) => void) | undefined;
}): JSX.Element {
  const transaction = () => props.summary.transaction;
  const origin = createMemo(() => transactionOrigin(props.record, transaction()));
  const meta = createMemo(() => Object.entries(transaction().meta));

  return (
    <section aria-label={origin().label} class={panelStyles.pmSection}>
      <div class={panelStyles.pmDetailHeading}>
        <span class={panelStyles.pmSectionTitle}>{origin().label}</span>
        <Show when={origin().pluginKey && props.onPlugin}>
          <button
            class={panelStyles.pmInlineAction}
            onClick={() => props.onPlugin?.(origin().pluginKey!)}
            type="button"
          >
            Inspect plugin
          </button>
        </Show>
        <span class={panelStyles.pmSpacer} />
        <Show when={transaction().docChanged}>
          <Badge tone="green">doc</Badge>
        </Show>
        <Show when={transaction().selectionSet}>
          <Badge tone="blue">selection</Badge>
        </Show>
        <Show when={transaction().storedMarksSet}>
          <Badge>marks</Badge>
        </Show>
      </div>
      <dl class={panelStyles.pmFields}>
        <Field label="steps">
          <Show
            when={props.summary.steps.length > 0}
            fallback={<span class={panelStyles.pmMuted}>none</span>}
          >
            <ol class={panelStyles.pmStepList}>
              <For each={props.summary.steps}>
                {(step, index) => (
                  <li>
                    <span class={panelStyles.pmStepIndex}>{index() + 1}</span>
                    <StepLine step={step} />
                    <span class={panelStyles.pmStepType}>{step.stepType}</span>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </Field>
        <For each={meta()}>
          {([key, value]) => (
            <Field label={key}>
              <MetaValue value={value} />
            </Field>
          )}
        </For>
        <Show when={transaction().captureError}>
          {(error) => (
            <Field label="capture">
              <span class={panelStyles.pmMuted}>{error()}</span>
            </Field>
          )}
        </Show>
      </dl>
      <Show when={transaction().steps.length > 0}>
        <JsonDisclosure label="Steps JSON">
          {() => <JsonTree defaultExpandedDepth={3} value={transaction().steps} />}
        </JsonDisclosure>
      </Show>
    </section>
  );
}

export function HistoryDispatchInspector(props: HistoryDispatchInspectorProps): JSX.Element {
  const [mode, setMode] = createSignal<"summary" | "changes">("summary");
  const inspection = useOptionalPanelInspection();
  const transactions = createMemo(() => summarizeTransactions(props.record));
  const headline = createMemo(() => summarizeDispatch(props.record, transactions()));
  const selectionBefore = createMemo(() => describeSelection(props.record.selectionBefore));
  const selectionAfter = createMemo(() => describeSelection(props.record.selectionAfter));
  /** The documents around the dispatch: kept in memory, else parsed from the recorded JSON. */
  const documents = createMemo(() => {
    const schema = props.instance.view.state.schema;
    const read = (phase: "before" | "after"): ProseMirrorNode | null => {
      const kept = getRecordedTransactionDocument(props.record, phase);
      if (kept) return kept;
      try {
        return ProseMirrorNode.fromJSON(
          schema,
          (phase === "before" ? props.record.docBefore : props.record.docAfter) as never,
        );
      } catch {
        return null;
      }
    };
    const before = read("before");
    const after = read("after");
    return before && after ? { before, after } : undefined;
  });
  const appended = () => props.record.transactions.filter(({ appended }) => appended).length;
  const open = (panel: string): void => {
    inspection?.selectTransaction({
      instanceId: props.record.instanceId,
      id: props.record.id,
      panel,
    });
  };

  return (
    <section
      aria-label={`Dispatch ${props.record.id} inspector`}
      class={cx(panelStyles.pmDispatchInspector, panelStyles.pmScroll)}
    >
      <header class={panelStyles.pmDispatchHeader}>
        <div class={panelStyles.pmDispatchIdentity}>
          <strong>#{props.record.id}</strong>
          <span class={panelStyles.pmDispatchTitle} title={headline().title}>
            <DispatchHeadlineText headline={headline()} />
          </span>
          <span class={panelStyles.pmRowDetail}>
            <time
              class={panelStyles.pmHistoryTimestamp}
              dateTime={new Date(props.record.timestamp).toISOString()}
              title={formatDateTime(props.record.timestamp)}
            >
              {formatTime(props.record.timestamp)}
            </time>{" "}
            · {formatMs(props.record.totalDuration)}
          </span>
        </div>
        <span class={panelStyles.pmSpacer} />
        <Show when={inspection}>
          <button class={panelStyles.pmInlineAction} onClick={() => open("state")} type="button">
            Document
          </button>
          <button
            class={panelStyles.pmInlineAction}
            onClick={() => open("performance")}
            type="button"
          >
            Performance
          </button>
        </Show>
        <button
          class={panelStyles.pmButton}
          onClick={() =>
            restoreDocument(props.instance.view, props.record.docAfter, props.record.selectionAfter)
          }
          title="Put the editor back to the document and selection after this dispatch"
          type="button"
        >
          Restore
        </button>
      </header>
      <DispatchEffects record={props.record} showRaw />
      <div class={cx(panelStyles.pmPaneHeader, panelStyles.pmPaneStatic)}>
        <ViewSwitch
          label="Transaction inspection mode"
          onChange={setMode}
          options={[
            { value: "summary", label: "Summary" },
            { value: "changes", label: "Changes & mapping" },
          ]}
          value={mode()}
        />
      </div>
      <Show when={mode() === "summary"} fallback={<ChangesView record={props.record} />}>
        <aside aria-label="Transaction details">
          <Show when={props.record.error}>
            {(error) => <div class={panelStyles.pmWarning}>{error()}</div>}
          </Show>
          <section aria-label="Dispatch result" class={panelStyles.pmSection}>
            <dl class={panelStyles.pmFields}>
              <Field label="result">
                <TransactionBadges record={props.record} />
                <Show when={!props.record.docChanged && !props.record.selectionSet}>
                  <span class={panelStyles.pmMuted}>no document or selection change</span>
                </Show>
              </Field>
              <Field label="selection">
                <Show
                  when={selectionBefore() !== selectionAfter()}
                  fallback={
                    <>
                      <span>{selectionAfter()}</span>
                      <span class={panelStyles.pmMuted}>unchanged</span>
                    </>
                  }
                >
                  <span class={panelStyles.pmMuted}>{selectionBefore()}</span>
                  <span aria-hidden="true" class={panelStyles.pmPathSeparator}>
                    →
                  </span>
                  <span>{selectionAfter()}</span>
                </Show>
              </Field>
              <Field label="transactions">
                <span>
                  {props.record.transactions.length}
                  <Show when={appended() > 0}>
                    <span class={panelStyles.pmMuted}>
                      {" "}
                      · 1 root, {appended()} appended by plugins
                    </span>
                  </Show>
                </span>
              </Field>
            </dl>
          </section>
          <Show when={props.record.docChanged ? documents() : undefined}>
            {(docs) => <DocumentDiffView after={docs().after} before={docs().before} />}
          </Show>
          <Show
            when={props.record.transactions.length > 0}
            fallback={
              <p class={panelStyles.pmSectionNote}>
                {props.record.filtered
                  ? "The root transaction was filtered before it could be applied."
                  : "No applied transaction payload was observed for this dispatch."}
              </p>
            }
          >
            <For each={transactions()}>
              {(summary) => (
                <TransactionSection
                  onPlugin={inspection ? (key) => inspection.selectPlugin(key) : undefined}
                  record={props.record}
                  summary={summary}
                />
              )}
            </For>
          </Show>
          <DispatchMarkers markers={props.record.markers} />
        </aside>
      </Show>
    </section>
  );
}
