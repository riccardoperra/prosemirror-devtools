import { Show, type JSX } from "solid-js";

import { cx, panelStyles } from "../styles";

export interface EmptyStateProps {
  /** One sentence saying what will appear here, or "Loading …". */
  children: JSX.Element;
  /** Optional second sentence saying how to make content appear. */
  detail?: JSX.Element;
  /** Optional single action, for example a button. */
  action?: JSX.Element;
  /** Optional decorative mark shown above the text. */
  mark?: JSX.Element;
  /** Use "status" for loading and other transient states that should be announced. */
  role?: "status" | undefined;
  class?: string | undefined;
}

/**
 * The single empty and loading state for panes, lists and sections. It centers muted text in the
 * available area of its container.
 */
export function EmptyState(props: EmptyStateProps): JSX.Element {
  return (
    <div class={cx(panelStyles.pmEmptyState, props.class)} role={props.role}>
      <div class={panelStyles.pmEmptyStateContent}>
        <Show when={props.mark}>{props.mark}</Show>
        <p class={panelStyles.pmEmptyStateText}>{props.children}</p>
        <Show when={props.detail}>
          <p class={panelStyles.pmEmptyStateDetail}>{props.detail}</p>
        </Show>
        <Show when={props.action}>
          <div class={panelStyles.pmEmptyStateAction}>{props.action}</div>
        </Show>
      </div>
    </div>
  );
}

/** Shown when no ProseMirror view is registered with the inspector. */
export function NoInstancesState(): JSX.Element {
  return (
    <EmptyState
      detail={
        <span class={panelStyles.pmMono}>Call attachProseMirrorDevtools({`{ view, id }`}).</span>
      }
      mark={
        <div aria-hidden="true" class={panelStyles.pmEmptyMark}>
          PM
        </div>
      }
    >
      No ProseMirror instances are registered.
    </EmptyState>
  );
}
