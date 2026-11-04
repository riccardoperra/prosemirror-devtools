import type { Node as ProseMirrorNode } from "prosemirror-model";
import { createMemo, createSignal, Show, type JSX } from "solid-js";

import { cx, panelStyles } from "../../styles";

import { inspectSchema } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";
import { useOptionalPanelInspection } from "../../panel-provider";

export interface SchemaViewProps {
  instance: RegisteredProseMirrorInstance;
}

export function SchemaView(props: SchemaViewProps): JSX.Element {
  const editorSchema = createMemo(() => props.instance.view.state.schema);
  const schema = createMemo(() => inspectSchema(editorSchema()));
  const inspection = useOptionalPanelInspection();
  const [requestedPosition, setRequestedPosition] = createSignal<{
    doc: ProseMirrorNode;
    value: string;
  }>();
  const positionText = createMemo(() => {
    const state = props.instance.view.state;
    const requested = requestedPosition();
    const shared = inspection?.position();
    return requested?.doc === state.doc
      ? requested.value
      : String(shared?.doc === state.doc ? shared.pos : state.selection.head);
  });
  const context = createMemo(() => {
    const state = props.instance.view.state;
    const position = Number(positionText());
    if (
      !positionText().trim() ||
      !Number.isInteger(position) ||
      position < 0 ||
      position > state.doc.content.size
    )
      return undefined;
    const resolved = state.doc.resolve(position);
    const index = resolved.index();
    let validity = "Valid document";
    try {
      state.doc.check();
    } catch (error) {
      validity = error instanceof Error ? error.message : String(error);
    }
    return {
      position,
      parent: resolved.parent.type.name,
      parentContentValid: resolved.parent.type.validContent(resolved.parent.content),
      documentValidity: validity,
      childIndex: index,
      insertionBoundary: resolved.textOffset === 0,
      nodeTypesAtChildBoundary: Object.values(state.schema.nodes)
        .filter((type) => resolved.parent.canReplaceWith(index, index, type))
        .map(({ name }) => name),
      allowedMarks: Object.values(state.schema.marks)
        .filter((type) => resolved.parent.type.allowsMarkType(type))
        .map(({ name }) => name),
      activeMarks: resolved.marks().map(({ type }) => type.name),
      contentExpression: resolved.parent.type.spec.content ?? "",
    };
  });

  return (
    <div class={cx(panelStyles.pmDetailColumns, panelStyles.pmScroll)}>
      <div>
        <section aria-label="Schema constraints at selected position">
          <Show
            when={
              inspection?.position() && inspection.position()?.doc !== props.instance.view.state.doc
            }
          >
            <p role="status" class={panelStyles.pmPerformanceNote}>
              The inspected position belongs to an earlier document. The current selection is shown.
              No position mapping was assumed.
            </p>
          </Show>
          <div class={panelStyles.pmPaneHeader}>
            <label>
              Position{" "}
              <input
                aria-label="Schema inspection position"
                class={panelStyles.pmSearch}
                type="number"
                min="0"
                max={props.instance.view.state.doc.content.size}
                value={positionText()}
                onInput={(event) => {
                  setRequestedPosition({
                    doc: props.instance.view.state.doc,
                    value: event.currentTarget.value,
                  });
                  const pos = Number(event.currentTarget.value);
                  if (event.currentTarget.value.trim())
                    inspection?.selectPosition({
                      doc: props.instance.view.state.doc,
                      pos,
                      isRoot: false,
                    });
                }}
              />
            </label>
          </div>
          <Show
            when={context()}
            fallback={
              <p class={panelStyles.pmWarning}>Enter a whole position inside this document.</p>
            }
          >
            {(value) => <JsonTree value={value()} defaultExpandedDepth={2} />}
          </Show>
          <p class={panelStyles.pmPerformanceNote}>
            Node insertion checks apply at the parent child boundary. They do not predict whether an
            application command succeeds. Allowed marks come from the parent node type.
          </p>
        </section>
        <div class={panelStyles.pmDetailHeading}>
          <span class={panelStyles.pmSectionTitle}>Nodes</span>
          <span class={panelStyles.pmSpacer} />
          <Badge tone="blue">top: {schema().topNodeType}</Badge>
        </div>
        <JsonTree defaultExpandedDepth={1} value={schema().nodes} />
      </div>
      <div>
        <div class={panelStyles.pmDetailHeading}>
          <span class={panelStyles.pmSectionTitle}>Marks</span>
        </div>
        <JsonTree defaultExpandedDepth={1} value={schema().marks} />
      </div>
    </div>
  );
}
