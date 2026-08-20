import type { JSX } from "solid-js";

import { panelStyles } from "../../styles";

import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { DispatchInspector } from "../dispatch/dispatch-inspector";

export interface HistoryDispatchInspectorProps {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
}

export function HistoryDispatchInspector(props: HistoryDispatchInspectorProps): JSX.Element {
  return (
    <DispatchInspector.Root
      className={panelStyles.pmScroll}
      instance={props.instance}
      record={props.record}
    >
      <DispatchInspector.Header />
      <DispatchInspector.Metrics />
      <DispatchInspector.DetailsWorkspace>
        <DispatchInspector.TransactionDetails />
      </DispatchInspector.DetailsWorkspace>
    </DispatchInspector.Root>
  );
}
