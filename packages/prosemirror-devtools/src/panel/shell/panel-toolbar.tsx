import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js";

import { panelStyles } from "../styles";

import { startNodePicker } from "../features/inspector/node-picker";
import {
  usePanelAppearance,
  usePanelDataAccess,
  usePanelExperiments,
  usePanelInspection,
  usePanelNavigation,
} from "../panel-provider";
import { useActiveInstanceId, useInstanceDescriptors } from "../store/selectors";

export interface PanelToolbarProps {
  embedded: boolean;
}

type PickerState = { kind: "idle" } | { kind: "picking"; instanceId: string };

const IDLE: PickerState = { kind: "idle" };

function NodePickerButton(): JSX.Element {
  const inspection = usePanelInspection();
  const navigation = usePanelNavigation();
  const [picker, setPicker] = createSignal<PickerState>(IDLE);
  const activeId = createMemo(() => inspection.instance()?.id);
  const liveView = createMemo(() =>
    inspection.moment().kind === "live" ? inspection.instance()?.view : undefined,
  );

  createEffect(() => {
    const current = picker();
    if (current.kind !== "picking") return;
    const view = liveView();
    if (!view || view.isDestroyed || activeId() !== current.instanceId) {
      setPicker(IDLE);
      return;
    }
    onCleanup(
      startNodePicker(view, {
        onPick(pos, isRoot) {
          setPicker(IDLE);
          inspection.selectPosition({ doc: view.state.doc, pos, isRoot });
          if (navigation.panels().some(({ id }) => id === "state")) navigation.selectPanel("state");
        },
        onCancel: () => setPicker(IDLE),
      }),
    );
  });

  const toggle = (): void => {
    const instanceId = activeId();
    setPicker(
      picker().kind === "idle" && instanceId && liveView() ? { kind: "picking", instanceId } : IDLE,
    );
  };

  return (
    <button
      aria-label="Pick a node in the editor"
      aria-pressed={picker().kind === "picking"}
      class={panelStyles.pmIconButton}
      data-experimental="true"
      disabled={!liveView()}
      onClick={toggle}
      title="Pick a node in the editor (experimental). Press Escape to cancel."
      type="button"
    >
      ⌖
    </button>
  );
}

export function PanelToolbar(props: PanelToolbarProps): JSX.Element {
  const { actions } = usePanelDataAccess();
  const activeInstanceId = useActiveInstanceId();
  const instances = useInstanceDescriptors();
  const appearance = usePanelAppearance();
  const experiments = usePanelExperiments();
  const duplicateLabels = createMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const { label } of instances()) {
      if (seen.has(label)) duplicates.add(label);
      seen.add(label);
    }
    return duplicates;
  });

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
                {duplicateLabels().has(item.label) ? `${item.label} (${item.id})` : item.label}
              </option>
            )}
          </For>
        </Show>
      </select>
      <Show when={experiments().has("node-picker")}>
        <NodePickerButton />
      </Show>
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
