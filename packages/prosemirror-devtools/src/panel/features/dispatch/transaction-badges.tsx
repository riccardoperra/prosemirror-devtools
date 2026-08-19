import type { ReactElement } from "react";

import type { TransactionRecord } from "../../../core/types";
import { Badge } from "../../ui/badge";

export function TransactionBadges({ record }: { record: TransactionRecord }): ReactElement {
  return (
    <>
      {record.docChanged ? <Badge tone="green">doc</Badge> : null}
      {record.selectionSet ? <Badge tone="blue">selection</Badge> : null}
      {record.appendedTransactionCount != null && record.appendedTransactionCount > 0 ? (
        <Badge tone="yellow">+{record.appendedTransactionCount}</Badge>
      ) : null}
      {record.filtered ? <Badge tone="red">filtered</Badge> : null}
      {record.applicationStatus === "unknown" ? <Badge tone="yellow">custom</Badge> : null}
      {record.error ? <Badge tone="red">error</Badge> : null}
    </>
  );
}
