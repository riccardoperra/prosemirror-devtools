import { For, Show, type JSX } from "solid-js";

import { usePanelInspection } from "../panel-provider";
import { panelStyles } from "../styles";
import { Badge } from "../ui/badge";

export function InspectionToolbar(): JSX.Element {
  const inspection = usePanelInspection();
  const historical = () => {
    const moment = inspection.moment();
    return inspection.instance() && moment.kind === "transaction" ? moment : undefined;
  };

  return (
    <Show when={historical()}>
      {(moment) => (
        <div class={panelStyles.pmInspectionToolbar} aria-label="Inspection context">
          <Badge tone={inspection.transaction() ? "blue" : "yellow"}>
            Dispatch #{moment().id} · {moment().phase}
          </Badge>
          <Show when={!inspection.transaction()}>
            <span role="status">This dispatch is unavailable in the current editor session.</span>
          </Show>
          <div class={panelStyles.pmViewSwitch} role="group" aria-label="Historical dispatch phase">
            <For each={["before", "after"] as const}>
              {(phase) => (
                <button
                  type="button"
                  aria-pressed={moment().phase === phase}
                  disabled={!inspection.transaction()}
                  onClick={() =>
                    inspection.selectTransaction({
                      instanceId: moment().target?.editorId ?? inspection.instance()?.id ?? "",
                      id: moment().id,
                      phase,
                    })
                  }
                >
                  {phase === "before" ? "Before dispatch" : "After dispatch"}
                </button>
              )}
            </For>
          </div>
          <button type="button" class={panelStyles.pmButton} onClick={inspection.followLive}>
            Follow live
          </button>
        </div>
      )}
    </Show>
  );
}
