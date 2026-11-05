import { readInstanceState } from "../../store/instance-state";
import { DOMSerializer } from "prosemirror-model";
import { createMemo, createSignal, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import { inspectState } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";
import { ResizableSplit } from "../../ui/resizable-split";
import { DocumentTree, getDocumentNodeRange } from "./document-tree";
import { useDocumentSelection } from "./use-document-selection";
import { useOptionalPanelContext } from "../../panel-provider";

type DocumentView = "structure" | "json" | "html";

export interface StateViewProps {
  instance: RegisteredProseMirrorInstance;
}

export function StateView(props: StateViewProps): JSX.Element {
  const state = createMemo(() => readInstanceState(props.instance));
  const inspection = createMemo(() => inspectState(state()));
  const [documentView, setDocumentView] = createSignal<DocumentView>("structure");
  const { selected, select, selectNode, reveal } = useDocumentSelection(
    () => props.instance.view,
    state,
  );
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
  const html = createMemo(() => {
    if (documentView() !== "html") return undefined;
    try {
      const container = props.instance.view.dom.ownerDocument.createElement("div");
      container.append(
        DOMSerializer.fromSchema(state().schema).serializeFragment(state().doc.content, {
          document: container.ownerDocument,
        }),
      );
      return { kind: "available", value: container.innerHTML } as const;
    } catch (error) {
      return {
        kind: "unavailable",
        reason: error instanceof Error ? error.message : String(error),
      } as const;
    }
  });

  return (
    <ResizableSplit label="Document width">
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Document</span>
          <span class={panelStyles.pmSpacer} />
          <div aria-label="Document view" class={panelStyles.pmViewSwitch} role="group">
            <button
              aria-label="Show exported document HTML"
              aria-pressed={documentView() === "html"}
              onClick={() => setDocumentView("html")}
              type="button"
            >
              HTML
            </button>
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
        <Show when={context?.position() && context.position()?.doc !== state().doc}>
          <p role="status" class={panelStyles.pmPerformanceNote}>
            The selected position belongs to an earlier document. Showing the root. No position
            mapping was assumed.
          </p>
        </Show>
        <Show
          when={documentView() === "structure"}
          fallback={
            <div class={panelStyles.pmDocumentJson}>
              <Show
                when={documentView() === "html"}
                fallback={<JsonTree defaultExpandedDepth={3} value={inspection().doc} />}
              >
                <p class={panelStyles.pmPerformanceNote}>
                  HTML serializes document content through the schema. Root attributes remain in
                  JSON. NodeViews are not HTML serializers.
                </p>
                <pre
                  aria-label="Exported document HTML"
                  style={{ "white-space": "pre-wrap", "overflow-wrap": "anywhere" }}
                >
                  {html()?.kind === "available"
                    ? html()?.value
                    : `HTML unavailable: ${html()?.reason ?? ""}`}
                </pre>
              </Show>
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
