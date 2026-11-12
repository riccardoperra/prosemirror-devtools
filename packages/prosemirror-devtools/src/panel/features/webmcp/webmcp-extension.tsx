import { createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import { render } from "solid-js/web";

import type { DevtoolsExtension } from "../../../core/extensions";
import {
  createWebMcpRecorder,
  type WebMcpCall,
  type WebMcpInspectorOptions,
} from "../../../core/webmcp";
import { formatMs } from "../../formatters";
import { cx, panelStyles } from "../../styles";
import { Badge } from "../../ui/badge";

type Recorder = ReturnType<typeof createWebMcpRecorder>;

const callStatus = {
  pending: { label: "Pending", tone: "yellow" },
  canceled: { label: "Canceled", tone: undefined },
  succeeded: { label: "Succeeded", tone: "green" },
  failed: { label: "Failed", tone: "red" },
} as const;

const callSources = {
  webmcp: "Native WebMCP",
  "chrome-devtools-mcp": "Chrome DevTools MCP",
} as const;

function Payload(props: { label: string; value: string }): JSX.Element {
  return (
    <div class={panelStyles.pmPerformanceNote}>
      <strong>{props.label}</strong>
      <pre
        class={panelStyles.pmMono}
        style={{ "white-space": "pre-wrap", "overflow-wrap": "anywhere" }}
      >
        {props.value}
      </pre>
    </div>
  );
}

function CallDetails(props: { call: WebMcpCall }): JSX.Element {
  const status = () => callStatus[props.call.status];
  const duration = () => ("duration" in props.call ? formatMs(props.call.duration) : "");
  const outcome = () => {
    const call = props.call;
    if (call.status === "succeeded") return <Payload label="Result" value={call.output} />;
    if (call.status === "failed") return <Payload label="Error" value={call.error} />;
    return undefined;
  };

  return (
    <details>
      <summary class={cx(panelStyles.pmListRow, panelStyles.pmWebMcpSummary)}>
        <span class={panelStyles.pmMono}>#{props.call.id}</span>
        <span class={cx(panelStyles.pmRowTitle, panelStyles.pmMono)}>{props.call.name}</span>
        <time
          class={panelStyles.pmRowDetail}
          dateTime={new Date(props.call.timestamp).toISOString()}
        >
          {new Date(props.call.timestamp).toLocaleTimeString()}
        </time>
        <Show when={duration()}>
          <span class={panelStyles.pmRowDetail}>{duration()}</span>
        </Show>
        <Badge tone={status().tone}>{status().label}</Badge>
      </summary>
      <div class={panelStyles.pmPerformanceNote}>Source {callSources[props.call.source]}</div>
      <Payload label="Input" value={props.call.input} />
      {outcome()}
    </details>
  );
}

function WebMcpView(props: { recorder: Recorder }): JSX.Element {
  const { recorder } = props;
  const [tools, setTools] = createSignal(recorder.tools());
  const [calls, setCalls] = createSignal(recorder.calls());
  onCleanup(recorder.tools.subscribe(() => setTools(recorder.tools())));
  onCleanup(recorder.calls.subscribe(() => setCalls(recorder.calls())));

  return (
    <div class={panelStyles.pmSplit}>
      <section aria-label="Registered WebMCP tools" class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Registered tools</span>
        </div>
        <Show
          when={tools().length > 0}
          fallback={
            <p class={panelStyles.pmPerformanceNote}>
              {recorder.isSupported
                ? "No WebMCP tools registered through this inspector."
                : "WebMCP is unavailable in this document."}
            </p>
          }
        >
          <ul class={panelStyles.pmList}>
            <For each={tools()}>
              {(tool) => (
                <li class={panelStyles.pmPerformanceNote}>
                  <strong class={panelStyles.pmMono}>{tool.name}</strong>
                  <div>{tool.description}</div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
      <section aria-label="WebMCP calls" class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Call history</span>
          <span class={panelStyles.pmSpacer} />
          <button
            aria-label="Clear WebMCP call history"
            class={panelStyles.pmButton}
            disabled={calls().size === 0}
            onClick={recorder.clearCalls}
            type="button"
          >
            Clear
          </button>
        </div>
        <Show
          when={calls().size > 0}
          fallback={<p class={panelStyles.pmPerformanceNote}>No WebMCP calls recorded.</p>}
        >
          <ul class={panelStyles.pmList}>
            <For each={Array.from(calls().keys()).reverse()}>
              {(id) => (
                <li>
                  <Show when={calls().get(id)}>{(call) => <CallDetails call={call()} />}</Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </div>
  );
}

export function createProseMirrorWebMcpInspector(options: WebMcpInspectorOptions = {}) {
  const recorder = createWebMcpRecorder(options);
  const { isSupported, registerTool, traceChromeToolCall, dispose } = recorder;
  const extension: DevtoolsExtension = {
    id: "webmcp",
    panels: [
      {
        id: "webmcp",
        title: "WebMCP",
        requiresInstance: false,
        mount: (container) => render(() => <WebMcpView recorder={recorder} />, container),
      },
    ],
  };
  return { extension, isSupported, registerTool, traceChromeToolCall, dispose };
}
