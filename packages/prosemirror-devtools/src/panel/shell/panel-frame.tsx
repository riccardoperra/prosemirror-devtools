import type { JSX } from "solid-js";

import { cx, panelStyles } from "../styles";

import { usePanelAppearance } from "../panel-provider";
import type { ProseMirrorDevtoolsPanelStyle } from "../panel.types";

export interface PanelFrameProps {
  className: string | undefined;
  embedded: boolean;
  style: ProseMirrorDevtoolsPanelStyle | undefined;
  children: JSX.Element;
}

export function PanelFrame(props: PanelFrameProps): JSX.Element {
  const appearance = usePanelAppearance();

  return (
    <section
      aria-label="ProseMirror Devtools"
      class={cx(panelStyles.pmDevtools, props.className)}
      data-density={appearance.density()}
      data-embedded={props.embedded ? "true" : undefined}
      data-theme={appearance.resolvedTheme()}
      style={props.style}
    >
      {props.children}
    </section>
  );
}
