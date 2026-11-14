import { For, Show, type JSX } from "solid-js";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { formatMs } from "../../formatters";
import { cx, panelStyles } from "../../styles";
import { ResizableSplit } from "../../ui/resizable-split";
import { EventDetails, EventStatusBadge } from "./event-details";
import { eventSource, useEvents, type EventStatus } from "./use-events";
import type { DevtoolsDiagnosticEvent } from "../../../core/diagnostics";
import { useOptionalPanelContext } from "../../panel-provider";

const SETUP_EXAMPLE = `const session = createProseMirrorDevtoolsSession({
  id: "editor",
  diagnostics: true,
});
const state = EditorState.create({
  schema,
  plugins: session.instrumentPlugins(plugins),
});
const view = new EditorView(element, { state });
session.attach(view);`;

const COMMAND_EXAMPLE = `const run = () => toggleBold(view.state, view.dispatch, view);
session.diagnostics
  ? session.diagnostics.traceCommand("Bold", run)
  : run();`;

function EventsSetup(): JSX.Element {
  return (
    <div class={panelStyles.pmScroll} style={{ padding: "16px" }}>
      <h3>Enable event and command tracing</h3>
      <p>
        Opt into diagnostics and instrument plugins before creating the editor. Handler calls appear
        even when they do not dispatch a transaction.
      </p>
      <pre
        class={panelStyles.pmMono}
        style={{ overflow: "auto", padding: "12px", background: "var(--pm-panel-2)" }}
      >
        {SETUP_EXAMPLE}
      </pre>
      <h4>Name application commands</h4>
      <p>Wrap a command invocation to distinguish it from anonymous keymap callbacks.</p>
      <pre
        class={panelStyles.pmMono}
        style={{ overflow: "auto", padding: "12px", background: "var(--pm-panel-2)" }}
      >
        {COMMAND_EXAMPLE}
      </pre>
      <p>Call session.dispose() when destroying the editor.</p>
      <p>
        Uninstrumented handlers are outside this trace. Clipboard content and DOM events are not
        retained.
      </p>
    </div>
  );
}

export function EventsView(props: { instance: RegisteredProseMirrorInstance }): JSX.Element {
  const events = useEvents(() => props.instance);
  const panelContext = useOptionalPanelContext();
  const inspection = panelContext?.inspection;
  const data = panelContext?.data.data;
  const retainedDispatch = (dispatch: DevtoolsDiagnosticEvent["dispatches"][number]) => {
    const target = data?.instance(dispatch.instanceId)();
    return target?.transactions.find(
      (record) =>
        record.id === dispatch.id &&
        (dispatch.sessionId !== undefined
          ? record.sessionId === dispatch.sessionId
          : target.view === props.instance.view) &&
        (dispatch.generation === undefined ||
          dispatch.generation === target.inspection?.target.generation),
    );
  };

  return (
    <Show when={events.controller()} fallback={<EventsSetup />}>
      <ResizableSplit label="Observed calls width">
        <div class={panelStyles.pmPane}>
          <div class={panelStyles.pmPaneHeader}>
            <span class={panelStyles.pmPaneTitle}>Observed calls</span>
            <span class={panelStyles.pmSpacer} />
            <button
              aria-pressed={events.followingLatest()}
              class={panelStyles.pmButton}
              onClick={events.followLatest}
              type="button"
            >
              Follow latest
            </button>
            <button
              aria-label="Clear event and command trace"
              class={panelStyles.pmButton}
              disabled={events.events().length === 0}
              onClick={events.clear}
              type="button"
            >
              Clear
            </button>
            <input
              aria-label="Search events and commands"
              class={panelStyles.pmSearch}
              onInput={(event) => {
                events.setQuery(event.currentTarget.value);
                events.followLatest();
              }}
              placeholder="Search handler, command, plugin…"
              value={events.query()}
            />
            <div
              style={{
                display: "grid",
                "grid-template-columns": "repeat(2, minmax(0, 1fr))",
                gap: "7px",
                width: "100%",
              }}
            >
              <select
                aria-label="Filter event source"
                class={panelStyles.pmSearch}
                onChange={(event) => {
                  events.setPlugin(event.currentTarget.value);
                  events.followLatest();
                }}
                value={events.plugin()}
              >
                <option value="">All plugins and commands</option>
                <option value="commands">Application commands</option>
                <For each={events.plugins()}>
                  {(plugin) => <option value={`plugin:${plugin.key}`}>{plugin.label}</option>}
                </For>
              </select>
              <select
                aria-label="Filter handled status"
                class={panelStyles.pmSearch}
                onChange={(event) => {
                  events.setStatus(event.currentTarget.value as EventStatus | "");
                  events.followLatest();
                }}
                value={events.status()}
              >
                <option value="">All outcomes</option>
                <option value="handled">Handled</option>
                <option value="unhandled">Unhandled</option>
                <option value="unknown">No boolean result</option>
                <option value="error">Errors</option>
              </select>
            </div>
          </div>
          <Show
            when={events.uninstrumented()}
            fallback={
              <p class={panelStyles.pmPerformanceNote}>
                Invocation order. Instrumented callbacks and named commands only; uninstrumented
                handlers are outside this trace.
              </p>
            }
          >
            {(reason) => (
              <p class={panelStyles.pmWarning} role="note">
                {reason()}
              </p>
            )}
          </Show>
          <Show
            when={events.visible().length > 0}
            fallback={
              <div class={panelStyles.pmPerformanceNote}>
                {events.events().length > 0
                  ? "No calls match these filters."
                  : events.uninstrumented()
                    ? "No traced commands recorded. Handler calls are not captured in this session."
                    : "No calls recorded. Use the editor’s keys, paste, or a named command. No transaction is required."}
              </div>
            }
          >
            <ul aria-label="Observed event and command calls" class={panelStyles.pmList}>
              <For each={events.visible()}>
                {(event) => (
                  <li>
                    <button
                      aria-label={`Inspect ${event.name}, call #${event.id}`}
                      aria-pressed={events.selected()?.id === event.id}
                      class={panelStyles.pmListRow}
                      data-event-id={event.id}
                      onClick={() => events.select(event.id)}
                      type="button"
                    >
                      <span class={panelStyles.pmMono}>#{event.id}</span>
                      <span class={panelStyles.pmRowMain} style={{ display: "grid", gap: "3px" }}>
                        <span class={cx(panelStyles.pmRowTitle, panelStyles.pmMono)}>
                          {event.name}
                        </span>
                        <span class={panelStyles.pmRowDetail}>
                          {eventSource(event)}
                          {event.parentId === null ? "" : ` · parent #${event.parentId}`}
                        </span>
                      </span>
                      <span style={{ display: "grid", gap: "3px", "justify-items": "end" }}>
                        <EventStatusBadge event={event} />
                        <span class={panelStyles.pmRowDetail}>{formatMs(event.duration)}</span>
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <div class={panelStyles.pmPaneHeader} style={{ position: "static" }}>
              <button
                class={panelStyles.pmButton}
                disabled={events.page() >= events.pageCount() - 1}
                onClick={() => events.setPage(events.page() + 1)}
                type="button"
              >
                Older calls
              </button>
              <button
                class={panelStyles.pmButton}
                disabled={events.page() === 0}
                onClick={() => events.setPage(events.page() - 1)}
                type="button"
              >
                Newer calls
              </button>
              <span>
                {events.pageStart() + 1}–{events.pageEnd()} of {events.filtered().length}
              </span>
            </div>
          </Show>
        </div>
        <div aria-label="Event and command details" class={panelStyles.pmPane}>
          <Show
            when={events.selected()}
            fallback={
              <div class={panelStyles.pmEmpty}>
                Select an observed call to inspect its result and dispatches.
              </div>
            }
          >
            {(event) => (
              <EventDetails
                event={event()}
                events={events.events()}
                onSelect={events.select}
                retainedDispatch={retainedDispatch}
                onInspectDispatch={
                  inspection
                    ? (dispatch) => {
                        if (retainedDispatch(dispatch))
                          inspection.selectTransaction({
                            instanceId: dispatch.instanceId,
                            id: dispatch.id,
                            panel: "history",
                          });
                      }
                    : undefined
                }
                onInspectPlugin={inspection?.selectPlugin}
              />
            )}
          </Show>
        </div>
      </ResizableSplit>
    </Show>
  );
}
