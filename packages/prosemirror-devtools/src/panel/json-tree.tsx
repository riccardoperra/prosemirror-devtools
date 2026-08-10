import { memo, useMemo, useState } from "react";

import type { SerializedValue } from "../core/types";

export interface JsonTreeProps {
  value: SerializedValue;
  name?: string;
  defaultExpandedDepth?: number;
}

function copyValue(value: SerializedValue): void {
  const text = JSON.stringify(value, null, 2);
  void globalThis.navigator?.clipboard?.writeText(text);
}

function primitive(value: SerializedValue): React.ReactNode {
  if (value === null) return <span className="pm-json-null">null</span>;
  if (typeof value === "string") {
    return <span className="pm-json-string">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="pm-json-number">{String(value)}</span>;
  }
  return <span className="pm-json-boolean">{String(value)}</span>;
}

function summary(value: SerializedValue): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value && typeof value === "object") {
    const type = typeof value.type === "string" ? ` · ${value.type}` : "";
    return `{${Object.keys(value).length}}${type}`;
  }
  return "";
}

const JsonNode = memo(function JsonNode({
  name,
  value,
  depth,
  defaultExpandedDepth,
}: {
  name?: string;
  value: SerializedValue;
  depth: number;
  defaultExpandedDepth: number;
}): React.ReactElement {
  const expandable = value !== null && typeof value === "object";
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);
  const entries = useMemo(() => (expandable ? Object.entries(value) : []), [expandable, value]);

  return (
    <div className="pm-json-node">
      <div className="pm-json-row" style={{ "--depth": depth } as React.CSSProperties}>
        {expandable ? (
          <button
            aria-label={expanded ? "Collapse value" : "Expand value"}
            className="pm-json-toggle"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="pm-json-toggle" />
        )}
        {name === undefined ? null : <span className="pm-json-key">{name}</span>}
        {name === undefined ? null : <span className="pm-muted">:</span>}
        {expandable ? <span className="pm-json-summary">{summary(value)}</span> : primitive(value)}
        <button
          aria-label="Copy value"
          className="pm-json-toggle pm-json-actions"
          onClick={() => copyValue(value)}
          title="Copy JSON"
          type="button"
        >
          ⧉
        </button>
      </div>
      {expandable && expanded
        ? entries.map(([key, child]) => (
            <JsonNode
              defaultExpandedDepth={defaultExpandedDepth}
              depth={depth + 1}
              key={key}
              name={key}
              value={child}
            />
          ))
        : null}
    </div>
  );
});

export function JsonTree({
  value,
  name,
  defaultExpandedDepth = 2,
}: JsonTreeProps): React.ReactElement {
  return (
    <div className="pm-json">
      <JsonNode
        defaultExpandedDepth={defaultExpandedDepth}
        depth={0}
        {...(name === undefined ? {} : { name })}
        value={value}
      />
    </div>
  );
}
