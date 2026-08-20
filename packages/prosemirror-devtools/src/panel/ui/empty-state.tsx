import type { JSX } from "solid-js";

export function EmptyState(): JSX.Element {
  return (
    <div class="pm-empty">
      <div>
        <div class="pm-empty-mark">PM</div>
        <div>No ProseMirror instances are registered.</div>
        <div class="pm-muted pm-mono" style={{ "margin-top": "5px" }}>
          Call attachProseMirrorDevtools({`{ view, id }`}).
        </div>
      </div>
    </div>
  );
}
