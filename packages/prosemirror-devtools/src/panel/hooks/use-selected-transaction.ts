import { useState } from "react";

import type { TransactionRecord } from "../../core/types";

export interface SelectedTransaction {
  record: TransactionRecord | undefined;
  selectedId: number;
  select: (id: number) => void;
}

export function useSelectedTransaction(records: readonly TransactionRecord[]): SelectedTransaction {
  const [requestedId, setRequestedId] = useState(records.at(-1)?.id ?? 0);
  const record = records.find((item) => item.id === requestedId) ?? records.at(-1);

  return {
    record,
    selectedId: record?.id ?? 0,
    select: setRequestedId,
  };
}
