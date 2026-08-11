import { useCallback, useState } from "react";

import type { TransactionRecord } from "../../core/types";

export interface SelectedTransaction {
  record: TransactionRecord | undefined;
  selectedId: number;
  select: (id: number) => void;
}

export function useSelectedTransaction(records: readonly TransactionRecord[]): SelectedTransaction {
  const newestId = records.at(-1)?.id ?? 0;
  const [selection, setSelection] = useState(() => ({ newestId, requestedId: newestId }));
  const requestedId = selection.newestId === newestId ? selection.requestedId : newestId;
  const record = records.find((item) => item.id === requestedId) ?? records.at(-1);
  const select = useCallback(
    (id: number) => {
      setSelection({ newestId, requestedId: id });
    },
    [newestId],
  );

  return {
    record,
    selectedId: record?.id ?? 0,
    select,
  };
}
