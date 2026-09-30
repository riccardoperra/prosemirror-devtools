import type { ProseMirrorDevtoolsPanelProps } from "../panel/panel.types";
import type {
  CreateProseMirrorDevtoolsPluginOptions,
  ProseMirrorDevtoolsAdapterPanelProps,
  ProseMirrorDevtoolsPanelInit,
  ResolvedProseMirrorDevtoolsAdapterPanelProps,
  ResolvedProseMirrorDevtoolsPluginMetadata,
} from "./types";

function assignDefinedPanelInit(
  target: ProseMirrorDevtoolsPanelInit,
  source: ProseMirrorDevtoolsPanelInit | undefined,
): void {
  if (!source) return;

  if (source.store !== undefined) target.store = source.store;
  if (source.defaultTab !== undefined) target.defaultTab = source.defaultTab;
  if (source.defaultPanel !== undefined) target.defaultPanel = source.defaultPanel;
  if (source.activePanel !== undefined) target.activePanel = source.activePanel;
  if (source.onActivePanelChange !== undefined) {
    target.onActivePanelChange = source.onActivePanelChange;
  }
  if (source.extensions !== undefined) target.extensions = source.extensions;
  if (source.performanceFrameBudgetMs !== undefined) {
    target.performanceFrameBudgetMs = source.performanceFrameBudgetMs;
  }
  if (source.performanceDetailThresholdMs !== undefined) {
    target.performanceDetailThresholdMs = source.performanceDetailThresholdMs;
  }
}

function assignDefinedPanelProps(
  target: ResolvedProseMirrorDevtoolsAdapterPanelProps,
  source: ProseMirrorDevtoolsAdapterPanelProps | undefined,
): void {
  if (!source) return;

  assignDefinedPanelInit(target, source);
  if (source.theme !== undefined) target.theme = source.theme;
  if (source.devtoolsOpen !== undefined) target.devtoolsOpen = source.devtoolsOpen;
}

export function resolveProseMirrorDevtoolsPanelInit(
  source: ProseMirrorDevtoolsPanelInit | undefined,
): ProseMirrorDevtoolsPanelInit {
  const result: ProseMirrorDevtoolsPanelInit = {};
  assignDefinedPanelInit(result, source);
  return result;
}

export function resolveProseMirrorDevtoolsPluginMetadata(
  options: CreateProseMirrorDevtoolsPluginOptions,
): ResolvedProseMirrorDevtoolsPluginMetadata {
  return {
    id: options.id ?? "prosemirror-inspector",
    name: options.name ?? "ProseMirror Inspector",
    defaultOpen: options.defaultOpen ?? false,
  };
}

export function resolveProseMirrorDevtoolsAdapterPanelProps(
  ...sources: readonly (ProseMirrorDevtoolsAdapterPanelProps | undefined)[]
): ResolvedProseMirrorDevtoolsAdapterPanelProps {
  const result: ResolvedProseMirrorDevtoolsAdapterPanelProps = {
    devtoolsOpen: true,
    theme: "dark",
  };

  for (const source of sources) assignDefinedPanelProps(result, source);
  return result;
}

export function equalProseMirrorDevtoolsAdapterPanelProps(
  previous: ResolvedProseMirrorDevtoolsAdapterPanelProps,
  next: ResolvedProseMirrorDevtoolsAdapterPanelProps,
): boolean {
  return (
    previous.store === next.store &&
    previous.defaultTab === next.defaultTab &&
    previous.defaultPanel === next.defaultPanel &&
    previous.activePanel === next.activePanel &&
    previous.onActivePanelChange === next.onActivePanelChange &&
    previous.extensions === next.extensions &&
    previous.performanceFrameBudgetMs === next.performanceFrameBudgetMs &&
    previous.performanceDetailThresholdMs === next.performanceDetailThresholdMs &&
    previous.theme === next.theme &&
    previous.devtoolsOpen === next.devtoolsOpen
  );
}

export function resolveProseMirrorDevtoolsPanelProps(
  element: HTMLElement,
  ...sources: readonly (ProseMirrorDevtoolsAdapterPanelProps | undefined)[]
): ProseMirrorDevtoolsPanelProps | null {
  const resolved = resolveProseMirrorDevtoolsAdapterPanelProps(...sources);
  if (!resolved.devtoolsOpen) return null;

  const result: ProseMirrorDevtoolsPanelProps = {
    embedded: true,
    styleTarget: element.ownerDocument,
    theme: resolved.theme,
  };

  if (resolved.store !== undefined) result.store = resolved.store;
  if (resolved.defaultTab !== undefined) result.defaultTab = resolved.defaultTab;
  if (resolved.defaultPanel !== undefined) result.defaultPanel = resolved.defaultPanel;
  if (resolved.activePanel !== undefined) result.activePanel = resolved.activePanel;
  if (resolved.onActivePanelChange !== undefined) {
    result.onActivePanelChange = resolved.onActivePanelChange;
  }
  if (resolved.extensions !== undefined) result.extensions = resolved.extensions;
  if (resolved.performanceFrameBudgetMs !== undefined) {
    result.performanceFrameBudgetMs = resolved.performanceFrameBudgetMs;
  }
  if (resolved.performanceDetailThresholdMs !== undefined) {
    result.performanceDetailThresholdMs = resolved.performanceDetailThresholdMs;
  }

  return result;
}
