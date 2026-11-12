export * from "./core";
export { createProseMirrorWebMcpInspector } from "./panel/features/webmcp/webmcp-extension";
export type { WebMcpInspectorOptions } from "./core/webmcp";
export type { WebMcpTool } from "./core/webmcp-registration";
export { proseMirrorDevtoolsCssVariables, type ProseMirrorDevtoolsCssVariable } from "./styles";
export {
  ProseMirrorDevtoolsPanel,
  type ProseMirrorDevtoolsPanelProps,
  type ProseMirrorDevtoolsPanelStyle,
  type ProseMirrorDevtoolsTab,
} from "./panel/panel";
