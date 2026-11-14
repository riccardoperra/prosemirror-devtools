import type { Node as ProseMirrorNode } from "prosemirror-model";
import { createMemo, For, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";
import { Badge } from "../../ui/badge";
import { diffDocuments } from "./document-diff";

const MARKERS = { same: " ", add: "+", del: "−", fold: " " } as const;

/** What a dispatch changed in the document, as a folded JSON diff. */
export function DocumentDiffView(props: {
  before: ProseMirrorNode;
  after: ProseMirrorNode;
}): JSX.Element {
  const diff = createMemo(() => diffDocuments(props.before, props.after));

  return (
    <section aria-label="Document changes" class={panelStyles.pmSection}>
      <div class={panelStyles.pmDetailHeading}>
        <span class={panelStyles.pmSectionTitle}>Document changes</span>
        <Show when={diff().range}>
          {(range) => (
            <Badge tone="green">
              {range().from}–{range().oldTo} → {range().from}–{range().newTo}
            </Badge>
          )}
        </Show>
        <span class={panelStyles.pmSpacer} />
        <span class={panelStyles.pmMuted}>
          size {props.before.content.size} → {props.after.content.size}
        </span>
      </div>
      <Show
        when={diff().lines.length > 0}
        fallback={<p class={panelStyles.pmSectionNote}>The document is unchanged.</p>}
      >
        <div aria-label="Document diff" class={panelStyles.pmDiff} role="list">
          <For each={diff().lines}>
            {(line) => (
              <div
                class={panelStyles.pmDiffLine}
                data-kind={line.kind}
                role="listitem"
                style={{ "--pm-diff-depth": line.depth } as JSX.CSSProperties}
                title={line.full}
              >
                <span aria-hidden="true" class={panelStyles.pmDiffMarker}>
                  {MARKERS[line.kind]}
                </span>
                <span class={panelStyles.pmDiffText}>
                  <Show when={line.kind === "add" || line.kind === "del"}>
                    <span class={panelStyles.pmVisuallyHidden}>
                      {line.kind === "add" ? "added " : "removed "}
                    </span>
                  </Show>
                  <Show when={line.highlight} fallback={line.text}>
                    {(highlight) => (
                      <>
                        {line.text.slice(0, highlight()[0])}
                        <span class={panelStyles.pmDiffChange}>
                          {line.text.slice(highlight()[0], highlight()[1])}
                        </span>
                        {line.text.slice(highlight()[1])}
                      </>
                    )}
                  </Show>
                  <Show when={line.note}>
                    {(note) => <span class={panelStyles.pmDiffNote}> {note()}</span>}
                  </Show>
                </span>
              </div>
            )}
          </For>
          <Show when={diff().truncated}>
            <div class={panelStyles.pmDiffLine} data-kind="fold" role="listitem">
              <span aria-hidden="true" class={panelStyles.pmDiffMarker} />
              <span class={panelStyles.pmDiffText}>⋯ diff truncated</span>
            </div>
          </Show>
        </div>
      </Show>
    </section>
  );
}
