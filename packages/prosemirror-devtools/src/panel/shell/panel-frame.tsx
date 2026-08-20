import type { CSSProperties, ReactElement, ReactNode } from "react";

import { usePanelAppearance } from "../panel-provider";

export function PanelFrame({
  className,
  embedded,
  style,
  children,
}: {
  className: string | undefined;
  embedded: boolean;
  style: CSSProperties | undefined;
  children: ReactNode;
}): ReactElement {
  const { density, resolvedTheme } = usePanelAppearance();

  return (
    <section
      className={["pm-devtools", className].filter(Boolean).join(" ")}
      data-density={density}
      data-embedded={embedded ? "true" : undefined}
      data-theme={resolvedTheme}
      style={style}
    >
      {children}
    </section>
  );
}
