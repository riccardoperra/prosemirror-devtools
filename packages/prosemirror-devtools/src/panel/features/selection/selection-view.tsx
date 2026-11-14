import { readInstanceState } from "../../store/instance-state";
import type { ResolvedPos } from "prosemirror-model";
import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { panelStyles } from "../../styles";
import { Badge } from "../../ui/badge";
import { ResizableSplit } from "../../ui/resizable-split";
import { useOptionalPanelContext } from "../../panel-provider";

/** Content boundaries differ from the positions before and after a node. */
export function inspectPosition(position: ResolvedPos) {
  return {
    pos: position.pos,
    depth: position.depth,
    parentOffset: position.parentOffset,
    textOffset: position.textOffset,
    ancestors: Array.from({ length: position.depth + 1 }, (_, depth) => {
      const node = position.node(depth);
      return {
        depth,
        type: node.type.name,
        index: position.index(depth),
        start: position.start(depth),
        end: position.end(depth),
        before: depth === 0 ? null : position.before(depth),
        after: depth === 0 ? null : position.after(depth),
        attrs: node.attrs,
      };
    }),
  };
}

export function SelectionView(props: { instance: RegisteredProseMirrorInstance }): JSX.Element {
  const state = createMemo(() => readInstanceState(props.instance));
  const selection = createMemo(() => state().selection);
  const [endpoint, setEndpoint] = createSignal<"anchor" | "head">("head");
  const [contextOpen, setContextOpen] = createSignal(false);
  const position = createMemo(() =>
    endpoint() === "anchor" ? selection().$anchor : selection().$head,
  );
  const inspection = createMemo(() => inspectPosition(position()));
  const selectionJson = createMemo(() => ({
    ...selection().toJSON(),
    empty: selection().empty,
    from: selection().from,
    to: selection().to,
    anchor: selection().anchor,
    head: selection().head,
    ranges: selection().ranges.map(({ $from, $to }) => ({ from: $from.pos, to: $to.pos })),
  }));
  const context = createMemo(() =>
    contextOpen()
      ? {
          parent: { type: position().parent.type.name, attrs: position().parent.attrs },
          nodeBefore: position().nodeBefore?.toJSON() ?? null,
          nodeAfter: position().nodeAfter?.toJSON() ?? null,
        }
      : null,
  );
  const marks = createMemo(() => ({
    // null means derive marks from the cursor; [] explicitly clears stored marks.
    storedMarks: state().storedMarks?.map((mark) => mark.toJSON()) ?? null,
    atPosition: position()
      .marks()
      .map((mark) => mark.toJSON()),
    acrossSelection:
      selection()
        .$from.marksAcross(selection().$to)
        ?.map((mark) => mark.toJSON()) ?? null,
  }));
  const panelContext = useOptionalPanelContext();
  const panelInspection = panelContext?.inspection;
  const navigation = panelContext?.navigation;
  const inspectEndpoint = (panel: string): void => {
    panelInspection?.selectPosition({ doc: state().doc, pos: position().pos, isRoot: false });
    navigation?.selectPanel(panel);
  };

  return (
    <ResizableSplit label="Resolved position width">
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Resolved position</span>
          <span class={panelStyles.pmSpacer} />
          <div aria-label="Selection endpoint" class={panelStyles.pmViewSwitch} role="group">
            <For each={["anchor", "head"] as const}>
              {(value) => (
                <button
                  aria-pressed={endpoint() === value}
                  onClick={() => setEndpoint(value)}
                  type="button"
                >
                  {value === "anchor" ? "Anchor" : "Head"} {selection()[value]}
                </button>
              )}
            </For>
          </div>
        </div>
        <div class={panelStyles.pmInspectorStats}>
          <Badge tone="blue">position {inspection().pos}</Badge>
          <Badge>depth {inspection().depth}</Badge>
          <Badge>parent offset {inspection().parentOffset}</Badge>
          <Badge>text offset {inspection().textOffset}</Badge>
          <Show when={navigation}>
            <button
              type="button"
              class={panelStyles.pmButton}
              onClick={() => inspectEndpoint("state")}
            >
              Inspect endpoint in document
            </button>
            <button
              type="button"
              class={panelStyles.pmButton}
              onClick={() => inspectEndpoint("schema")}
            >
              Schema at endpoint
            </button>
          </Show>
        </div>
        <div class={panelStyles.pmTableScroll}>
          <table aria-label="Ancestors at the selected endpoint" class={panelStyles.pmTable}>
            <thead>
              <tr>
                <th scope="col">Ancestor</th>
                <th scope="col">Depth</th>
                <th scope="col">Index</th>
                <th scope="col">Content start</th>
                <th scope="col">Content end</th>
              </tr>
            </thead>
            <tbody>
              <For each={inspection().ancestors}>
                {(ancestor) => (
                  <tr>
                    <th scope="row">{ancestor.type}</th>
                    <td>{ancestor.depth}</td>
                    <td>{ancestor.index}</td>
                    <td>{ancestor.start}</td>
                    <td>{ancestor.end}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <div class={panelStyles.pmDetailBlock}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>Ancestor boundaries & attributes</span>
          </div>
          <JsonTree defaultExpandedDepth={1} value={inspection().ancestors} />
        </div>
        <details
          class={panelStyles.pmDisclosure}
          open={contextOpen()}
          onToggle={(event) => setContextOpen(event.currentTarget.open)}
        >
          <summary>
            <span class={panelStyles.pmSectionTitle}>Adjacent nodes</span>
          </summary>
          <Show when={contextOpen()}>
            <JsonTree defaultExpandedDepth={1} value={context()} />
          </Show>
        </details>
      </div>
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmDetailBlock}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>Selection</span>
            <Badge tone="blue">{selection().toJSON().type}</Badge>
            <Badge>
              {selection().empty ? "empty" : `${selection().to - selection().from} positions`}
            </Badge>
            <Badge>{selection().anchor > selection().head ? "backward" : "forward"}</Badge>
          </div>
          <JsonTree value={selectionJson()} />
        </div>
        <div class={panelStyles.pmDetailBlock}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>Marks</span>
          </div>
          <JsonTree value={marks()} />
        </div>
      </div>
    </ResizableSplit>
  );
}
