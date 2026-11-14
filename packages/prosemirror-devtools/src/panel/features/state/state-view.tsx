import { readInstanceState } from "../../store/instance-state";
import { createMemo, createSignal, For, Match, Show, Switch, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import { inspectState } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";
import { ResizableSplit } from "../../ui/resizable-split";
import { DocumentBoxes } from "./document-boxes";
import { DocumentTree, getDocumentNodeRange } from "./document-tree";
import { RenderedDomView } from "./rendered-dom-view";
import { useDocumentSelection } from "./use-document-selection";
import { useNodeHoverOutline } from "../inspector/use-node-hover-outline";
import { useOptionalPanelContext } from "../../panel-provider";

type DocumentView = "structure" | "boxes" | "json" | "dom";

type DocumentViewDefinition = Readonly<{
  id: DocumentView;
  label: string;
  ariaLabel: string;
}>;

const DOCUMENT_VIEWS: readonly DocumentViewDefinition[] = [
  { id: "boxes", label: "Boxes", ariaLabel: "Show document as nested boxes" },
  { id: "structure", label: "Structure", ariaLabel: "Show document structure" },
  { id: "json", label: "JSON", ariaLabel: "Show document JSON" },
  { id: "dom", label: "DOM", ariaLabel: "Show document DOM" },
];

export interface StateViewProps {
  instance: RegisteredProseMirrorInstance;
}

export function StateView(props: StateViewProps): JSX.Element {
  const state = createMemo(() => readInstanceState(props.instance));
  const inspection = createMemo(() => inspectState(state()));
  const [documentView, setDocumentView] = createSignal<DocumentView>("boxes");
  const { selected, select, selectNode, reveal } = useDocumentSelection(
    () => props.instance.view,
    state,
  );
  const outlineNode = useNodeHoverOutline(() => props.instance.view, state);
  const selectAt = (pos: number, isRoot: boolean): void => {
    const doc = state().doc;
    const node = isRoot ? doc : doc.nodeAt(pos);
    if (node) select(node, isRoot ? 0 : pos);
  };
  const selectedRange = createMemo(() => {
    const current = selected();
    return getDocumentNodeRange(current.node, current.pos, current.isRoot);
  });
  const selectionRange = createMemo(() => ({
    empty: state().selection.empty,
    from: state().selection.from,
    to: state().selection.to,
  }));
  const selectedNode = createMemo(() => selected().node);
  const selectedNodeJson = createMemo(() => selectedNode().toJSON());
  const selectionJson = createMemo(() => ({
    selection: inspection().selection,
    activeMarks: inspection().activeMarks,
    storedMarks: inspection().storedMarks,
  }));
  const panelContext = useOptionalPanelContext();
  const context = panelContext?.inspection;
  const navigation = panelContext?.navigation;

  return (
    <ResizableSplit label="Document width">
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Document</span>
          <span class={panelStyles.pmSpacer} />
          <div aria-label="Document view" class={panelStyles.pmViewSwitch} role="group">
            <For each={DOCUMENT_VIEWS}>
              {(view) => (
                <button
                  aria-label={view.ariaLabel}
                  aria-pressed={documentView() === view.id}
                  onClick={() => setDocumentView(view.id)}
                  type="button"
                >
                  {view.label}
                </button>
              )}
            </For>
          </div>
          <Badge>{state().doc.childCount} roots</Badge>
        </div>
        <div class={panelStyles.pmInspectorStats}>
          <Badge>{inspection().stats.nodeSize} node size</Badge>
          <Badge>{inspection().stats.textSize} chars</Badge>
          <Badge tone={state().selection.empty ? undefined : "blue"}>
            {state().selection.from}–{state().selection.to}
          </Badge>
        </div>
        <Show when={context?.position() && context.position()?.doc !== state().doc}>
          <p role="status" class={panelStyles.pmPerformanceNote}>
            The selected position belongs to an earlier document. Showing the root. No position
            mapping was assumed.
          </p>
        </Show>
        <Switch>
          <Match when={documentView() === "structure"}>
            <DocumentTree
              depth={0}
              node={state().doc}
              onHover={outlineNode}
              onReveal={reveal}
              onSelect={select}
              onSelectNode={selectNode}
              pos={0}
              selectedPosition={selected().pos}
              selectedRoot={selected().isRoot}
              selection={selectionRange()}
            />
          </Match>
          <Match when={documentView() === "boxes"}>
            <DocumentBoxes
              doc={state().doc}
              onHover={outlineNode}
              onReveal={reveal}
              onSelect={select}
              selectedPosition={selected().pos}
              selectedRoot={selected().isRoot}
            />
          </Match>
          <Match when={documentView() === "dom"}>
            <RenderedDomView
              onHover={outlineNode}
              onSelect={selectAt}
              selectedPosition={selected().pos}
              selectedRoot={selected().isRoot}
              state={state()}
              view={props.instance.view}
            />
          </Match>
          <Match when={documentView() === "json"}>
            <div class={panelStyles.pmDocumentJson}>
              <JsonTree defaultExpandedDepth={3} value={inspection().doc} />
            </div>
          </Match>
        </Switch>
      </div>
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmDetailBlock}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>Selected node</span>
            <Badge tone="blue">open {selectedRange().from}</Badge>
            <Badge>close {selectedRange().to}</Badge>
            <Badge>{selected().node.nodeSize} size</Badge>
            <Show when={navigation}>
              <button
                type="button"
                class={panelStyles.pmButton}
                onClick={() => navigation?.selectPanel("schema")}
              >
                Schema at selected node
              </button>
            </Show>
          </div>
          <JsonTree value={selectedNodeJson()} />
        </div>
        <div class={panelStyles.pmDetailBlock}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>Selection & marks</span>
          </div>
          <JsonTree value={selectionJson()} />
        </div>
      </div>
    </ResizableSplit>
  );
}
