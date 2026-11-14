import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type { TransactionRecord } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { useOptionalPanelContext } from "../../panel-provider";
import { panelStyles } from "../../styles";
import { Badge } from "../../ui/badge";
import { readDispatchEffects } from "./read-dispatch-effects";

export function DispatchEffects(props: {
  record: TransactionRecord;
  showRaw?: boolean;
}): JSX.Element {
  const panel = useOptionalPanelContext();
  const observations = createMemo(() =>
    readDispatchEffects(props.record, panel?.dispatchPresenters()),
  );
  const [open, setOpen] = createSignal(false);
  return (
    <Show when={observations().length > 0}>
      <section aria-label="Captured dispatch effects" class={panelStyles.pmDispatchEffects}>
        <For each={observations()}>
          {({ effect }) => (
            <p>
              <Show when={effect.badge}>{(badge) => <Badge tone="blue">{badge()}</Badge>}</Show>{" "}
              <strong>{effect.label}</strong> {effect.text}
              <Show when={effect.note}>{(note) => <small>{note()}</small>}</Show>
            </p>
          )}
        </For>
        <Show when={props.showRaw}>
          <details
            class={panelStyles.pmDisclosure}
            onToggle={(event) => setOpen(event.currentTarget.open)}
          >
            <summary>Raw effect samples</summary>
            <Show when={open()}>
              <JsonTree
                defaultExpandedDepth={1}
                value={observations().map(({ projection }) => projection)}
              />
            </Show>
          </details>
        </Show>
      </section>
    </Show>
  );
}
