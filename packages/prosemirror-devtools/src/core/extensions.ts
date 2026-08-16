import type { DevtoolsDataActions, DevtoolsDataClient } from "./data-client";

export interface DevtoolsExtensionHost {
  readonly ownerDocument: Document;
  readonly theme: "light" | "dark";
  readonly density: "compact" | "comfortable";
  readonly activePanelId: string;
  selectPanel(panelId: string): void;
  /** Aborted before the panel is unmounted. */
  readonly signal: AbortSignal;
}

export interface DevtoolsExtensionContext {
  readonly data: DevtoolsDataClient;
  readonly actions: DevtoolsDataActions;
  readonly host: DevtoolsExtensionHost;
}

export interface DevtoolsPanelExtension {
  /** Unique across built-in and user-provided panel ids. */
  readonly id: string;
  readonly title: string;
  readonly order?: number;
  /** Whether the host should show its normal no-editor state when none is active. */
  readonly requiresInstance?: boolean;
  /** Mount any UI framework into the provided host element. */
  mount(container: HTMLElement, context: DevtoolsExtensionContext): void | (() => void);
}

/** A modular group of panels that can be supplied to a panel host. */
export interface DevtoolsExtension {
  readonly id: string;
  readonly panels: readonly DevtoolsPanelExtension[];
}
