import { createSignal, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { DispatchInspector } from "../dispatch/dispatch-inspector";
import { ChangesView } from "../changes/changes-view";

export interface HistoryDispatchInspectorProps {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
}

export function HistoryDispatchInspector(props: HistoryDispatchInspectorProps): JSX.Element {
  const [mode, setMode] = createSignal<"details" | "changes">("details");
  return (
    <DispatchInspector.Root
      className={panelStyles.pmScroll}
      instance={props.instance}
      record={props.record}
    >
      <DispatchInspector.Header />
      <DispatchInspector.Metrics />
      <div class={panelStyles.pmPaneHeader}>
        <div class={panelStyles.pmViewSwitch} role="group" aria-label="History inspection mode">
          <button
            type="button"
            aria-pressed={mode() === "details"}
            onClick={() => setMode("details")}
          >
            Transaction details
          </button>
          <button
            type="button"
            aria-pressed={mode() === "changes"}
            onClick={() => setMode("changes")}
          >
            Changes & mapping
          </button>
        </div>
      </div>
      <Show when={mode() === "details"} fallback={<ChangesView record={props.record} />}>
        <DispatchInspector.DetailsWorkspace>
          <DispatchInspector.TransactionDetails />
        </DispatchInspector.DetailsWorkspace>
      </Show>
    </DispatchInspector.Root>
  );
}
