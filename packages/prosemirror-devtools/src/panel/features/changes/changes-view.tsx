import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import { mapRecordedPosition } from "../../../core/transaction-changes";
import type { TransactionRecord } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { cx, panelStyles } from "../../styles";
import { Badge } from "../../ui/badge";
import { EmptyState } from "../../ui/empty-state";

export function ChangesView(props: { record: TransactionRecord }): JSX.Element {
  const steps = createMemo(() =>
    props.record.transactions.flatMap((transaction) =>
      (transaction.stepDetails ?? []).map((step) => ({
        transactionIndex: transaction.index,
        appended: transaction.appended,
        step,
        json: transaction.steps[step.index],
      })),
    ),
  );
  const [selected, setSelected] = createSignal(0);
  const [probe, setProbe] = createSignal<{ record: TransactionRecord; value: string }>();
  const [association, setAssociation] = createSignal<-1 | 1>(1);
  const positionText = createMemo(() => (probe()?.record === props.record ? probe()!.value : "0"));
  const position = createMemo(() => (positionText().trim() ? Number(positionText()) : NaN));
  const mapped = createMemo(() => mapRecordedPosition(props.record, position(), association()));
  const selectedIndex = createMemo(() => Math.max(0, Math.min(selected(), steps().length - 1)));
  const current = createMemo(() => steps()[selectedIndex()]);
  const change = createMemo(() =>
    props.record.applicationStatus === "applied" ? current()?.step.change : undefined,
  );

  return (
    <section aria-label="Changes and mapping">
      <Show
        when={props.record.applicationStatus === "applied"}
        fallback={
          <EmptyState>
            {props.record.applicationStatus === "filtered"
              ? "This dispatch was filtered. No steps were applied."
              : "Applied steps were not observed for this custom dispatch. Position mapping is unavailable."}
          </EmptyState>
        }
      >
        <Show
          when={steps().length > 0}
          fallback={
            <EmptyState>
              {props.record.stepCount === 0
                ? "This dispatch contains no document steps."
                : "This record has no captured step maps. Record a new dispatch to inspect its changes."}
            </EmptyState>
          }
        >
          <div class={panelStyles.pmPaneHeader}>
            <span class={panelStyles.pmPaneTitle}>Position probe</span>
            <label>
              Before dispatch{" "}
              <input
                aria-label="Position before dispatch"
                class={cx(panelStyles.pmSearch, panelStyles.pmNumberInput)}
                type="number"
                min="0"
                max={steps()[0]?.step.documentSizeBefore}
                step="1"
                value={positionText()}
                onInput={(event) =>
                  setProbe({ record: props.record, value: event.currentTarget.value })
                }
              />
            </label>
            <select
              aria-label="Position association"
              class={panelStyles.pmInstanceSelect}
              value={association()}
              onChange={(event) => setAssociation(event.currentTarget.value === "-1" ? -1 : 1)}
            >
              <option value="-1">Before inserted content (−1)</option>
              <option value="1">After inserted content (+1)</option>
            </select>
          </div>
          <div class={panelStyles.pmInspectorStats} role="status">
            <Show
              when={mapped()}
              fallback={
                <span>Enter a whole position from 0 to {steps()[0]?.step.documentSizeBefore}.</span>
              }
            >
              {(mapping) => (
                <>
                  <Badge tone="blue">
                    {position()} → {mapping().result.pos}
                  </Badge>
                  <Badge>
                    {mapping().result.deleted ? "associated token deleted" : "position preserved"}
                  </Badge>
                  <Show when={mapping().result.deletedAcross}>
                    <Badge>deleted across</Badge>
                  </Show>
                </>
              )}
            </Show>
          </div>
          <Show when={mapped()}>
            {(mapping) => (
              <table
                class={panelStyles.pmTable}
                aria-label="Position mapping through applied steps"
              >
                <thead>
                  <tr>
                    <th>Transaction / step</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Deleted</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={mapping().trace}>
                    {(entry) => (
                      <tr>
                        <th scope="row">
                          {entry.transactionIndex + 1} / {entry.stepIndex + 1}
                        </th>
                        <td>{entry.before}</td>
                        <td>{entry.result.pos}</td>
                        <td
                          title={`Deleted before: ${entry.result.deletedBefore}; after: ${entry.result.deletedAfter}; across: ${entry.result.deletedAcross}`}
                        >
                          {entry.result.deleted ? "yes" : "no"}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            )}
          </Show>
          <div class={panelStyles.pmPaneHeader}>
            <span class={panelStyles.pmPaneTitle}>Step changes</span>
            <select
              aria-label="Inspect applied step"
              class={panelStyles.pmInstanceSelect}
              value={selectedIndex()}
              onChange={(event) => setSelected(Number(event.currentTarget.value))}
            >
              <For each={steps()}>
                {(entry, index) => (
                  <option value={index()}>
                    {entry.appended ? "Appended" : "Root"} {entry.transactionIndex + 1} · step{" "}
                    {entry.step.index + 1}
                  </option>
                )}
              </For>
            </select>
            <Badge>{steps().length} applied steps</Badge>
          </div>
          <Show when={current()}>
            {(entry) => (
              <>
                <Show
                  when={entry().step.ranges.length > 0}
                  fallback={
                    <div class={panelStyles.pmInspectorStats}>
                      No position changes in this step. Marks or attributes may still change.
                    </div>
                  }
                >
                  <table class={panelStyles.pmTable} aria-label="Changed ranges in selected step">
                    <thead>
                      <tr>
                        <th>Old start</th>
                        <th>Old end</th>
                        <th>New start</th>
                        <th>New end</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={entry().step.ranges}>
                        {(range) => (
                          <tr>
                            <td>{range.oldStart}</td>
                            <td>{range.oldEnd}</td>
                            <td>{range.newStart}</td>
                            <td>{range.newEnd}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </Show>
                <Show
                  when={change()}
                  fallback={
                    <div class={panelStyles.pmInspectorStats}>
                      The document is unchanged by this step.
                    </div>
                  }
                >
                  {(diff) => (
                    <div class={panelStyles.pmDetailColumns}>
                      <section>
                        <div class={panelStyles.pmDetailHeading}>
                          <span class={panelStyles.pmSectionTitle}>
                            {diff().kind === "document" ? "Document before" : "Removed / previous"}
                          </span>
                          <Badge>
                            {diff().from}–{diff().oldTo}
                          </Badge>
                        </div>
                        <JsonTree value={diff().before} defaultExpandedDepth={4} />
                      </section>
                      <section>
                        <div class={panelStyles.pmDetailHeading}>
                          <span class={panelStyles.pmSectionTitle}>
                            {diff().kind === "document" ? "Document after" : "Inserted / next"}
                          </span>
                          <Badge>
                            {diff().from}–{diff().newTo}
                          </Badge>
                        </div>
                        <JsonTree value={diff().after} defaultExpandedDepth={4} />
                      </section>
                    </div>
                  )}
                </Show>
                <div class={panelStyles.pmDetailHeading}>
                  <span class={panelStyles.pmSectionTitle}>Step JSON</span>
                </div>
                <JsonTree value={entry().json} defaultExpandedDepth={1} />
              </>
            )}
          </Show>
        </Show>
      </Show>
    </section>
  );
}
