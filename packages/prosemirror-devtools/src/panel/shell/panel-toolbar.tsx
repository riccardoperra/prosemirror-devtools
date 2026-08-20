import type { ReactElement } from "react";

import { usePanelAppearance, usePanelDataAccess } from "../panel-provider";
import { useActiveInstanceId, useInstanceDescriptors } from "../store/selectors";

export function PanelToolbar({ embedded }: { embedded: boolean }): ReactElement {
  const { actions } = usePanelDataAccess();
  const activeInstanceId = useActiveInstanceId();
  const instances = useInstanceDescriptors();
  const { themeChoice, resolvedTheme, cycleTheme } = usePanelAppearance();

  return (
    <div className="pm-toolbar">
      {embedded ? null : (
        <div className="pm-brand">
          <span className="pm-brand-mark">PM</span>
          <span className="pm-brand-copy">ProseMirror</span>
        </div>
      )}
      {activeInstanceId ? <span className="pm-live" title="Instance connected" /> : null}
      <select
        aria-label="Active ProseMirror instance"
        className="pm-instance-select"
        disabled={instances.length === 0}
        onChange={(event) => actions.setActiveInstance(event.target.value)}
        value={activeInstanceId ?? ""}
      >
        {instances.length === 0 ? <option value="">No instances</option> : null}
        {instances.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      {embedded ? null : (
        <>
          <span className="pm-spacer" />
          <button
            aria-label="Cycle color theme"
            className="pm-icon-button"
            onClick={cycleTheme}
            title={`Theme: ${themeChoice}`}
            type="button"
          >
            {resolvedTheme === "dark" ? "☾" : "☼"}
          </button>
        </>
      )}
    </div>
  );
}
