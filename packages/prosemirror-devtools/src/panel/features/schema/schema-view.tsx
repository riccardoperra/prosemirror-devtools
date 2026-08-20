import { createMemo, type JSX } from "solid-js";

import { inspectSchema } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";

export function SchemaView(props: { instance: RegisteredProseMirrorInstance }): JSX.Element {
  const schema = createMemo(() => inspectSchema(props.instance.view.state.schema));

  return (
    <div class="pm-detail-columns pm-scroll">
      <div>
        <div class="pm-detail-heading">
          <span class="pm-section-title">Nodes</span>
          <span class="pm-spacer" />
          <Badge tone="blue">top: {schema().topNodeType}</Badge>
        </div>
        <JsonTree defaultExpandedDepth={1} value={schema().nodes} />
      </div>
      <div>
        <div class="pm-detail-heading">
          <span class="pm-section-title">Marks</span>
        </div>
        <JsonTree defaultExpandedDepth={1} value={schema().marks} />
      </div>
    </div>
  );
}
