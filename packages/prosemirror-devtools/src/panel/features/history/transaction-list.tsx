import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type { TransactionRecord } from "../../../core/types";
import { formatDateTime, formatMs, formatTime } from "../../formatters";
import { TransactionBadges } from "../dispatch/transaction-badges";

const HISTORY_PAGE_SIZE = 200;

export function TransactionList(props: {
  records: readonly TransactionRecord[];
  selectedId: number;
  onSelect: (id: number) => void;
  onClear: () => void;
}): JSX.Element {
  const [visibleCount, setVisibleCount] = createSignal(HISTORY_PAGE_SIZE);
  const newestFirst = createMemo(() =>
    props.records.slice(Math.max(0, props.records.length - visibleCount())).reverse(),
  );
  const hiddenCount = createMemo(() => Math.max(0, props.records.length - newestFirst().length));
  const idColumnWidth = createMemo(() => `#${props.records.at(-1)?.id ?? 0}`.length);

  return (
    <div
      class="pm-history-list"
      style={{ "--pm-history-id-width": `${idColumnWidth()}ch` } as JSX.CSSProperties}
    >
      <div class="pm-pane-header">
        <span class="pm-pane-title">Recent dispatches</span>
        <span class="pm-spacer" />
        <button class="pm-button" onClick={props.onClear} type="button">
          Clear
        </button>
      </div>
      <ul class="pm-list">
        <For each={newestFirst()}>
          {(record) => (
            <li>
              <button
                aria-selected={props.selectedId === record.id}
                class="pm-list-row pm-history-row"
                onClick={() => props.onSelect(record.id)}
                type="button"
              >
                <span class="pm-transaction-time">#{record.id}</span>
                <span class="pm-row-main">
                  <time
                    class="pm-row-title pm-history-timestamp"
                    dateTime={new Date(record.timestamp).toISOString()}
                    title={formatDateTime(record.timestamp)}
                  >
                    {formatTime(record.timestamp)}
                  </time>
                  <span class="pm-row-detail">
                    {record.stepCount} steps · {formatMs(record.totalDuration)}
                  </span>
                </span>
                <span class="pm-history-badges">
                  <TransactionBadges record={record} />
                </span>
              </button>
            </li>
          )}
        </For>
        <Show when={hiddenCount() > 0}>
          <li>
            <button
              class="pm-list-row"
              onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}
              type="button"
            >
              <span class="pm-row-main">
                <span class="pm-row-title">Show older dispatches</span>
                <span class="pm-row-detail">{hiddenCount()} not rendered</span>
              </span>
            </button>
          </li>
        </Show>
      </ul>
    </div>
  );
}
