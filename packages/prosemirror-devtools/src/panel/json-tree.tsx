import { createMemo, createSignal, For, mergeProps, Show, type JSX } from "solid-js";

import { cx, panelStyles } from "./styles";

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

function primitive(value: unknown): JSX.Element {
  if (value === null) return <span class={panelStyles.pmJsonNull}>null</span>;
  if (typeof value === "string") {
    return <span class={panelStyles.pmJsonString}>{JSON.stringify(value)}</span>;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return <span class={panelStyles.pmJsonNumber}>{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return <span class={panelStyles.pmJsonBoolean}>{String(value)}</span>;
  }
  return <span class={panelStyles.pmJsonString}>{text(value)}</span>;
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

interface JsonNodeProps {
  name?: string;
  value: unknown;
  depth: number;
  defaultExpandedDepth: number;
  ancestors: readonly object[];
}

function JsonNode(props: JsonNodeProps): JSX.Element {
  const isObject = createMemo(() => props.value !== null && typeof props.value === "object");
  const circular = createMemo(() => isObject() && props.ancestors.includes(props.value as object));
  const expandable = createMemo(() => isObject() && !circular());
  const [expanded, setExpanded] = createSignal(props.depth < props.defaultExpandedDepth);
  const children = createMemo(() => (expandable() ? entries(props.value) : []));
  const childAncestors = createMemo(() =>
    isObject() ? [...props.ancestors, props.value as object] : props.ancestors,
  );

  return (
    <div class={panelStyles.pmJsonNode}>
      <div class={panelStyles.pmJsonRow} style={{ "--depth": props.depth } as JSX.CSSProperties}>
        <Show when={expandable()} fallback={<span class={panelStyles.pmJsonToggle} />}>
          <button
            aria-label={expanded() ? "Collapse value" : "Expand value"}
            class={panelStyles.pmJsonToggle}
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded() ? "▾" : "▸"}
          </button>
        </Show>
        <Show when={props.name !== undefined}>
          <span class={panelStyles.pmJsonKey}>{props.name}</span>
          <span class={panelStyles.pmMuted}>:</span>
        </Show>
        <Show
          when={expandable()}
          fallback={
            <Show when={circular()} fallback={primitive(props.value)}>
              <span class={panelStyles.pmJsonString}>[Circular]</span>
            </Show>
          }
        >
          <span class={panelStyles.pmJsonSummary}>{summary(props.value)}</span>
        </Show>
        <button
          aria-label="Copy value"
          class={cx(panelStyles.pmJsonToggle, panelStyles.pmJsonActions)}
          onClick={() => copyValue(props.value)}
          title="Copy JSON"
          type="button"
        >
          ⧉
        </button>
      </div>
      <Show when={expandable() && expanded()}>
        <For each={children()}>
          {([key, child]) => (
            <JsonNode
              ancestors={childAncestors()}
              defaultExpandedDepth={props.defaultExpandedDepth}
              depth={props.depth + 1}
              name={key}
              value={child}
            />
          )}
        </For>
      </Show>
    </div>
  );
}

export function JsonTree(input: JsonTreeProps): JSX.Element {
  const props = mergeProps({ defaultExpandedDepth: 2 }, input);
  return (
    <div class={panelStyles.pmJson}>
      <JsonNode
        ancestors={NO_ANCESTORS}
        defaultExpandedDepth={props.defaultExpandedDepth}
        depth={0}
        {...(props.name === undefined ? {} : { name: props.name })}
        value={props.value}
      />
    </div>
  );
}
