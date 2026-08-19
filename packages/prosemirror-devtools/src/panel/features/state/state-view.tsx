import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { inspectState } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";
import { DocumentTree, getDocumentNodeRange } from "./document-tree";
import { useDocumentSelection } from "./use-document-selection";

type DocumentView = "structure" | "json";

export function StateView({ instance }: { instance: RegisteredProseMirrorInstance }): ReactElement {
  const state = instance.view.state;
  const inspection = useMemo(() => inspectState(state), [state]);
  const [documentView, setDocumentView] = useState<DocumentView>("structure");
  const { selected, select, selectNode, reveal } = useDocumentSelection(instance.view);
  const selectedRange = getDocumentNodeRange(selected.node, selected.pos, selected.isRoot);
  const selectionRange = useMemo(
    () => ({
      empty: state.selection.empty,
      from: state.selection.from,
      to: state.selection.to,
    }),
    [state.selection.empty, state.selection.from, state.selection.to],
  );
  const selectedNodeJson = useMemo(() => selected.node.toJSON(), [selected.node]);
  const selectionJson = useMemo(
    () => ({
      selection: inspection.selection,
      activeMarks: inspection.activeMarks,
      storedMarks: inspection.storedMarks,
    }),
    [inspection.activeMarks, inspection.selection, inspection.storedMarks],
  );

  return (
    <div className="pm-split">
      <div className="pm-pane">
        <div className="pm-pane-header">
          <span className="pm-pane-title">Document</span>
          <span className="pm-spacer" />
          <div aria-label="Document view" className="pm-view-switch" role="group">
            <button
              aria-label="Show document structure"
              aria-pressed={documentView === "structure"}
              onClick={() => setDocumentView("structure")}
              type="button"
            >
              Structure
            </button>
            <button
              aria-label="Show document JSON"
              aria-pressed={documentView === "json"}
              onClick={() => setDocumentView("json")}
              type="button"
            >
              JSON
            </button>
          </div>
          <Badge>{state.doc.childCount} roots</Badge>
        </div>
        <div className="pm-inspector-stats">
          <Badge>{inspection.stats.nodeSize} node size</Badge>
          <Badge>{inspection.stats.textSize} chars</Badge>
          <Badge tone={state.selection.empty ? undefined : "blue"}>
            {state.selection.from}–{state.selection.to}
          </Badge>
        </div>
        {documentView === "structure" ? (
          <DocumentTree
            depth={0}
            node={state.doc}
            onReveal={reveal}
            onSelect={select}
            onSelectNode={selectNode}
            pos={0}
            selectedPosition={selected.pos}
            selectedRoot={selected.isRoot}
            selection={selectionRange}
          />
        ) : (
          <div className="pm-document-json">
            <JsonTree defaultExpandedDepth={3} value={inspection.doc} />
          </div>
        )}
      </div>
      <div className="pm-pane">
        <div className="pm-detail-block">
          <div className="pm-detail-heading">
            <span className="pm-section-title">Selected node</span>
            <Badge tone="blue">open {selectedRange.from}</Badge>
            <Badge>close {selectedRange.to}</Badge>
            <Badge>{selected.node.nodeSize} size</Badge>
          </div>
          <JsonTree value={selectedNodeJson} />
        </div>
        <div className="pm-detail-block">
          <div className="pm-detail-heading">
            <span className="pm-section-title">Selection & marks</span>
          </div>
          <JsonTree value={selectionJson} />
        </div>
      </div>
    </div>
  );
}
