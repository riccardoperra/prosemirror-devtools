import type { ReactElement } from "react";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { useSelectedTransaction } from "../../hooks/use-selected-transaction";
import { HistoryDispatchInspector } from "./history-dispatch-inspector";
import { TransactionList } from "./transaction-list";

export function HistoryView({
  instance,
  onClear,
}: {
  instance: RegisteredProseMirrorInstance;
  onClear: () => void;
}): ReactElement {
  const records = instance.transactions;
  const { record: selected, selectedId, select } = useSelectedTransaction(records);

  if (!selected) {
    return <div className="pm-empty">Dispatch a transaction to begin recording history.</div>;
  }

  return (
    <div className="pm-history-layout">
      <TransactionList
        onClear={onClear}
        onSelect={select}
        records={records}
        selectedId={selectedId}
      />
      <HistoryDispatchInspector instance={instance} record={selected} />
    </div>
  );
}
