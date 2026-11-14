import { createMemo, For, Show, type JSX } from "solid-js";

import type { InspectionQuery } from "../../inspection/types";
import type { ProseMirrorDevtoolsTab } from "../panel.types";
import { usePanelInspection } from "../panel-provider";
import { JsonTree } from "../json-tree";
import { panelStyles } from "../styles";
import { InspectionReadout } from "../ui/inspection-readout";

const historicalQueries: Partial<
  Record<ProseMirrorDevtoolsTab, readonly { label: string; query: InspectionQuery }[]>
> = {
  state: [
    { label: "Historical document", query: { kind: "document" } },
    { label: "Historical selection", query: { kind: "selection" } },
  ],
  selection: [{ label: "Historical selection", query: { kind: "selection" } }],
  schema: [{ label: "Historical schema", query: { kind: "schema" } }],
  plugins: [
    { label: "Historical plugin state", query: { kind: "plugins" } },
    { label: "Captured inspector projections", query: { kind: "contributions" } },
  ],
  decorations: [
    { label: "Historical decorations", query: { kind: "decorations" } },
    { label: "Historical NodeViews", query: { kind: "nodeViews" } },
  ],
};

export function HistoricalPanel(props: { panel: ProseMirrorDevtoolsTab }): JSX.Element {
  const inspection = usePanelInspection();
  const queries = createMemo(() => historicalQueries[props.panel] ?? []);
  return (
    <div class={panelStyles.pmScroll}>
      <p class={panelStyles.pmPerformanceNote}>
        This pane reads the selected historical point. Current editor state and DOM positions are
        available after choosing Follow live.
      </p>
      <For each={queries()}>
        {({ label, query }) => {
          const result = createMemo(() => inspection.read(query));
          return (
            <Show
              when={result()}
              fallback={
                <p role="status" class={panelStyles.pmWarning}>
                  This editor does not provide inspection read points.
                </p>
              }
            >
              {(value) => <InspectionReadout label={label} result={value()} />}
            </Show>
          );
        }}
      </For>
      <Show when={props.panel === "plugins" && inspection.transaction()}>
        <section aria-label="Captured plugin hook timings" class={panelStyles.pmSection}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>Captured plugin hook timings</span>
          </div>
          <JsonTree value={inspection.transaction()?.timings} defaultExpandedDepth={1} />
        </section>
      </Show>
    </div>
  );
}
