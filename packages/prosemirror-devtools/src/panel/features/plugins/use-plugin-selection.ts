import { useMemo, useState } from "react";

import type { PluginInspection } from "../../../core/types";

export function usePluginSelection(plugins: readonly PluginInspection[]): {
  query: string;
  setQuery: (query: string) => void;
  filtered: readonly PluginInspection[];
  selected: PluginInspection | undefined;
  select: (key: string) => void;
} {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(plugins[0]?.key ?? "");
  const normalizedQuery = query.toLowerCase();
  const filtered = useMemo(
    () => plugins.filter((plugin) => plugin.key.toLowerCase().includes(normalizedQuery)),
    [plugins, normalizedQuery],
  );
  const selected = filtered.find((plugin) => plugin.key === selectedKey) ?? filtered[0];

  return { query, setQuery, filtered, selected, select: setSelectedKey };
}
