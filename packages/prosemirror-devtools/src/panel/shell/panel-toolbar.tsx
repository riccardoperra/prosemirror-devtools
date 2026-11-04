import { For, Show, type JSX } from "solid-js";

import { panelStyles } from "../styles";

import { usePanelAppearance, usePanelDataAccess } from "../panel-provider";
import { useActiveInstanceId, useInstanceDescriptors } from "../store/selectors";

export interface PanelToolbarProps {
  embedded: boolean;
}

export function PanelToolbar(props: PanelToolbarProps): JSX.Element {
  const { actions } = usePanelDataAccess();
  const activeInstanceId = useActiveInstanceId();
  const instances = useInstanceDescriptors();
  const appearance = usePanelAppearance();

  return (
    <div class={panelStyles.pmToolbar}>
      <Show when={!props.embedded}>
        <div class={panelStyles.pmBrand}>
          <span aria-hidden="true" class={panelStyles.pmBrandMark}>
            PM
          </span>
          <span class={panelStyles.pmBrandCopy}>ProseMirror</span>
        </div>
      </Show>
      <Show when={activeInstanceId()}>
        <span aria-hidden="true" class={panelStyles.pmLive} title="Instance connected" />
      </Show>
      <select
        aria-label="Active ProseMirror instance"
        class={panelStyles.pmInstanceSelect}
        disabled={instances().length === 0}
        onChange={(event) => actions.setActiveInstance(event.currentTarget.value)}
        value={activeInstanceId() ?? ""}
      >
        <Show when={instances().length > 0} fallback={<option value="">No instances</option>}>
          <For each={instances()}>
            {(item) => (
              <option value={item.id}>
                {item.label === item.id ? item.id : `${item.label} (${item.id})`}
              </option>
            )}
          </For>
        </Show>
      </select>
      <Show when={!props.embedded}>
        <span class={panelStyles.pmSpacer} />
        <button
          aria-label="Cycle color theme"
          class={panelStyles.pmIconButton}
          onClick={appearance.cycleTheme}
          title={`Theme: ${appearance.themeChoice()}`}
          type="button"
        >
          {appearance.resolvedTheme() === "dark" ? "☾" : "☼"}
        </button>
      </Show>
    </div>
  );
}
