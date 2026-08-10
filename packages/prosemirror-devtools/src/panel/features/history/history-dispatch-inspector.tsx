import type { ReactElement } from "react";

import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { DispatchInspector } from "../dispatch/dispatch-inspector";

export function HistoryDispatchInspector({
  instance,
  record,
}: {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
}): ReactElement {
  return (
    <DispatchInspector.Root className="pm-scroll" instance={instance} record={record}>
      <DispatchInspector.Header />
      <DispatchInspector.Metrics />
      <DispatchInspector.DetailsWorkspace>
        <DispatchInspector.TransactionDetails />
      </DispatchInspector.DetailsWorkspace>
    </DispatchInspector.Root>
  );
}
