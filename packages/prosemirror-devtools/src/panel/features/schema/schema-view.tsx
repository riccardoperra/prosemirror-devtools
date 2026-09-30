import { createMemo, type JSX } from "solid-js";

import { cx, panelStyles } from "../../styles";

import { inspectSchema } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";

export interface SchemaViewProps {
  instance: RegisteredProseMirrorInstance;
}

export function SchemaView(props: SchemaViewProps): JSX.Element {
  const editorSchema = createMemo(() => props.instance.view.state.schema);
  const schema = createMemo(() => inspectSchema(editorSchema()));

  return (
    <div class={cx(panelStyles.pmDetailColumns, panelStyles.pmScroll)}>
      <div>
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
