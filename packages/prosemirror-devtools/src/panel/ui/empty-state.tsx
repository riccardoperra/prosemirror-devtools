import type { ReactElement } from "react";

export function EmptyState(): ReactElement {
  return (
    <div className="pm-empty">
      <div>
        <div className="pm-empty-mark">PM</div>
        <div>No ProseMirror instances are registered.</div>
        <div className="pm-muted pm-mono" style={{ marginTop: 5 }}>
          Call attachProseMirrorDevtools({`{ view, id }`}).
        </div>
      </div>
    </div>
  );
}
