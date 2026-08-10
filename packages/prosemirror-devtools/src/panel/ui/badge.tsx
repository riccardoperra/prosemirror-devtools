import type { ReactElement, ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  tone?: "green" | "yellow" | "red" | "blue" | undefined;
}

export function Badge({ children, tone }: BadgeProps): ReactElement {
  return (
    <span className="pm-badge" data-tone={tone}>
      {children}
    </span>
  );
}
