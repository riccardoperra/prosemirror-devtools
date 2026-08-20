import { createMemo, Show, type JSX } from "solid-js";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { useSelectedTransaction } from "../../hooks/use-selected-transaction";
import { HistoryDispatchInspector } from "./history-dispatch-inspector";
import { TransactionList } from "./transaction-list";

export function HistoryView(props: {
  instance: RegisteredProseMirrorInstance;
  onClear: () => void;
}): JSX.Element {
  const records = createMemo(() => props.instance.transactions);
  const { record: selected, selectedId, select } = useSelectedTransaction(records);

  return (
    <Show
      when={selected()}
      fallback={<div class="pm-empty">Dispatch a transaction to begin recording history.</div>}
    >
      {(record) => (
        <div class="pm-history-layout">
          <TransactionList
            onClear={props.onClear}
            onSelect={select}
            records={records()}
            selectedId={selectedId()}
          />
          <HistoryDispatchInspector instance={props.instance} record={record()} />
        </div>
      )}
    </Show>
  );
}
