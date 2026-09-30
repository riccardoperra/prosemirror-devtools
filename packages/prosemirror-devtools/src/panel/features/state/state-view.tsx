import { createMemo, createSignal, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import { inspectState } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";
import { DocumentTree, getDocumentNodeRange } from "./document-tree";
import { useDocumentSelection } from "./use-document-selection";

type DocumentView = "structure" | "json";

export interface StateViewProps {
  instance: RegisteredProseMirrorInstance;
}

export function StateView(props: StateViewProps): JSX.Element {
  const state = createMemo(() => props.instance.view.state);
  const inspection = createMemo(() => inspectState(state()));
  const [documentView, setDocumentView] = createSignal<DocumentView>("structure");
  const { selected, select, selectNode, reveal } = useDocumentSelection(() => props.instance.view);
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

  return (
    <div class={panelStyles.pmSplit}>
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Document</span>
          <span class={panelStyles.pmSpacer} />
          <div aria-label="Document view" class={panelStyles.pmViewSwitch} role="group">
            <button
              aria-label="Show document structure"
              aria-pressed={documentView() === "structure"}
              onClick={() => setDocumentView("structure")}
              type="button"
            >
              Structure
            </button>
            <button
              aria-label="Show document JSON"
              aria-pressed={documentView() === "json"}
              onClick={() => setDocumentView("json")}
              type="button"
            >
              JSON
            </button>
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
        <Show
          when={documentView() === "structure"}
          fallback={
            <div class={panelStyles.pmDocumentJson}>
              <JsonTree defaultExpandedDepth={3} value={inspection().doc} />
            </div>
          }
        >
          <DocumentTree
            depth={0}
            node={state().doc}
            onReveal={reveal}
            onSelect={select}
            onSelectNode={selectNode}
            pos={0}
            selectedPosition={selected().pos}
            selectedRoot={selected().isRoot}
            selection={selectionRange()}
          />
        </Show>
      </div>
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmDetailBlock}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>Selected node</span>
            <Badge tone="blue">open {selectedRange().from}</Badge>
            <Badge>close {selectedRange().to}</Badge>
            <Badge>{selected().node.nodeSize} size</Badge>
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
    </div>
  );
}
