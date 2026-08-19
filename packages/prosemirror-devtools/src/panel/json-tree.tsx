import { memo, useMemo, useState } from "react";

export interface JsonTreeProps {
  value: unknown;
  name?: string;
  defaultExpandedDepth?: number;
}

const NO_ANCESTORS: readonly object[] = [];

function text(value: unknown, space?: number): string {
  try {
    const json = JSON.stringify(value, null, space);
    if (json !== undefined) return json;
  } catch {
    // Fall back to the value's string representation.
  }
  try {
    return String(value);
  } catch {
    return "[unprintable]";
  }
}

function copyValue(value: unknown): void {
  void globalThis.navigator?.clipboard?.writeText(text(value, 2));
}

function primitive(value: unknown): React.ReactNode {
  if (value === null) return <span className="pm-json-null">null</span>;
  if (typeof value === "string") {
    return <span className="pm-json-string">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return <span className="pm-json-number">{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="pm-json-boolean">{String(value)}</span>;
  }
  return <span className="pm-json-string">{text(value)}</span>;
}

function entries(value: unknown): [string, unknown][] {
  if (value === null || typeof value !== "object") return [];
  try {
    return Object.entries(value);
  } catch {
    return [];
  }
}

function summary(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value && typeof value === "object") {
    let type = "";
    try {
      const candidate = (value as { type?: unknown }).type;
      if (typeof candidate === "string") type = ` · ${candidate}`;
    } catch {
      // A proxy may reject property access.
    }
    return `{${entries(value).length}}${type}`;
  }
  return "";
}

const JsonNode = memo(function JsonNode({
  name,
  value,
  depth,
  defaultExpandedDepth,
  ancestors,
}: {
  name?: string;
  value: unknown;
  depth: number;
  defaultExpandedDepth: number;
  ancestors: readonly object[];
}): React.ReactElement {
  const isObject = value !== null && typeof value === "object";
  const circular = isObject && ancestors.includes(value);
  const expandable = isObject && !circular;
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);
  const children = useMemo(() => (expandable ? entries(value) : []), [expandable, value]);
  const childAncestors = useMemo(
    () => (isObject ? [...ancestors, value] : ancestors),
    [ancestors, isObject, value],
  );

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
        {expandable ? (
          <span className="pm-json-summary">{summary(value)}</span>
        ) : circular ? (
          <span className="pm-json-string">[Circular]</span>
        ) : (
          primitive(value)
        )}
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
        ? children.map(([key, child]) => (
            <JsonNode
              ancestors={childAncestors}
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
        ancestors={NO_ANCESTORS}
        defaultExpandedDepth={defaultExpandedDepth}
        depth={0}
        {...(name === undefined ? {} : { name })}
        value={value}
      />
    </div>
  );
}
