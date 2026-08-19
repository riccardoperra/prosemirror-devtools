import { useCallback, useState } from "react";

import type { TransactionRecord } from "../../core/types";

export interface SelectedTransaction {
  record: TransactionRecord | undefined;
  selectedId: number;
  select: (id: number) => void;
}

export function useSelectedTransaction(records: readonly TransactionRecord[]): SelectedTransaction {
  // `null` is an intentional "follow latest" mode rather than a snapshot of the latest id. Storing
  // the id itself would become stale as soon as another dispatch is appended. Selecting an older
  // record leaves follow mode; navigating back to the newest record resumes it.
  const [requestedId, setRequestedId] = useState<number | null>(null);
  const latest = records.at(-1);
  const record =
    requestedId === null ? latest : (records.find((item) => item.id === requestedId) ?? latest);
  const latestId = latest?.id;
  const select = useCallback(
    (id: number) => {
      setRequestedId(id === latestId ? null : id);
    },
    [latestId],
  );

  return {
    record,
    selectedId: record?.id ?? 0,
    select,
  };
}
