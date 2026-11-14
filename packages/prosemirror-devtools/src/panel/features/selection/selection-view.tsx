import type { Mark, Node as ProseMirrorNode, ResolvedPos } from "prosemirror-model";
import { NodeSelection, type Selection } from "prosemirror-state";
import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { useOptionalPanelContext } from "../../panel-provider";
import { readInstanceState } from "../../store/instance-state";
import { panelStyles } from "../../styles";
import { Badge } from "../../ui/badge";
import { ResizableSplit } from "../../ui/resizable-split";
import { nodeHue } from "../state/document-boxes";
import { previewText } from "../state/document-tree";

/** A node shown next to a position. `node` may be a cut text node; `target` is where the whole node starts. */
export type PositionNodeRef = Readonly<{
  node: ProseMirrorNode;
  from: number;
  to: number;
  target: number;
  isRoot: boolean;
}>;

export type PositionPlace = "empty" | "start" | "end" | "inside";

const MAX_SLICE_NODES = 12;
const MAX_SLICE_TEXT = 160;

function placeIn(parent: ProseMirrorNode, offset: number): PositionPlace {
  if (parent.content.size === 0) return "empty";
  if (offset === 0) return "start";
  return offset === parent.content.size ? "end" : "inside";
}

/** What a resolved position says, in the terms `ResolvedPos` uses. */
export function describePosition(position: ResolvedPos) {
  const { parent, parentOffset, textOffset } = position;
  const before = position.nodeBefore;
  const after = position.nodeAfter;
  return {
    pos: position.pos,
    depth: position.depth,
    parentOffset,
    textOffset,
    path: Array.from({ length: position.depth + 1 }, (_, depth): PositionNodeRef => {
      const node = position.node(depth);
      const from = depth === 0 ? 0 : position.before(depth);
      return {
        node,
        from,
        to: depth === 0 ? node.content.size : position.after(depth),
        target: from,
        isRoot: depth === 0,
      };
    }),
    nodeBefore: before
      ? {
          node: before,
          from: position.pos - before.nodeSize,
          to: position.pos,
          target: position.pos - before.nodeSize,
          isRoot: false,
        }
      : null,
    nodeAfter: after
      ? {
          node: after,
          from: position.pos,
          to: position.pos + after.nodeSize,
          // Inside a text node, `nodeAfter` is cut at the position; the node itself starts earlier.
          target: position.pos - textOffset,
          isRoot: false,
        }
      : null,
    place: placeIn(parent, parentOffset),
    marks: position.marks(),
  };
}

const placeLabel: Record<PositionPlace, string> = {
  empty: "in an empty node",
  start: "at start",
  end: "at end",
  inside: "inside",
};

function Field(props: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <>
      <dt>{props.label}</dt>
      <dd>{props.children}</dd>
    </>
  );
}

function None(): JSX.Element {
  return <span class={panelStyles.pmMuted}>none</span>;
}

function MarkList(props: { marks: readonly Mark[] }): JSX.Element {
  return (
    <Show when={props.marks.length > 0} fallback={<None />}>
      <For each={props.marks}>
        {(mark) => (
          <span
            class={panelStyles.pmDocBoxMark}
            title={Object.keys(mark.attrs).length ? JSON.stringify(mark.attrs) : undefined}
          >
            {mark.type.name}
          </span>
        )}
      </For>
    </Show>
  );
}

function NodeChipContent(props: {
  node: ProseMirrorNode;
  range?: readonly [number, number] | undefined;
}): JSX.Element {
  return (
    <>
      <Show
        when={props.node.isText}
        fallback={<span class={panelStyles.pmNodeName}>{props.node.type.name}</span>}
      >
        <span class={panelStyles.pmDocBoxText}>{previewText(props.node.text ?? "")}</span>
      </Show>
      <For each={props.node.marks}>
        {(mark) => <span class={panelStyles.pmDocBoxMark}>{mark.type.name}</span>}
      </For>
      <Show when={props.range}>
        {(range) => (
          <span class={panelStyles.pmNodeRange}>
            {range()[0]}–{range()[1]}
          </span>
        )}
      </Show>
    </>
  );
}

/** A node chip, styled like the Boxes view. Clicking it inspects the node in the State view. */
function NodeRef(props: {
  value: PositionNodeRef | null;
  onInspect?: ((ref: PositionNodeRef) => void) | undefined;
  showRange?: boolean;
}): JSX.Element {
  const range = (ref: PositionNodeRef) =>
    props.showRange === false ? undefined : ([ref.from, ref.to] as const);
  return (
    <Show when={props.value} fallback={<None />}>
      {(ref) => (
        <span
          class={panelStyles.pmDocBoxChip}
          data-node-type={ref().node.type.name}
          style={{ "--pm-node-hue": nodeHue(ref().node.type.name) } as JSX.CSSProperties}
        >
          <Show
            when={props.onInspect}
            fallback={
              <span class={panelStyles.pmDocBoxChipMain}>
                <NodeChipContent node={ref().node} range={range(ref())} />
              </span>
            }
          >
            {(inspect) => (
              <button
                class={panelStyles.pmDocBoxChipMain}
                onClick={() => inspect()(ref())}
                title="Inspect this node in the document"
                type="button"
              >
                <NodeChipContent node={ref().node} range={range(ref())} />
              </button>
            )}
          </Show>
        </span>
      )}
    </Show>
  );
}

function PositionCard(props: {
  name: string;
  position: ResolvedPos;
  onInspect?: ((ref: PositionNodeRef) => void) | undefined;
  onSchema?: ((pos: number) => void) | undefined;
  onClear?: () => void;
}): JSX.Element {
  const info = createMemo(() => describePosition(props.position));
  const parent = (): PositionNodeRef => info().path[info().path.length - 1]!;
  const offset = (): string =>
    info().textOffset > 0
      ? `${info().parentOffset} · ${info().textOffset} into the text`
      : String(info().parentOffset);

  return (
    <section aria-label={`${props.name} position`} class={panelStyles.pmSection}>
      <div class={panelStyles.pmDetailHeading}>
        <span class={panelStyles.pmSectionTitle}>{props.name}</span>
        <Badge tone="blue">pos {info().pos}</Badge>
        <span class={panelStyles.pmSpacer} />
        <Show when={props.onInspect}>
          {(inspect) => (
            <button
              aria-label={`Inspect ${props.name.toLowerCase()} in document`}
              class={panelStyles.pmInlineAction}
              onClick={() => inspect()(parent())}
              type="button"
            >
              Inspect
            </button>
          )}
        </Show>
        <Show when={props.onSchema}>
          {(schema) => (
            <button
              aria-label={`Show schema at ${props.name.toLowerCase()}`}
              class={panelStyles.pmInlineAction}
              onClick={() => schema()(info().pos)}
              type="button"
            >
              Schema
            </button>
          )}
        </Show>
        <Show when={props.onClear}>
          {(clear) => (
            <button class={panelStyles.pmInlineAction} onClick={() => clear()()} type="button">
              Clear
            </button>
          )}
        </Show>
      </div>
      <dl class={panelStyles.pmFields}>
        <Field label="path">
          <span class={panelStyles.pmPath}>
            <For each={info().path}>
              {(ref, index) => (
                <>
                  <Show when={index() > 0}>
                    <span aria-hidden="true" class={panelStyles.pmPathSeparator}>
                      ›
                    </span>
                  </Show>
                  <NodeRef onInspect={props.onInspect} showRange={false} value={ref} />
                </>
              )}
            </For>
          </span>
        </Field>
        <Field label="parent">
          <NodeRef onInspect={props.onInspect} value={parent()} />
          <span class={panelStyles.pmMuted}>
            depth {info().depth} · {placeLabel[info().place]}
          </span>
        </Field>
        <Field label="offset">{offset()}</Field>
        <Field label="before">
          <NodeRef onInspect={props.onInspect} value={info().nodeBefore} />
        </Field>
        <Field label="after">
          <NodeRef onInspect={props.onInspect} value={info().nodeAfter} />
        </Field>
        <Field label="marks">
          <MarkList marks={info().marks} />
        </Field>
      </dl>
    </section>
  );
}

function selectionKind(selection: Selection): string {
  return String(selection.toJSON().type ?? selection.constructor.name);
}

export function SelectionView(props: { instance: RegisteredProseMirrorInstance }): JSX.Element {
  const state = createMemo(() => readInstanceState(props.instance));
  const selection = createMemo(() => state().selection);
  const [requested, setRequested] = createSignal("");
  const panelContext = useOptionalPanelContext();
  const inspection = panelContext?.inspection;
  const navigation = panelContext?.navigation;

  const backward = (): boolean => selection().anchor > selection().head;
  const size = (): number => selection().to - selection().from;
  const selectedNode = createMemo((): PositionNodeRef | null => {
    const current = selection();
    return current instanceof NodeSelection
      ? {
          node: current.node,
          from: current.from,
          to: current.to,
          target: current.from,
          isRoot: false,
        }
      : null;
  });
  const marks = createMemo(() => {
    const stored = state().storedMarks;
    // Stored marks win over the cursor's; an empty array explicitly clears them.
    if (stored) return { marks: stored, source: "stored" };
    if (selection().empty) return { marks: selection().$head.marks(), source: "at cursor" };
    return {
      marks: selection().$from.marksAcross(selection().$to) ?? [],
      source: "across selection",
    };
  });
  const content = createMemo(() => {
    if (selection().empty) return null;
    const slice = selection().content();
    const nodes: ProseMirrorNode[] = [];
    slice.content.forEach((node) => nodes.push(node));
    const text = slice.content.textBetween(0, slice.content.size, "\n", "￼");
    return {
      text: text.length > MAX_SLICE_TEXT ? `${text.slice(0, MAX_SLICE_TEXT)}…` : text,
      nodes: nodes.slice(0, MAX_SLICE_NODES),
      more: Math.max(0, nodes.length - MAX_SLICE_NODES),
      openStart: slice.openStart,
      openEnd: slice.openEnd,
    };
  });
  const json = createMemo(() => JSON.stringify(selection().toJSON(), null, 2));
  const probe = createMemo((): { position: ResolvedPos | null; error: string | null } => {
    const value = requested().trim();
    if (!value) return { position: null, error: null };
    const pos = Number(value);
    const max = state().doc.content.size;
    return Number.isInteger(pos) && pos >= 0 && pos <= max
      ? { position: state().doc.resolve(pos), error: null }
      : { position: null, error: `Enter a whole position between 0 and ${max}.` };
  });

  const inspect = navigation
    ? (ref: PositionNodeRef): void => {
        inspection?.selectPosition({ doc: state().doc, pos: ref.target, isRoot: ref.isRoot });
        navigation.selectPanel("state");
      }
    : undefined;
  const showSchema = navigation
    ? (pos: number): void => {
        inspection?.selectPosition({ doc: state().doc, pos, isRoot: false });
        navigation.selectPanel("schema");
      }
    : undefined;

  return (
    <ResizableSplit label="Selection width">
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Selection</span>
          <Badge tone="blue">{selectionKind(selection())}</Badge>
        </div>
        <section aria-label="Selection summary" class={panelStyles.pmSection}>
          <dl class={panelStyles.pmFields}>
            <Field label="range">
              <span>
                {selection().from}–{selection().to}
              </span>
              <span class={panelStyles.pmMuted}>
                {selection().empty
                  ? "empty"
                  : `${size()} ${size() === 1 ? "position" : "positions"}`}
                <Show when={!selection().empty}>{backward() ? " · backward" : " · forward"}</Show>
              </span>
            </Field>
            <Show when={selectedNode()}>
              <Field label="node">
                <NodeRef onInspect={inspect} value={selectedNode()} />
              </Field>
            </Show>
            <Show when={selection().ranges.length > 1}>
              <Field label="ranges">
                {selection()
                  .ranges.map(({ $from, $to }) => `${$from.pos}–${$to.pos}`)
                  .join(", ")}
              </Field>
            </Show>
            <Field label="marks">
              <MarkList marks={marks().marks} />
              <span class={panelStyles.pmMuted} data-marks-source={marks().source}>
                {marks().source}
              </span>
            </Field>
          </dl>
        </section>
        <Show when={content()}>
          {(slice) => (
            <section aria-label="Selected content" class={panelStyles.pmSection}>
              <div class={panelStyles.pmDetailHeading}>
                <span class={panelStyles.pmSectionTitle}>Content</span>
                <span class={panelStyles.pmMuted}>selection.content()</span>
              </div>
              <dl class={panelStyles.pmFields}>
                <Field label="text">
                  <span class={panelStyles.pmWrapText}>{JSON.stringify(slice().text)}</span>
                </Field>
                <Field label="nodes">
                  <For each={slice().nodes}>
                    {(node) => (
                      <span
                        class={panelStyles.pmDocBoxChip}
                        data-node-type={node.type.name}
                        style={{ "--pm-node-hue": nodeHue(node.type.name) } as JSX.CSSProperties}
                      >
                        <span class={panelStyles.pmDocBoxChipMain}>
                          <NodeChipContent node={node} />
                        </span>
                      </span>
                    )}
                  </For>
                  <Show when={slice().more > 0}>
                    <span class={panelStyles.pmMuted}>and {slice().more} more</span>
                  </Show>
                </Field>
                <Show when={slice().openStart > 0 || slice().openEnd > 0}>
                  <Field label="open">
                    start {slice().openStart} · end {slice().openEnd}
                  </Field>
                </Show>
              </dl>
            </section>
          )}
        </Show>
        <section aria-label="Selection JSON" class={panelStyles.pmSection}>
          <div class={panelStyles.pmDetailHeading}>
            <span class={panelStyles.pmSectionTitle}>JSON</span>
            <span class={panelStyles.pmMuted}>selection.toJSON()</span>
          </div>
          <pre class={panelStyles.pmCode}>{json()}</pre>
        </section>
      </div>
      <div class={panelStyles.pmPane}>
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Resolved positions</span>
          <span class={panelStyles.pmSpacer} />
          <label class={panelStyles.pmMuted}>
            Resolve{" "}
            <input
              aria-label="Position to resolve"
              class={`${panelStyles.pmSearch} ${panelStyles.pmNumberInput}`}
              max={state().doc.content.size}
              min="0"
              onInput={(event) => setRequested(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setRequested("");
              }}
              placeholder="pos"
              type="number"
              value={requested()}
            />
          </label>
        </div>
        <Show
          when={selection().empty}
          fallback={
            <>
              <PositionCard
                name="Anchor"
                onInspect={inspect}
                onSchema={showSchema}
                position={selection().$anchor}
              />
              <PositionCard
                name="Head"
                onInspect={inspect}
                onSchema={showSchema}
                position={selection().$head}
              />
            </>
          }
        >
          <PositionCard
            name="Cursor"
            onInspect={inspect}
            onSchema={showSchema}
            position={selection().$head}
          />
        </Show>
        <Show when={probe().position}>
          {(position) => (
            <PositionCard
              name="Position"
              onClear={() => setRequested("")}
              onInspect={inspect}
              onSchema={showSchema}
              position={position()}
            />
          )}
        </Show>
        <Show when={probe().error}>
          <p class={panelStyles.pmSectionNote} role="alert">
            {probe().error}
          </p>
        </Show>
      </div>
    </ResizableSplit>
  );
}
