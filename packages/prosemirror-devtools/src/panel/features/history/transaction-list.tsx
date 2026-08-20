import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import { cx, panelStyles } from "../../styles";

import type { TransactionRecord } from "../../../core/types";
import { formatDateTime, formatMs, formatTime } from "../../formatters";
import { TransactionBadges } from "../dispatch/transaction-badges";

const HISTORY_PAGE_SIZE = 200;

export interface TransactionListProps {
  records: readonly TransactionRecord[];
  selectedId: number;
  onSelect: (id: number) => void;
  onClear: () => void;
}

export function TransactionList(props: TransactionListProps): JSX.Element {
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
        <span class={panelStyles.pmPaneTitle}>Recent dispatches</span>
        <span class={panelStyles.pmSpacer} />
        <button class={panelStyles.pmButton} onClick={props.onClear} type="button">
          Clear
        </button>
      </div>
      <ul class={panelStyles.pmList}>
        <For each={newestFirst()}>
          {(record) => (
            <li>
              <button
                aria-selected={props.selectedId === record.id}
                class={cx(panelStyles.pmListRow, panelStyles.pmHistoryRow)}
                onClick={() => props.onSelect(record.id)}
                type="button"
              >
                <span class={panelStyles.pmTransactionTime}>#{record.id}</span>
                <span class={panelStyles.pmRowMain}>
                  <time
                    class={cx(panelStyles.pmRowTitle, panelStyles.pmHistoryTimestamp)}
                    dateTime={new Date(record.timestamp).toISOString()}
                    title={formatDateTime(record.timestamp)}
                  >
                    {formatTime(record.timestamp)}
                  </time>
                  <span class={panelStyles.pmRowDetail}>
                    {record.stepCount} steps · {formatMs(record.totalDuration)}
                  </span>
                </span>
                <span class={panelStyles.pmHistoryBadges}>
                  <TransactionBadges record={record} />
                </span>
              </button>
            </li>
          )}
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
