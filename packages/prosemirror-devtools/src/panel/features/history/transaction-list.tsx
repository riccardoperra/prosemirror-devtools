import { useMemo } from "react";
import type { ReactElement } from "react";

import type { TransactionRecord } from "../../../core/types";
import { formatMs, formatTime } from "../../formatters";
import { TransactionBadges } from "../dispatch/transaction-badges";

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
  const newestFirst = useMemo(() => [...records].reverse(), [records]);

  return (
    <div className="pm-history-list">
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
              className="pm-list-row"
              onClick={() => onSelect(record.id)}
              type="button"
            >
              <span className="pm-transaction-time">#{record.id}</span>
              <span className="pm-row-main">
                <span className="pm-row-title">{formatTime(record.timestamp)}</span>
                <span className="pm-row-detail">
                  {record.stepCount} steps · {formatMs(record.totalDuration)}
                </span>
              </span>
              <TransactionBadges record={record} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
