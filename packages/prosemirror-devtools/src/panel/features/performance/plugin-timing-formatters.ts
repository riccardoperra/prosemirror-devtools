import { formatMs } from "../../formatters";

export type PluginHookFamily = "state" | "transaction" | "view" | "props";

export function formatTimelineOffset(value: number): string {
  return value === 0 ? "0 ms" : formatMs(value);
}

export function hookFamily(hook: string): PluginHookFamily {
  if (hook.startsWith("state.")) return "state";
  if (hook === "filterTransaction" || hook === "appendTransaction") return "transaction";
  if (hook === "props.decorations") return "view";
  if (hook.startsWith("view.") || hook.startsWith("nodeView.")) return "view";
  return "props";
}

export function hookLabel(hook: string): string {
  return hook === "props.decorations" ? "Decoration change" : hook;
}

export function hookTitle(hook: string, calls: number, maxDuration: number): string {
  const timing = `${calls} ${calls === 1 ? "call" : "calls"}; max ${formatMs(maxDuration)}`;
  return hook === "props.decorations"
    ? `DecorationSet producer (props.decorations); later mapping and reconciliation stay in view update. ${timing}`
    : timing;
}
