import { createMemo, Show, type JSX } from "solid-js";

import type { InspectionResult } from "../../inspection/types";
import { JsonTree } from "../json-tree";
import { panelStyles } from "../styles";
import { Badge } from "./badge";

export function InspectionReadout(props: { result: InspectionResult; label: string }): JSX.Element {
  const available = createMemo(() => {
    const result = props.result;
    return result.kind === "available" ? { value: result.value } : undefined;
  });
  const unavailableReason = (): string => {
    const result = props.result;
    return result.kind === "available" ? "" : result.reason;
  };

  return (
    <section aria-label={props.label} class={panelStyles.pmSection}>
      <div class={panelStyles.pmDetailHeading}>
        <span class={panelStyles.pmSectionTitle}>{props.label}</span>
        <Badge tone={props.result.kind === "available" ? "green" : "yellow"}>
          {props.result.kind}
        </Badge>
        <Badge tone={props.result.coverage.complete ? undefined : "yellow"}>
          {props.result.coverage.complete ? "Complete coverage" : "Partial coverage"}
        </Badge>
        <Show when={props.result.coverage.truncated}>
          <Badge tone="yellow">Truncated</Badge>
        </Show>
      </div>
      <Show
        when={available()}
        fallback={
          <p role="status" class={panelStyles.pmSectionNote}>
            {unavailableReason()}
          </p>
        }
      >
        {(data) => <JsonTree defaultExpandedDepth={2} value={data().value} />}
      </Show>
      <details class={panelStyles.pmDisclosure} aria-label={`${props.label} coverage`}>
        <summary>Coverage and read point</summary>
        <JsonTree
          defaultExpandedDepth={2}
          value={{
            target: props.result.target,
            point: props.result.point,
            coverage: props.result.coverage,
          }}
        />
      </details>
    </section>
  );
}
