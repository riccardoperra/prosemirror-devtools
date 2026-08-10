import { useMemo } from "react";
import type { ReactElement } from "react";

import { inspectSchema } from "../../../core/serialize";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";

export function SchemaView({
  instance,
}: {
  instance: RegisteredProseMirrorInstance;
}): ReactElement {
  const editorSchema = instance.view.state.schema;
  const schema = useMemo(() => inspectSchema(editorSchema), [editorSchema]);

  return (
    <div className="pm-detail-columns pm-scroll">
      <div>
        <div className="pm-detail-heading">
          <span className="pm-section-title">Nodes</span>
          <span className="pm-spacer" />
          <Badge tone="blue">top: {schema.topNodeType}</Badge>
        </div>
        <JsonTree defaultExpandedDepth={1} value={schema.nodes} />
      </div>
      <div>
        <div className="pm-detail-heading">
          <span className="pm-section-title">Marks</span>
        </div>
        <JsonTree defaultExpandedDepth={1} value={schema.marks} />
      </div>
    </div>
  );
}
