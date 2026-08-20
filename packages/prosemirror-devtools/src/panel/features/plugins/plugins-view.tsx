import { createMemo, For, Show, type JSX } from "solid-js";

import { cx, panelStyles } from "../../styles";

import { inspectPlugins } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";
import { usePluginSelection } from "./use-plugin-selection";

export interface PluginsViewProps {
  instance: RegisteredProseMirrorInstance;
}

export function PluginsView(props: PluginsViewProps): JSX.Element {
  const plugins = createMemo(() => inspectPlugins(props.instance.view.state));
  const { query, setQuery, filtered, selected, select } = usePluginSelection(plugins);

  return (
    <div class={panelStyles.pmSplit}>
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <input
            aria-label="Search plugins"
            class={panelStyles.pmSearch}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Filter plugins…"
            value={query()}
          />
        </div>
        <ul class={panelStyles.pmList}>
          <For each={filtered()}>
            {(plugin) => (
              <li>
                <button
                  aria-selected={selected()?.key === plugin.key}
                  class={panelStyles.pmListRow}
                  onClick={() => select(plugin.key)}
                  type="button"
                >
                  <span class={panelStyles.pmRowMain}>
                    <span class={cx(panelStyles.pmRowTitle, panelStyles.pmMono)}>{plugin.key}</span>
                    <span class={panelStyles.pmRowDetail}>
                      {plugin.props.length} props · index {plugin.index}
                    </span>
                  </span>
                  <Badge tone={plugin.hasState ? "green" : undefined}>
                    {plugin.hasState ? "state" : "stateless"}
                  </Badge>
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
      <div class={panelStyles.pmPane}>
        <Show
          when={selected()}
          fallback={<div class={panelStyles.pmEmpty}>No matching plugins.</div>}
        >
          {(plugin) => (
            <>
              <div class={panelStyles.pmDetailHeading}>
                <span class={panelStyles.pmSectionTitle}>{plugin().key}</span>
                <span class={panelStyles.pmSpacer} />
                <Badge>{plugin().props.join(", ") || "no props"}</Badge>
              </div>
              <JsonTree value={plugin().state} />
            </>
          )}
        </Show>
      </div>
    </div>
  );
}
