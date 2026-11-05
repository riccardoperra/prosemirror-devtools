import { createMemo, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";
import { ResizableSplit } from "../../ui/resizable-split";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { useSelectedTransaction } from "../../hooks/use-selected-transaction";
import { HistoryDispatchInspector } from "./history-dispatch-inspector";
import { TransactionList } from "./transaction-list";

export interface HistoryViewProps {
  instance: RegisteredProseMirrorInstance;
  onClear: () => void;
}

export function HistoryView(props: HistoryViewProps): JSX.Element {
  const records = createMemo(() => props.instance.transactions);
  const { record: selected, selectedId, select } = useSelectedTransaction(records);

  return (
    <Show
      when={selected()}
      fallback={
        <div class={panelStyles.pmEmpty}>Dispatch a transaction to begin recording history.</div>
      }
    >
      {(record) => (
        <ResizableSplit label="Dispatch list width" class={panelStyles.pmHistoryLayout}>
          <TransactionList
            onClear={props.onClear}
            onSelect={select}
            records={records()}
            selectedId={selectedId()}
          />
          <HistoryDispatchInspector instance={props.instance} record={record()} />
        </ResizableSplit>
      )}
    </Show>
  );
}
