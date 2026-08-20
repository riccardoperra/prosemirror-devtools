import { For, Show, type JSX } from "solid-js";

import { usePanelAppearance, usePanelDataAccess } from "../panel-provider";
import { useActiveInstanceId, useInstanceDescriptors } from "../store/selectors";

export function PanelToolbar(props: { embedded: boolean }): JSX.Element {
  const { actions } = usePanelDataAccess();
  const activeInstanceId = useActiveInstanceId();
  const instances = useInstanceDescriptors();
  const appearance = usePanelAppearance();

  return (
    <div class="pm-toolbar">
      <Show when={!props.embedded}>
        <div class="pm-brand">
          <span class="pm-brand-mark">PM</span>
          <span class="pm-brand-copy">ProseMirror</span>
        </div>
      </Show>
      <Show when={activeInstanceId()}>
        <span class="pm-live" title="Instance connected" />
      </Show>
      <select
        aria-label="Active ProseMirror instance"
        class="pm-instance-select"
        disabled={instances().length === 0}
        onChange={(event) => actions.setActiveInstance(event.currentTarget.value)}
        value={activeInstanceId() ?? ""}
      >
        <Show when={instances().length > 0} fallback={<option value="">No instances</option>}>
          <For each={instances()}>{(item) => <option value={item.id}>{item.label}</option>}</For>
        </Show>
      </select>
      <Show when={!props.embedded}>
        <span class="pm-spacer" />
        <button
          aria-label="Cycle color theme"
          class="pm-icon-button"
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
