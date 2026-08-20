import type { JSX } from "solid-js";

import { panelStyles } from "../styles";

export interface BadgeProps {
  children: JSX.Element;
  tone?: "green" | "yellow" | "red" | "blue" | undefined;
}

export function Badge(props: BadgeProps): JSX.Element {
  return (
    <span class={panelStyles.pmBadge} data-tone={props.tone}>
      {props.children}
    </span>
  );
}
