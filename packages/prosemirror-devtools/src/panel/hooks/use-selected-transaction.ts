import { createMemo, createSignal, type Accessor } from "solid-js";

import type { TransactionRecord } from "../../core/types";

export interface SelectedTransaction {
  record: Accessor<TransactionRecord | undefined>;
  selectedId: Accessor<number>;
  select: (id: number) => void;
}

export function useSelectedTransaction(
  records: Accessor<readonly TransactionRecord[]>,
): SelectedTransaction {
  // `null` is an intentional "follow latest" mode rather than a snapshot of the latest id. Storing
  // the id itself would become stale as soon as another dispatch is appended. Selecting an older
  // record leaves follow mode; navigating back to the newest record resumes it.
  const [requestedId, setRequestedId] = createSignal<number | null>(null);
  const record = createMemo(() => {
    const currentRecords = records();
    const latest = currentRecords.at(-1);
    const requested = requestedId();
    return requested === null
      ? latest
      : (currentRecords.find((item) => item.id === requested) ?? latest);
  });
  const selectedId = createMemo(() => record()?.id ?? 0);
  const select = (id: number): void => {
    setRequestedId(id === records().at(-1)?.id ? null : id);
  };

  return { record, selectedId, select };
}
