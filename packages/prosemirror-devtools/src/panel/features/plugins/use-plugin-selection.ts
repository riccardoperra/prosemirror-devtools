import { createMemo, createSignal, type Accessor } from "solid-js";

import type { PluginInspection } from "../../../core/types";
import { useOptionalPanelInspection } from "../../panel-provider";

export function usePluginSelection(plugins: Accessor<readonly PluginInspection[]>): {
  query: Accessor<string>;
  setQuery: (query: string) => void;
  filtered: Accessor<readonly PluginInspection[]>;
  selected: Accessor<PluginInspection | undefined>;
  select: (key: string) => void;
} {
  const [query, setQuery] = createSignal("");
  const [selectedKey, setSelectedKey] = createSignal(plugins()[0]?.key ?? "");
  const inspection = useOptionalPanelInspection();
  const filtered = createMemo(() => {
    const normalizedQuery = query().toLowerCase();
    return plugins().filter((plugin) => plugin.key.toLowerCase().includes(normalizedQuery));
  });
  const selected = createMemo(
    () =>
      filtered().find((plugin) => plugin.key === (inspection?.pluginKey() ?? selectedKey())) ??
      filtered()[0],
  );

  return {
    query,
    setQuery,
    filtered,
    selected,
    select: (key) => (inspection ? inspection.selectPlugin(key) : setSelectedKey(key)),
  };
}
