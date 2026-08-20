import type { JSX } from "solid-js";

export interface BadgeProps {
  children: JSX.Element;
  tone?: "green" | "yellow" | "red" | "blue" | undefined;
}

export function Badge(props: BadgeProps): JSX.Element {
  return (
    <span class="pm-badge" data-tone={props.tone}>
      {props.children}
    </span>
  );
}
