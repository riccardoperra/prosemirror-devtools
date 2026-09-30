import { createMemo, For, Show, type JSX } from "solid-js";

import type { DevtoolsDiagnosticEvent } from "../../../core/diagnostics";
import { formatDateTime, formatMs } from "../../formatters";
import { JsonTree } from "../../json-tree";
import { panelStyles } from "../../styles";
import { Badge } from "../../ui/badge";
import { EVENT_PAGE_SIZE, eventSource, eventStatus } from "./use-events";

export function EventStatusBadge(props: { event: DevtoolsDiagnosticEvent }): JSX.Element {
  const status = () => eventStatus(props.event);
  return (
    <Badge tone={status() === "error" ? "red" : status() === "handled" ? "green" : undefined}>
      {status() === "unknown" ? "no result" : status()}
    </Badge>
  );
}

export function EventDetails(props: {
  event: DevtoolsDiagnosticEvent;
  events: readonly DevtoolsDiagnosticEvent[];
  onSelect: (id: number) => void;
}): JSX.Element {
  const parent = createMemo(() => props.events.find((event) => event.id === props.event.parentId));
  const children = createMemo(() =>
    props.events.filter((event) => event.parentId === props.event.id),
  );
  const visibleChildren = createMemo(() => children().slice(0, EVENT_PAGE_SIZE));
  const details = createMemo(() => ({
    id: props.event.id,
    kind: props.event.kind,
    name: props.event.name,
    pluginKey: props.event.pluginKey,
    pluginLabel: props.event.pluginLabel,
    handled: props.event.handled,
    durationMs: props.event.duration,
    dispatches: props.event.dispatches,
    metadata: props.event.metadata,
  }));

  return (
    <>
      <div class={panelStyles.pmDetailHeading}>
        <span class={panelStyles.pmSectionTitle}>Call #{props.event.id}</span>
        <EventStatusBadge event={props.event} />
        <Badge>{formatMs(props.event.duration)}</Badge>
      </div>
      <div style={{ padding: "10px", "overflow-wrap": "anywhere" }}>
        <strong class={panelStyles.pmMono}>{props.event.name}</strong>
        <p>{eventSource(props.event)}</p>
        <time dateTime={new Date(props.event.timestamp).toISOString()}>
          {formatDateTime(props.event.timestamp)}
        </time>
      </div>
      <Show when={props.event.error !== null}>
        <div class={panelStyles.pmDetailBlock}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>Thrown error</span>
          </div>
          <pre
            style={{
              margin: "0",
              padding: "10px",
              "white-space": "pre-wrap",
              "overflow-wrap": "anywhere",
            }}
          >
            {props.event.error}
          </pre>
        </div>
      </Show>
      <div class={panelStyles.pmDetailBlock}>
        <div class={panelStyles.pmDetailHeading}>
          <span class={panelStyles.pmSectionTitle}>Observed call chain</span>
        </div>
        <div style={{ padding: "10px", display: "grid", gap: "8px" }}>
          <Show
            when={props.event.parentId !== null}
            fallback={<span>Top-level observed call.</span>}
          >
            <Show
              when={parent()}
              fallback={<span>Parent #{props.event.parentId} is outside the retained trace.</span>}
            >
              {(event) => (
                <button
                  class={panelStyles.pmButton}
                  style={{ "white-space": "normal", "overflow-wrap": "anywhere" }}
                  onClick={() => props.onSelect(event().id)}
                  type="button"
                >
                  Parent #{event().id}: {event().name}
                </button>
              )}
            </Show>
          </Show>
          <For each={visibleChildren()}>
            {(event) => (
              <button
                class={panelStyles.pmButton}
                style={{ "white-space": "normal", "overflow-wrap": "anywhere" }}
                onClick={() => props.onSelect(event.id)}
                type="button"
              >
                Nested #{event.id}: {event.name}
              </button>
            )}
          </For>
          <Show when={children().length > visibleChildren().length}>
            <span>
              {children().length - visibleChildren().length} more nested calls are available in the
              call list.
            </span>
          </Show>
        </div>
      </div>
      <div class={panelStyles.pmDetailBlock}>
        <div class={panelStyles.pmDetailHeading}>
          <span class={panelStyles.pmSectionTitle}>Dispatches during this call</span>
        </div>
        <div style={{ padding: "10px", display: "flex", "flex-wrap": "wrap", gap: "6px" }}>
          <Show
            when={props.event.dispatches.length > 0}
            fallback={<span>No dispatch observed.</span>}
          >
            <For each={props.event.dispatches.slice(0, EVENT_PAGE_SIZE)}>
              {(dispatch) => (
                <Badge tone="blue">
                  {dispatch.instanceId} · #{dispatch.id}
                </Badge>
              )}
            </For>
            <Show when={props.event.dispatches.length > EVENT_PAGE_SIZE}>
              <span>
                {props.event.dispatches.length - EVENT_PAGE_SIZE} more IDs in captured callback
                details below.
              </span>
            </Show>
          </Show>
        </div>
        <Show when={props.event.dispatches.length > 0}>
          <p class={panelStyles.pmPerformanceNote}>
            Match these IDs in History. Dispatch records may have been cleared or expired.
          </p>
        </Show>
      </div>
      <div class={panelStyles.pmDetailHeading}>
        <span class={panelStyles.pmSectionTitle}>Captured callback details</span>
      </div>
      <JsonTree defaultExpandedDepth={1} value={details()} />
    </>
  );
}
