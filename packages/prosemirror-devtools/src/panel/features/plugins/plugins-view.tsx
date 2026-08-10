import { useMemo } from "react";
import type { ReactElement } from "react";

import { inspectPlugins } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";
import { usePluginSelection } from "./use-plugin-selection";

export function PluginsView({
  instance,
}: {
  instance: RegisteredProseMirrorInstance;
}): ReactElement {
  const plugins = useMemo(() => inspectPlugins(instance.view.state), [instance.view.state]);
  const { query, setQuery, filtered, selected, select } = usePluginSelection(plugins);

  return (
    <div className="pm-split">
      <div className="pm-pane">
        <div className="pm-pane-header">
          <input
            aria-label="Search plugins"
            className="pm-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter plugins…"
            value={query}
          />
        </div>
        <ul className="pm-list">
          {filtered.map((plugin) => (
            <li key={plugin.key}>
              <button
                aria-selected={selected?.key === plugin.key}
                className="pm-list-row"
                onClick={() => select(plugin.key)}
                type="button"
              >
                <span className="pm-row-main">
                  <span className="pm-row-title pm-mono">{plugin.key}</span>
                  <span className="pm-row-detail">
                    {plugin.props.length} props · index {plugin.index}
                  </span>
                </span>
                <Badge tone={plugin.hasState ? "green" : undefined}>
                  {plugin.hasState ? "state" : "stateless"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="pm-pane">
        {selected ? (
          <>
            <div className="pm-detail-heading">
              <span className="pm-section-title">{selected.key}</span>
              <span className="pm-spacer" />
              <Badge>{selected.props.join(", ") || "no props"}</Badge>
            </div>
            <JsonTree value={selected.state} />
          </>
        ) : (
          <div className="pm-empty">No matching plugins.</div>
        )}
      </div>
    </div>
  );
}
