import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import { cx, panelStyles } from "../../styles";

import type { TransactionRecord } from "../../../core/types";
import { formatDateTime, formatMs, formatTime } from "../../formatters";
import { useOptionalPanelContext } from "../../panel-provider";
import { Badge } from "../../ui/badge";
import { readDispatchEffects } from "../dispatch/read-dispatch-effects";
import { TransactionBadges } from "../dispatch/transaction-badges";
import { DispatchHeadlineText } from "./step-line";
import { summarizeDispatch } from "./summarize-dispatch";

const HISTORY_PAGE_SIZE = 200;

export interface TransactionListProps {
  records: readonly TransactionRecord[];
  selectedId: number;
  onSelect: (id: number) => void;
  onClear: () => void;
}

export function TransactionList(props: TransactionListProps): JSX.Element {
  const panel = useOptionalPanelContext();
  const [visibleCount, setVisibleCount] = createSignal(HISTORY_PAGE_SIZE);
  const newestFirst = createMemo(() =>
    props.records.slice(Math.max(0, props.records.length - visibleCount())).reverse(),
  );
  const hiddenCount = createMemo(() => Math.max(0, props.records.length - newestFirst().length));
  const idColumnWidth = createMemo(() => `#${props.records.at(-1)?.id ?? 0}`.length);

  return (
    <div
      class={panelStyles.pmHistoryList}
      style={{ "--pm-history-id-width": `${idColumnWidth()}ch` } as JSX.CSSProperties}
    >
      <div class={panelStyles.pmPaneHeader}>
        <span class={panelStyles.pmPaneTitle}>Dispatches</span>
        <Badge>{props.records.length}</Badge>
        <span class={panelStyles.pmSpacer} />
        <button class={panelStyles.pmButton} onClick={props.onClear} type="button">
          Clear
        </button>
      </div>
      <ul class={panelStyles.pmList}>
        <For each={newestFirst()}>
          {(record) => {
            const headline = createMemo(() => summarizeDispatch(record));
            const effects = createMemo(() =>
              readDispatchEffects(record, panel?.dispatchPresenters()).filter(
                ({ effect }) => effect.listLabel,
              ),
            );
            return (
              <li>
                <button
                  aria-label={`Inspect dispatch #${record.id}`}
                  aria-description={[
                    headline().title,
                    ...effects().map(({ effect }) => `${effect.badge ?? ""} ${effect.listLabel}`),
                  ].join(". ")}
                  aria-pressed={props.selectedId === record.id}
                  class={cx(panelStyles.pmListRow, panelStyles.pmHistoryRow)}
                  onClick={() => props.onSelect(record.id)}
                  type="button"
                >
                  <span class={panelStyles.pmTransactionTime}>#{record.id}</span>
                  <span class={panelStyles.pmRowStack}>
                    <span class={panelStyles.pmRowTitle} title={headline().title}>
                      <DispatchHeadlineText headline={headline()} />
                    </span>
                    <span class={panelStyles.pmRowDetail}>
                      <time
                        class={panelStyles.pmHistoryTimestamp}
                        dateTime={new Date(record.timestamp).toISOString()}
                        title={formatDateTime(record.timestamp)}
                      >
                        {formatTime(record.timestamp)}
                      </time>{" "}
                      · {formatMs(record.totalDuration)}
                    </span>
                  </span>
                  <span class={panelStyles.pmHistoryBadges}>
                    <TransactionBadges record={record} />
                  </span>
                  <Show when={effects().length > 0}>
                    <span class={panelStyles.pmHistoryEffects}>
                      <For each={effects()}>
                        {({ effect }) => (
                          <span>
                            <Show when={effect.badge}>
                              {(badge) => <Badge tone="blue">{badge()}</Badge>}
                            </Show>{" "}
                            {effect.listLabel}
                          </span>
                        )}
                      </For>
                    </span>
                  </Show>
                </button>
              </li>
            );
          }}
        </For>
        <Show when={hiddenCount() > 0}>
          <li>
            <button
              class={panelStyles.pmListRow}
              onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}
              type="button"
            >
              <span class={panelStyles.pmRowMain}>
                <span class={panelStyles.pmRowTitle}>Show older dispatches</span>
                <span class={panelStyles.pmRowDetail}>{hiddenCount()} not rendered</span>
              </span>
            </button>
          </li>
        </Show>
      </ul>
    </div>
  );
}
