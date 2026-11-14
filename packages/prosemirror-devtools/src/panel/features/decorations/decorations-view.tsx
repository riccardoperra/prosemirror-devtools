import { readInstanceState } from "../../store/instance-state";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js";

import type {
  DevtoolsDecorationSource,
  DevtoolsDiagnosticsSnapshot,
} from "../../../core/diagnostics";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { formatMs, formatTime } from "../../formatters";
import { JsonTree } from "../../json-tree";
import { cx, panelStyles } from "../../styles";
import { ViewSwitch } from "../../ui/view-switch";
import { Badge } from "../../ui/badge";
import { ResizableSplit } from "../../ui/resizable-split";
import { collectDecorationRows } from "./decoration-list";
import { mountDecorationOverlay } from "./decoration-overlay";

const PAGE_SIZE = 100;

function sameItems<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
const SETUP = `import { createProseMirrorDevtoolsSession } from "prosemirror-inspector/core";

const session = createProseMirrorDevtoolsSession({
  id: "editor",
  diagnostics: true,
});
const state = EditorState.create({
  schema,
  plugins: session.instrumentPlugins(plugins),
});
const view = new EditorView(element, { state });
session.attach(view);
// On teardown: session.dispose(); view.destroy();`;

function DiagnosticsSetup(): JSX.Element {
  return (
    <div class={panelStyles.pmScroll} style={{ padding: "16px" }}>
      <h2 style={{ "font-size": "14px", margin: "0 0 8px" }}>Enable decoration diagnostics</h2>
      <p>
        Opt in before creating the editor to observe decoration results and NodeView lifecycles as
        instrumented plugin hooks run.
      </p>
      <pre
        aria-label="Decoration diagnostics setup"
        class={panelStyles.pmMono}
        style={{ "white-space": "pre-wrap", "overflow-wrap": "anywhere" }}
      >
        {SETUP}
      </pre>
      <p class={panelStyles.pmMuted}>
        Only instrumented plugin props are observed. The inspector does not invoke hooks or change
        editor content.
      </p>
    </div>
  );
}

export function DecorationsView(props: { instance: RegisteredProseMirrorInstance }): JSX.Element {
  const diagnostics = createMemo(() => props.instance.diagnostics);
  const [snapshot, setSnapshot] = createSignal<DevtoolsDiagnosticsSnapshot>();
  const [mode, setMode] = createSignal<"decorations" | "nodeViews">("decorations");
  const [plugin, setPlugin] = createSignal("");
  const [kind, setKind] = createSignal("all");
  const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE);
  const [rangeId, setRangeId] = createSignal<string>();
  const [nodeViewId, setNodeViewId] = createSignal<number>();
  const [overlay, setOverlay] = createSignal(false);
  const [overlayError, setOverlayError] = createSignal<string>();
  let overlayDocument: ProseMirrorNode | undefined;

  createEffect(() => {
    const controller = diagnostics();
    if (!controller) {
      setSnapshot(undefined);
      return;
    }
    const update = (): void => {
      setSnapshot(controller.getSnapshot());
    };
    const unsubscribe = controller.subscribe(update);
    update();
    onCleanup(unsubscribe);
  });

  const sources = createMemo(() => snapshot()?.decorations ?? [], undefined, { equals: sameItems });
  const currentDocument = createMemo(() => readInstanceState(props.instance).doc);
  const observedDocuments = new WeakMap<DevtoolsDecorationSource["ranges"], ProseMirrorNode>();
  const currentSources = createMemo(
    () => {
      const doc = currentDocument();
      return sources().map((source) => {
        if (!source.stale && !observedDocuments.has(source.ranges))
          observedDocuments.set(source.ranges, doc);
        return source.stale || observedDocuments.get(source.ranges) === doc
          ? source
          : { ...source, stale: true };
      });
    },
    undefined,
    { equals: sameItems },
  );
  const observedNodeViews = createMemo(() => snapshot()?.nodeViews ?? [], undefined, {
    equals: sameItems,
  });

  const plugins = createMemo(() => {
    const labels = new Map<string, string>();
    for (const source of sources()) labels.set(source.pluginKey, source.pluginLabel);
    for (const nodeView of observedNodeViews())
      labels.set(nodeView.pluginKey, nodeView.pluginLabel);
    return [...labels].sort((left, right) => left[1].localeCompare(right[1]));
  });
  const rangeList = createMemo(() =>
    collectDecorationRows(currentSources(), plugin(), kind(), visibleCount()),
  );
  const nodeViews = createMemo(() =>
    observedNodeViews().filter((nodeView) => !plugin() || nodeView.pluginKey === plugin()),
  );
  const selectedRange = createMemo(
    () => rangeList().rows.find(({ id }) => id === rangeId()) ?? rangeList().rows[0],
  );
  const selectedNodeView = createMemo(
    () => nodeViews().find(({ id }) => id === nodeViewId()) ?? nodeViews()[0],
  );
  const visibleNodeViews = createMemo(() => nodeViews().slice(0, visibleCount()));
  const totalRows = (): number =>
    mode() === "decorations" ? rangeList().total : nodeViews().length;
  const counts = createMemo(() =>
    nodeViews().reduce(
      (totals, item) => ({
        live: totals.live + Number(!item.destroyed),
        updates: totals.updates + item.updates,
        destroys: totals.destroys + item.destroys,
      }),
      { live: 0, updates: 0, destroys: 0 },
    ),
  );

  const resetOverlay = (): void => {
    setOverlay(false);
    setOverlayError(undefined);
    overlayDocument = undefined;
  };
  const resetList = (): void => {
    setVisibleCount(PAGE_SIZE);
    resetOverlay();
  };

  createEffect(() => {
    const selected = selectedRange();
    const view = props.instance.view;
    const doc = currentDocument();
    if (!overlay() || mode() !== "decorations" || !selected) return;
    if (selected.source.stale || doc !== overlayDocument || view.state.doc !== doc) {
      resetOverlay();
      return;
    }
    const cleanup = mountDecorationOverlay(view, selected.range, () => {
      setOverlay(false);
      setOverlayError("This position is no longer available in the editor.");
    });
    onCleanup(cleanup);
  });

  return (
    <Show when={diagnostics()} fallback={<DiagnosticsSetup />}>
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          "block-size": "100%",
          "min-block-size": "0",
        }}
      >
        <div class={panelStyles.pmPaneHeader}>
          <ViewSwitch
            label="Decoration diagnostics view"
            onChange={(next) => {
              setMode(next);
              resetList();
            }}
            options={[
              { value: "decorations", label: `Decorations ${rangeList().total}` },
              { value: "nodeViews", label: `Node views ${nodeViews().length}` },
            ]}
            value={mode()}
          />
          <select
            aria-label="Filter diagnostics by plugin"
            class={panelStyles.pmInstanceSelect}
            onChange={(event) => {
              setPlugin(event.currentTarget.value);
              resetList();
            }}
            value={plugin()}
          >
            <option value="">All plugins</option>
            <For each={plugins()}>{([key, label]) => <option value={key}>{label}</option>}</For>
          </select>
          <Show when={mode() === "decorations"}>
            <select
              aria-label="Filter decoration type"
              class={panelStyles.pmInstanceSelect}
              onChange={(event) => {
                setKind(event.currentTarget.value);
                resetList();
              }}
              value={kind()}
            >
              <option value="all">All decoration types</option>
              <option value="inline">Inline</option>
              <option value="node">Node</option>
              <option value="widget">Widget</option>
            </select>
          </Show>
        </div>
        <Show when={mode() === "nodeViews"}>
          <div aria-label="Retained NodeView lifecycle counts" class={panelStyles.pmInspectorStats}>
            <Badge>{nodeViews().length} retained creations</Badge>
            <Badge tone="green">{counts().live} live</Badge>
            <Badge>{counts().updates} updates</Badge>
            <Badge>{counts().destroys} destroys</Badge>
            <span class={panelStyles.pmSpacer} />
            <button
              class={panelStyles.pmButton}
              disabled={nodeViews().length === 0}
              onClick={() => diagnostics()?.clearNodeViews()}
              title="Reset counters for all plugins, retain live views, and remove destroyed records"
              type="button"
            >
              Reset counters
            </button>
          </div>
        </Show>
        <ResizableSplit label="Rendering list width" style={{ flex: "1", "min-block-size": "0" }}>
          <div class={panelStyles.pmPane}>
            <Show
              when={totalRows() > 0}
              fallback={
                <div class={panelStyles.pmEmpty}>
                  <p>
                    {plugin() || kind() !== "all"
                      ? "No observations match these filters."
                      : mode() === "decorations"
                        ? "No decorations observed yet. Interact with an editor using instrumented decoration plugins."
                        : "No NodeViews observed yet. Instrument plugins before creating the editor to capture NodeView creation."}
                  </p>
                </div>
              }
            >
              <ul
                aria-label={
                  mode() === "decorations" ? "Observed decorations" : "Observed NodeViews"
                }
                class={panelStyles.pmList}
              >
                <Show when={mode() === "decorations"}>
                  <For each={rangeList().rows}>
                    {(item) => (
                      <li>
                        <button
                          aria-pressed={selectedRange()?.id === item.id}
                          class={panelStyles.pmListRow}
                          onClick={() => {
                            setRangeId(item.id);
                            resetOverlay();
                          }}
                          type="button"
                        >
                          <span class={panelStyles.pmRowMain}>
                            <span class={panelStyles.pmRowTitle}>{item.source.pluginLabel}</span>
                            <span class={cx(panelStyles.pmRowDetail, panelStyles.pmMono)}>
                              {item.range.from}–{item.range.to}
                            </span>
                          </span>
                          <Badge>{item.range.kind}</Badge>
                          <Show when={item.source.stale}>
                            <Badge tone="yellow">stale</Badge>
                          </Show>
                        </button>
                      </li>
                    )}
                  </For>
                </Show>
                <Show when={mode() === "nodeViews"}>
                  <For each={visibleNodeViews()}>
                    {(item) => (
                      <li>
                        <button
                          aria-pressed={selectedNodeView()?.id === item.id}
                          class={panelStyles.pmListRow}
                          onClick={() => setNodeViewId(item.id)}
                          type="button"
                        >
                          <span class={panelStyles.pmRowMain}>
                            <span class={panelStyles.pmRowTitle}>
                              {item.nodeType} #{item.id}
                            </span>
                            <span class={panelStyles.pmRowDetail}>
                              {item.pluginLabel} · {item.updates} updates
                            </span>
                          </span>
                          <Badge tone={item.destroyed ? undefined : "green"}>
                            {item.destroyed ? "destroyed" : "live"}
                          </Badge>
                        </button>
                      </li>
                    )}
                  </For>
                </Show>
              </ul>
              <Show when={totalRows() > visibleCount()}>
                <button
                  class={panelStyles.pmListRow}
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  type="button"
                >
                  Show more ({totalRows() - visibleCount()} remaining)
                </button>
              </Show>
            </Show>
          </div>
          <div class={panelStyles.pmPane}>
            <Show when={mode() === "decorations"}>
              <Show
                when={selectedRange()}
                fallback={
                  <div class={panelStyles.pmEmpty}>
                    Select a decoration to inspect its captured range and spec.
                  </div>
                }
              >
                {(selected) => (
                  <>
                    <div class={panelStyles.pmDetailHeading}>
                      <span class={panelStyles.pmSectionTitle}>
                        {selected().source.pluginLabel}
                      </span>
                      <Badge>{selected().range.kind}</Badge>
                      <Badge tone={selected().source.stale ? "yellow" : "green"}>
                        {selected().source.stale ? "stale" : "current document"}
                      </Badge>
                    </div>
                    <div class={panelStyles.pmInspectorStats}>
                      <Badge>from {selected().range.from}</Badge>
                      <Badge>to {selected().range.to}</Badge>
                      <Badge>observed {formatTime(selected().source.observedAt)}</Badge>
                    </div>
                    <div class={panelStyles.pmPaneHeader}>
                      <button
                        aria-pressed={overlay()}
                        class={panelStyles.pmButton}
                        disabled={selected().source.stale}
                        onClick={() => {
                          if (overlay()) resetOverlay();
                          else {
                            if (props.instance.view.state.doc !== currentDocument()) return;
                            overlayDocument = currentDocument();
                            setOverlayError(undefined);
                            setOverlay(true);
                          }
                        }}
                        type="button"
                      >
                        {overlay() ? "Hide positions in editor" : "Show positions in editor"}
                      </button>
                      <span class={panelStyles.pmMuted}>
                        Multiline ranges show their endpoints.
                      </span>
                    </div>
                    <Show when={selected().source.stale}>
                      <p class={panelStyles.pmWarning}>
                        These positions belong to an older document. Overlay is unavailable until
                        the plugin produces a fresh result.
                      </p>
                    </Show>
                    <Show when={overlayError()}>
                      <p role="status" class={panelStyles.pmWarning}>
                        {overlayError()}
                      </p>
                    </Show>
                    <JsonTree
                      name="Decoration spec"
                      defaultExpandedDepth={0}
                      value={selected().range.spec}
                    />
                    <p class={panelStyles.pmMuted} style={{ padding: "0 9px" }}>
                      Source: {selected().source.pluginKey}. Values are captured observations;
                      inspecting them does not call the plugin.
                    </p>
                  </>
                )}
              </Show>
            </Show>
            <Show when={mode() === "nodeViews"}>
              <Show
                when={selectedNodeView()}
                fallback={
                  <div class={panelStyles.pmEmpty}>
                    Select a NodeView to inspect its observed lifecycle.
                  </div>
                }
              >
                {(selected) => (
                  <>
                    <div class={panelStyles.pmDetailHeading}>
                      <span class={panelStyles.pmSectionTitle}>
                        {selected().nodeType} #{selected().id}
                      </span>
                      <Badge tone={selected().destroyed ? undefined : "green"}>
                        {selected().destroyed ? "destroyed" : "live"}
                      </Badge>
                    </div>
                    <table aria-label="Selected NodeView lifecycle" class={panelStyles.pmTable}>
                      <tbody>
                        <tr>
                          <th scope="row">Plugin</th>
                          <td>{selected().pluginLabel}</td>
                        </tr>
                        <tr>
                          <th scope="row">Last observed position</th>
                          <td>{selected().position ?? "unavailable"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Updates</th>
                          <td>{selected().updates}</td>
                        </tr>
                        <tr>
                          <th scope="row">Destroys</th>
                          <td>{selected().destroys}</td>
                        </tr>
                        <tr>
                          <th scope="row">Total observed time</th>
                          <td>{formatMs(selected().totalDuration)}</td>
                        </tr>
                        <tr>
                          <th scope="row">Last observed time</th>
                          <td>{formatMs(selected().lastDuration)}</td>
                        </tr>
                        <tr>
                          <th scope="row">Created</th>
                          <td>{formatTime(selected().createdAt)}</td>
                        </tr>
                        <tr>
                          <th scope="row">Last observed</th>
                          <td>{formatTime(selected().updatedAt)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <Show when={selected().error}>
                      <p class={panelStyles.pmWarning} role="status">
                        {selected().error}
                      </p>
                    </Show>
                    <JsonTree
                      name="NodeView observation"
                      defaultExpandedDepth={0}
                      value={selected()}
                    />
                    <p class={panelStyles.pmMuted} style={{ padding: "0 9px" }}>
                      Counts cover retained, instrumented NodeViews. Positions and status reflect
                      the last observed lifecycle callback.
                    </p>
                  </>
                )}
              </Show>
            </Show>
          </div>
        </ResizableSplit>
      </div>
    </Show>
  );
}
