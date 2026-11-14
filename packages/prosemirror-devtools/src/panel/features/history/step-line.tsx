import { Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";
import type { DispatchHeadline, StepSummary } from "./summarize-dispatch";

/** A step in words. Inline, so a row can truncate it with an ellipsis. */
export function StepLine(props: { step: StepSummary }): JSX.Element {
  return (
    <span class={panelStyles.pmStepLine}>
      <span class={panelStyles.pmStepAction}>{props.step.action}</span>
      <Show when={props.step.subject}>
        {(subject) => (
          <>
            {" "}
            <span class={panelStyles.pmStepSubject}>{subject()}</span>
          </>
        )}
      </Show>
      <Show when={props.step.at}>
        {(at) => (
          <>
            {" "}
            <span class={panelStyles.pmStepAt}>{at()}</span>
          </>
        )}
      </Show>
    </span>
  );
}

export function DispatchHeadlineText(props: { headline: DispatchHeadline }): JSX.Element {
  return (
    <>
      <Show
        when={props.headline.step}
        fallback={
          <span class={panelStyles.pmStepLine}>
            <span class={panelStyles.pmStepAction}>{props.headline.title}</span>
          </span>
        }
      >
        {(step) => <StepLine step={step()} />}
      </Show>
      <Show when={props.headline.more > 0}>
        {" "}
        <span class={panelStyles.pmStepAt}>+{props.headline.more} more</span>
      </Show>
    </>
  );
}
