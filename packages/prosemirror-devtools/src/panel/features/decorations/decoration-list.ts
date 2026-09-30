import type { DevtoolsDecorationSource } from "../../../core/diagnostics";

export interface DecorationListEntry {
  id: string;
  source: DevtoolsDecorationSource;
  range: DevtoolsDecorationSource["ranges"][number];
}

/** Count retained observations while materializing only the visible page. */
export function collectDecorationRows(
  sources: readonly DevtoolsDecorationSource[],
  plugin: string,
  kind: string,
  limit: number,
): { rows: readonly DecorationListEntry[]; total: number } {
  const rows: DecorationListEntry[] = [];
  let total = 0;
  for (const source of sources) {
    if (plugin && source.pluginKey !== plugin) continue;
    if (kind === "all") {
      total += source.ranges.length;
      const count = Math.min(source.ranges.length, Math.max(0, limit - rows.length));
      for (let index = 0; index < count; index++) {
        rows.push({ id: `${source.id}:${index}`, source, range: source.ranges[index]! });
      }
    } else {
      for (let index = 0; index < source.ranges.length; index++) {
        const range = source.ranges[index]!;
        if (range.kind !== kind) continue;
        total++;
        if (rows.length < limit) rows.push({ id: `${source.id}:${index}`, source, range });
      }
    }
  }
  return { rows, total };
}
