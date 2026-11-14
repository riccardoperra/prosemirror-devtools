import { createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import { render } from "solid-js/web";

import type { DevtoolsExtension } from "../../../core/extensions";
import {
  createWebMcpRecorder,
  type WebMcpCall,
  type WebMcpInspectorOptions,
  type WebMcpToolMetadata,
} from "../../../core/webmcp";
import { formatMs } from "../../formatters";
import { cx, panelStyles } from "../../styles";
import { ViewSwitch } from "../../ui/view-switch";
import { Badge } from "../../ui/badge";
import { ResizableSplit } from "../../ui/resizable-split";

type Recorder = ReturnType<typeof createWebMcpRecorder>;
type BadgeTone = "green" | "yellow" | "red" | "blue" | undefined;

const callStatus = {
  pending: { label: "Pending", tone: "yellow" },
  canceled: { label: "Canceled", tone: undefined },
  succeeded: { label: "Returned", tone: "green" },
  failed: { label: "Failed", tone: "red" },
} as const;

const callSources = {
  webmcp: { label: "Native WebMCP", short: "Native" },
  "chrome-devtools-mcp": { label: "Chrome DevTools MCP", short: "Chrome MCP" },
} as const;

/** Tones for the inspection protocol's result kinds. Unknown kinds stay neutral. */
const resultTones: Record<string, BadgeTone> = {
  available: "green",
  passed: "green",
  failed: "red",
  error: "red",
  expired: "yellow",
  inconclusive: "yellow",
  unobserved: "yellow",
  disabled: "yellow",
  unavailable: "yellow",
  truncated: "yellow",
};

function resultKind(call: WebMcpCall): string | undefined {
  return call.status === "succeeded" ? call.resultKind : undefined;
}

function callDuration(call: WebMcpCall): string {
  return "duration" in call ? formatMs(call.duration) : "";
}

function ResultBadge(props: { kind: string; prefix?: boolean }): JSX.Element {
  return (
    <Badge tone={Object.hasOwn(resultTones, props.kind) ? resultTones[props.kind] : undefined}>
      {props.prefix ? `Result ${props.kind}` : props.kind}
    </Badge>
  );
}

function StatusBadge(props: { call: WebMcpCall }): JSX.Element {
  const status = () => callStatus[props.call.status];
  return <Badge tone={status().tone}>{status().label}</Badge>;
}

/** The row shows the most informative outcome: the result kind, or the call status. */
function OutcomeBadge(props: { call: WebMcpCall }): JSX.Element {
  return (
    <Show when={resultKind(props.call)} fallback={<StatusBadge call={props.call} />}>
      {(kind) => <ResultBadge kind={kind()} />}
    </Show>
  );
}

function Payload(props: { label: string; value: string }): JSX.Element {
  return (
    <section aria-label={props.label} class={panelStyles.pmSection}>
      <div class={panelStyles.pmDetailHeading}>
        <span class={panelStyles.pmSectionTitle}>{props.label}</span>
      </div>
      <pre class={panelStyles.pmCode}>{props.value}</pre>
    </section>
  );
}

function CallDetails(props: { call: WebMcpCall }): JSX.Element {
  const duration = () => callDuration(props.call);
  const outcome = () => {
    const call = props.call;
    if (call.status === "succeeded") return <Payload label="Result" value={call.output} />;
    if (call.status === "failed") return <Payload label="Error" value={call.error} />;
    return undefined;
  };

  return (
    <>
      <section aria-label="Call summary" class={panelStyles.pmSection}>
        <div class={panelStyles.pmDetailHeading}>
          <span class={panelStyles.pmSectionTitle}>Call #{props.call.id}</span>
          <StatusBadge call={props.call} />
          <Show when={resultKind(props.call)}>
            {(kind) => <ResultBadge kind={kind()} prefix />}
          </Show>
          <Show when={duration()}>
            <Badge>{duration()}</Badge>
          </Show>
        </div>
        <div class={panelStyles.pmSectionBody}>
          <strong class={panelStyles.pmMono}>{props.call.name}</strong>
          <span class={panelStyles.pmRowDetail}>
            {callSources[props.call.source].label} ·{" "}
            <time dateTime={new Date(props.call.timestamp).toISOString()}>
              {new Date(props.call.timestamp).toLocaleTimeString()}
            </time>
          </span>
          <Show when={props.call.status === "succeeded" && props.call.resultReason}>
            {(reason) => (
              <p class={panelStyles.pmCallReason}>
                <strong>Reason</strong> {reason()}
              </p>
            )}
          </Show>
        </div>
        <p class={panelStyles.pmSectionNote}>
          The status reports whether the tool returned. The result kind reports what the evidence
          established.
        </p>
      </section>
      <Payload label="Input" value={props.call.input} />
      {outcome()}
    </>
  );
}

function CallHistory(props: { recorder: Recorder; calls: ReadonlyMap<number, WebMcpCall> }) {
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const ids = createMemo(() => Array.from(props.calls.keys()).reverse());
  const selected = () => {
    const id = selectedId();
    const chosen = id === null ? undefined : props.calls.get(id);
    return chosen ?? (ids()[0] === undefined ? undefined : props.calls.get(ids()[0]!));
  };

  return (
    <ResizableSplit label="WebMCP call list width">
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Calls</span>
          <span class={panelStyles.pmSpacer} />
          <button
            aria-label="Clear WebMCP call history"
            class={panelStyles.pmButton}
            disabled={props.calls.size === 0}
            onClick={() => {
              setSelectedId(null);
              props.recorder.clearCalls();
            }}
            type="button"
          >
            Clear
          </button>
        </div>
        <Show
          when={props.calls.size > 0}
          fallback={
            <p class={panelStyles.pmPerformanceNote}>
              No calls recorded from native WebMCP or Chrome DevTools MCP.
            </p>
          }
        >
          <ul aria-label="WebMCP call history" class={panelStyles.pmList}>
            <For each={ids()}>
              {(id) => (
                <Show when={props.calls.get(id)}>
                  {(call) => (
                    <li>
                      <button
                        aria-label={`Inspect ${call().name}, call #${call().id}`}
                        aria-pressed={selected()?.id === call().id}
                        class={panelStyles.pmListRow}
                        data-call-id={call().id}
                        onClick={() => setSelectedId(call().id)}
                        type="button"
                      >
                        <span class={panelStyles.pmMono}>#{call().id}</span>
                        <span class={panelStyles.pmRowMain} style={{ display: "grid", gap: "3px" }}>
                          <span class={cx(panelStyles.pmRowTitle, panelStyles.pmMono)}>
                            {call().name}
                          </span>
                          <span
                            class={panelStyles.pmRowDetail}
                            title={callSources[call().source].label}
                          >
                            {callSources[call().source].short} ·{" "}
                            {new Date(call().timestamp).toLocaleTimeString()}
                          </span>
                        </span>
                        <span style={{ display: "grid", gap: "3px", "justify-items": "end" }}>
                          <OutcomeBadge call={call()} />
                          <Show when={callDuration(call())}>
                            {(duration) => (
                              <span class={panelStyles.pmRowDetail}>{duration()}</span>
                            )}
                          </Show>
                        </span>
                      </button>
                    </li>
                  )}
                </Show>
              )}
            </For>
          </ul>
        </Show>
      </div>
      <div aria-label="WebMCP call details" class={panelStyles.pmPane}>
        <Show
          when={selected()}
          fallback={
            <div class={panelStyles.pmEmpty}>
              Calls from an agent appear here with their input and result.
            </div>
          }
        >
          {(call) => <CallDetails call={call()} />}
        </Show>
      </div>
    </ResizableSplit>
  );
}

function ToolList(props: { tools: readonly WebMcpToolMetadata[] }): JSX.Element {
  return (
    <ul class={panelStyles.pmList}>
      <For each={props.tools}>
        {(tool) => (
          <li class={panelStyles.pmSectionBody}>
            <strong class={panelStyles.pmMono}>{tool.name}</strong>
            <span class={panelStyles.pmMuted}>{tool.description}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

function AvailableTools(props: { recorder: Recorder }): JSX.Element {
  const [nativeTools, setNativeTools] = createSignal(props.recorder.tools());
  const [chrome, setChrome] = createSignal(props.recorder.chromeTools());
  onCleanup(props.recorder.tools.subscribe(() => setNativeTools(props.recorder.tools())));
  onCleanup(props.recorder.chromeTools.subscribe(() => setChrome(props.recorder.chromeTools())));
  const chromeState = () => {
    const exposure = chrome();
    if (!exposure) return { label: "Not installed", tone: undefined };
    if (exposure.discoveredAt === null) return { label: "Waiting for discovery", tone: "yellow" };
    return {
      label: `Discovered ${new Date(exposure.discoveredAt).toLocaleTimeString()}`,
      tone: "green",
    };
  };

  return (
    <div class={panelStyles.pmPane}>
      <section aria-label="Native WebMCP tools" class={panelStyles.pmSection}>
        <div class={panelStyles.pmDetailHeading}>
          <span class={panelStyles.pmSectionTitle}>Native WebMCP</span>
          <Badge tone={props.recorder.isSupported ? "green" : undefined}>
            {props.recorder.isSupported ? "Available" : "Unavailable"}
          </Badge>
        </div>
        <Show
          when={nativeTools().length > 0}
          fallback={
            <p class={panelStyles.pmSectionNote}>
              {props.recorder.isSupported
                ? "No WebMCP tools registered through this inspector."
                : "Native WebMCP is unavailable in this document, so no tools are registered with the browser."}
            </p>
          }
        >
          <ToolList tools={nativeTools()} />
        </Show>
      </section>
      <section aria-label="Chrome DevTools MCP tools" class={panelStyles.pmSection}>
        <div class={panelStyles.pmDetailHeading}>
          <span class={panelStyles.pmSectionTitle}>Chrome DevTools MCP</span>
          <Badge tone={chromeState().tone as BadgeTone}>{chromeState().label}</Badge>
        </div>
        <Show
          when={chrome()}
          fallback={
            <p class={panelStyles.pmSectionNote}>
              No Chrome DevTools MCP bridge is connected to this inspector.
            </p>
          }
        >
          {(exposure) => (
            <>
              <Show when={exposure().discoveredAt === null}>
                <p class={panelStyles.pmSectionNote}>
                  Offered through devtoolstooldiscovery. A Chrome DevTools MCP client has not
                  discovered them yet.
                </p>
              </Show>
              <ToolList tools={exposure().tools} />
            </>
          )}
        </Show>
      </section>
    </div>
  );
}

function WebMcpView(props: { recorder: Recorder }): JSX.Element {
  const { recorder } = props;
  const [view, setView] = createSignal<"calls" | "tools">("calls");
  const [calls, setCalls] = createSignal(recorder.calls());
  const [toolCount, setToolCount] = createSignal(0);
  const countTools = () =>
    setToolCount(recorder.tools().length + (recorder.chromeTools()?.tools.length ?? 0));
  countTools();
  onCleanup(recorder.calls.subscribe(() => setCalls(recorder.calls())));
  onCleanup(recorder.tools.subscribe(countTools));
  onCleanup(recorder.chromeTools.subscribe(countTools));

  return (
    <div class={panelStyles.pmWebMcpLayout}>
      <div class={panelStyles.pmPaneHeader} style={{ position: "static" }}>
        <ViewSwitch
          label="WebMCP view"
          onChange={setView}
          options={[
            { value: "calls", label: `Call history (${calls().size})` },
            { value: "tools", label: `Available tools (${toolCount()})` },
          ]}
          value={view()}
        />
      </div>
      <Show when={view() === "calls"} fallback={<AvailableTools recorder={recorder} />}>
        <CallHistory calls={calls()} recorder={recorder} />
      </Show>
    </div>
  );
}

export function createProseMirrorWebMcpInspector(options: WebMcpInspectorOptions = {}) {
  const recorder = createWebMcpRecorder(options);
  const { isSupported, registerTool, traceChromeToolCall, exposeChromeTools, dispose } = recorder;
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
  return {
    extension,
    isSupported,
    registerTool,
    traceChromeToolCall,
    exposeChromeTools,
    dispose,
  };
}
