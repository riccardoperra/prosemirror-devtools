import type { JSX } from "solid-js";

import { cx, panelStyles } from "../styles";

export function EmptyState(): JSX.Element {
  return (
    <div class={panelStyles.pmEmpty}>
      <div>
        <div class={panelStyles.pmEmptyMark}>PM</div>
        <div>No ProseMirror instances are registered.</div>
        <div class={cx(panelStyles.pmMuted, panelStyles.pmMono)} style={{ "margin-top": "5px" }}>
          Call attachProseMirrorDevtools({`{ view, id }`}).
        </div>
      </div>
    </div>
  );
}
