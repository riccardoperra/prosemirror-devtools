import type { JSX } from "solid-js";

import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { DispatchInspector } from "../dispatch/dispatch-inspector";
import { DispatchCostBreakdown } from "./dispatch-cost/dispatch-cost-breakdown";

export interface PerformanceDispatchInspectorProps {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
}

export function PerformanceDispatchInspector(
  props: PerformanceDispatchInspectorProps,
): JSX.Element {
  return (
    <DispatchInspector.Root instance={props.instance} record={props.record}>
      <DispatchInspector.Header />
      <DispatchInspector.Metrics />
      <DispatchInspector.SplitWorkspace>
        <DispatchInspector.PluginPane>
          <DispatchCostBreakdown record={props.record} />
        </DispatchInspector.PluginPane>
        <DispatchInspector.TransactionDetails />
      </DispatchInspector.SplitWorkspace>
    </DispatchInspector.Root>
  );
}
