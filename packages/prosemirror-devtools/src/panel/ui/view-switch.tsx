import { Index, type JSX } from "solid-js";

import { panelStyles } from "../styles";

export interface ViewSwitchOption<T extends string> {
  readonly value: T;
  readonly label: JSX.Element;
  /** Accessible name when the visible label is not descriptive enough. */
  readonly ariaLabel?: string;
}

/**
 * Two to four mutually exclusive views of the same data. See DESIGN.md, "View switch".
 */
export function ViewSwitch<T extends string>(props: {
  /** Accessible name of the group. */
  label: string;
  value: T;
  options: readonly ViewSwitchOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div aria-label={props.label} class={panelStyles.pmViewSwitch} role="group">
      {/* Index keeps each button node stable while labels such as counts change. */}
      <Index each={props.options}>
        {(option) => (
          <button
            aria-label={option().ariaLabel}
            aria-pressed={props.value === option().value}
            class={panelStyles.pmViewSwitchOption}
            disabled={props.disabled}
            onClick={() => props.onChange(option().value)}
            type="button"
          >
            {option().label}
          </button>
        )}
      </Index>
    </div>
  );
}
