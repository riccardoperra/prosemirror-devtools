import { createMemo, For, Show, type JSX } from "solid-js";

import { inspectPlugins } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";
import { usePluginSelection } from "./use-plugin-selection";

export function PluginsView(props: { instance: RegisteredProseMirrorInstance }): JSX.Element {
  const plugins = createMemo(() => inspectPlugins(props.instance.view.state));
  const { query, setQuery, filtered, selected, select } = usePluginSelection(plugins);

  return (
    <div class="pm-split">
      <div class="pm-pane">
        <div class="pm-pane-header">
          <input
            aria-label="Search plugins"
            class="pm-search"
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Filter plugins…"
            value={query()}
          />
        </div>
        <ul class="pm-list">
          <For each={filtered()}>
            {(plugin) => (
              <li>
                <button
                  aria-selected={selected()?.key === plugin.key}
                  class="pm-list-row"
                  onClick={() => select(plugin.key)}
                  type="button"
                >
                  <span class="pm-row-main">
                    <span class="pm-row-title pm-mono">{plugin.key}</span>
                    <span class="pm-row-detail">
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
      <div class="pm-pane">
        <Show when={selected()} fallback={<div class="pm-empty">No matching plugins.</div>}>
          {(plugin) => (
            <>
              <div class="pm-detail-heading">
                <span class="pm-section-title">{plugin().key}</span>
                <span class="pm-spacer" />
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
