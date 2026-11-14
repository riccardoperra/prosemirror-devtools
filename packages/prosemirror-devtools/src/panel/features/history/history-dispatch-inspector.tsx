import { createSignal, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";
import { ViewSwitch } from "../../ui/view-switch";

import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { DispatchInspector } from "../dispatch/dispatch-inspector";
import { DispatchEffects } from "../dispatch/dispatch-effects";
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
        <ViewSwitch
          label="Transaction inspection mode"
          onChange={setMode}
          options={[
            { value: "details", label: "Transaction details" },
            { value: "changes", label: "Changes & mapping" },
          ]}
          value={mode()}
        />
      </div>
      <DispatchEffects record={props.record} showRaw />
      <Show when={mode() === "details"} fallback={<ChangesView record={props.record} />}>
        <DispatchInspector.DetailsWorkspace>
          <DispatchInspector.TransactionDetails />
        </DispatchInspector.DetailsWorkspace>
      </Show>
    </DispatchInspector.Root>
  );
}
