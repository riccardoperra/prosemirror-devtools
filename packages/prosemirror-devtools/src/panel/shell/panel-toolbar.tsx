import type { ReactElement } from "react";

import { usePanelAppearance, usePanelStore } from "../panel-provider";
import { useActiveInstanceId, useInstanceDescriptors } from "../store/selectors";

export function PanelToolbar(): ReactElement {
  const store = usePanelStore();
  const activeInstanceId = useActiveInstanceId();
  const instances = useInstanceDescriptors();
  const { density, themeChoice, resolvedTheme, toggleDensity, cycleTheme } = usePanelAppearance();

  return (
    <div className="pm-toolbar">
      <div className="pm-brand">
        <span className="pm-brand-mark">PM</span>
        <span className="pm-brand-copy">ProseMirror</span>
        {activeInstanceId ? <span className="pm-live" title="Instance connected" /> : null}
      </div>
      <select
        aria-label="Active ProseMirror instance"
        className="pm-instance-select"
        disabled={instances.length === 0}
        onChange={(event) => store.setActiveInstance(event.target.value)}
        value={activeInstanceId ?? ""}
      >
        {instances.length === 0 ? <option value="">No instances</option> : null}
        {instances.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <span className="pm-spacer" />
      <button
        aria-label="Toggle density"
        className="pm-icon-button"
        onClick={toggleDensity}
        title={`Density: ${density}`}
        type="button"
      >
        ↕
      </button>
      <button
        aria-label="Cycle color theme"
        className="pm-icon-button"
        onClick={cycleTheme}
        title={`Theme: ${themeChoice}`}
        type="button"
      >
        {resolvedTheme === "dark" ? "☾" : "☼"}
      </button>
    </div>
  );
}
