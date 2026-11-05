import type { DevtoolsDataActions, DevtoolsDataClient } from "./data-client";
import type { SerializedValue, TransactionRecord } from "./types";

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

export interface DevtoolsDispatchPresentation {
  readonly label: string;
  readonly text: string;
  readonly note?: string;
  readonly badge?: string;
  /** Also show this text and the optional badge in the Transactions list. */
  readonly listLabel?: string;
}

export interface DevtoolsDispatchPresenter {
  readonly inspectorId: string;
  readonly version: string;
  /** Present one retained, available projection. Return undefined to hide it. */
  present(input: DevtoolsDispatchPresentationInput): DevtoolsDispatchPresentation | undefined;
}

export interface DevtoolsDispatchPresentationInput {
  readonly value: SerializedValue;
  readonly record: TransactionRecord;
}

/** A modular group of panels and optional presenters for a panel host. */
export interface DevtoolsExtension {
  readonly id: string;
  readonly panels: readonly DevtoolsPanelExtension[];
  readonly dispatchPresenters?: readonly DevtoolsDispatchPresenter[];
}
