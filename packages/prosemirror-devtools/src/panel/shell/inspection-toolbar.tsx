import { Show, type JSX } from "solid-js";

import { usePanelInspection } from "../panel-provider";
import { panelStyles } from "../styles";
import { ViewSwitch } from "../ui/view-switch";
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
          <ViewSwitch
            disabled={!inspection.transaction()}
            label="Historical dispatch phase"
            onChange={(phase) =>
              inspection.selectTransaction({
                instanceId: moment().target?.editorId ?? inspection.instance()?.id ?? "",
                id: moment().id,
                phase,
              })
            }
            options={[
              { value: "before", label: "Before dispatch" },
              { value: "after", label: "After dispatch" },
            ]}
            value={moment().phase}
          />
          <button type="button" class={panelStyles.pmButton} onClick={inspection.followLive}>
            Follow live
          </button>
        </div>
      )}
    </Show>
  );
}
