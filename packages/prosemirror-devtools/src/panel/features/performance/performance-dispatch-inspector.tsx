import type { ReactElement } from "react";

import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { DispatchInspector } from "../dispatch/dispatch-inspector";
import { DispatchCostBreakdown } from "./dispatch-cost/dispatch-cost-breakdown";

export function PerformanceDispatchInspector({
  instance,
  record,
}: {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
}): ReactElement {
  return (
    <DispatchInspector.Root instance={instance} record={record}>
      <DispatchInspector.Header />
      <DispatchInspector.Metrics />
      <DispatchInspector.SplitWorkspace>
        <DispatchInspector.PluginPane>
          <DispatchCostBreakdown record={record} />
        </DispatchInspector.PluginPane>
        <DispatchInspector.TransactionDetails />
      </DispatchInspector.SplitWorkspace>
    </DispatchInspector.Root>
  );
}
