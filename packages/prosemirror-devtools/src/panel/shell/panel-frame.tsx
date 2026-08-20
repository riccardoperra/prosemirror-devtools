import type { JSX } from "solid-js";

import { usePanelAppearance } from "../panel-provider";

export function PanelFrame(props: {
  className: string | undefined;
  embedded: boolean;
  style: JSX.CSSProperties | undefined;
  children: JSX.Element;
}): JSX.Element {
  const appearance = usePanelAppearance();

  return (
    <section
      class={["pm-devtools", props.className].filter(Boolean).join(" ")}
      data-density={appearance.density()}
      data-embedded={props.embedded ? "true" : undefined}
      data-theme={appearance.resolvedTheme()}
      style={props.style}
    >
      {props.children}
    </section>
  );
}
