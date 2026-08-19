import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { TransactionRecord } from "../../../core/types";
import { formatDateTime, formatMs, formatTime } from "../../formatters";
import { TransactionBadges } from "../dispatch/transaction-badges";

const HISTORY_PAGE_SIZE = 200;

export function TransactionList({
  records,
  selectedId,
  onSelect,
  onClear,
}: {
  records: readonly TransactionRecord[];
  selectedId: number;
  onSelect: (id: number) => void;
  onClear: () => void;
}): ReactElement {
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const newestFirst = useMemo(
    () => records.slice(Math.max(0, records.length - visibleCount)).reverse(),
    [records, visibleCount],
  );
  const hiddenCount = Math.max(0, records.length - newestFirst.length);
  const idColumnWidth = `#${records.at(-1)?.id ?? 0}`.length;

  return (
    <div
      className="pm-history-list"
      style={{ "--pm-history-id-width": `${idColumnWidth}ch` } as CSSProperties}
    >
      <div className="pm-pane-header">
        <span className="pm-pane-title">Recent dispatches</span>
        <span className="pm-spacer" />
        <button className="pm-button" onClick={onClear} type="button">
          Clear
        </button>
      </div>
      <ul className="pm-list">
        {newestFirst.map((record) => (
          <li key={record.id}>
            <button
              aria-selected={selectedId === record.id}
              className="pm-list-row pm-history-row"
              onClick={() => onSelect(record.id)}
              type="button"
            >
              <span className="pm-transaction-time">#{record.id}</span>
              <span className="pm-row-main">
                <time
                  className="pm-row-title pm-history-timestamp"
                  dateTime={new Date(record.timestamp).toISOString()}
                  title={formatDateTime(record.timestamp)}
                >
                  {formatTime(record.timestamp)}
                </time>
                <span className="pm-row-detail">
                  {record.stepCount} steps · {formatMs(record.totalDuration)}
                </span>
              </span>
              <span className="pm-history-badges">
                <TransactionBadges record={record} />
              </span>
            </button>
          </li>
        ))}
        {hiddenCount > 0 ? (
          <li>
            <button
              className="pm-list-row"
              onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}
              type="button"
            >
              <span className="pm-row-main">
                <span className="pm-row-title">Show older dispatches</span>
                <span className="pm-row-detail">{hiddenCount} not rendered</span>
              </span>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
