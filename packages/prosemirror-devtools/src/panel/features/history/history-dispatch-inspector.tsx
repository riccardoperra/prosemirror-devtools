import type { JSX } from "solid-js";

import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { DispatchInspector } from "../dispatch/dispatch-inspector";

export function HistoryDispatchInspector(props: {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
}): JSX.Element {
  return (
    <DispatchInspector.Root className="pm-scroll" instance={props.instance} record={props.record}>
      <DispatchInspector.Header />
      <DispatchInspector.Metrics />
      <DispatchInspector.DetailsWorkspace>
        <DispatchInspector.TransactionDetails />
      </DispatchInspector.DetailsWorkspace>
    </DispatchInspector.Root>
  );
}
