import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachProseMirrorDevtools, createProseMirrorDevtoolsStore } from "../src/core";
import { startNodePicker } from "../src/panel/features/inspector/node-picker";
import {
  readRenderedDom,
  readSerializedDom,
  type RenderedDomEntry,
} from "../src/panel/features/state/rendered-dom";
import { ProseMirrorDevtoolsPanel } from "../src/panel/panel";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block", toDOM: () => ["p", 0] },
    blockquote: { content: "block+", group: "block", toDOM: () => ["blockquote", 0] },
    hard_break: { inline: true, group: "inline", toDOM: () => ["br"] },
    text: { group: "inline" },
  },
  marks: {
    strong: { toDOM: () => ["strong", 0] },
    em: { toDOM: () => ["em", 0] },
  },
});

function nestedMarksDoc() {
  const strong = schema.marks.strong.create();
  const em = schema.marks.em.create();
  return schema.node("doc", null, [
    schema.node("paragraph", null, [
      schema.text("This is "),
      schema.text("strong text with ", [strong]),
      schema.text("emphasis", [strong, em]),
    ]),
    schema.node("paragraph", null, [schema.text("a"), schema.node("hard_break"), schema.text("b")]),
  ]);
}

function mountPanel(doc = nestedMarksDoc(), getState?: () => EditorState) {
  const mount = document.createElement("div");
  document.body.append(mount);
  const view = new EditorView(mount, {
    state: EditorState.create({ schema, doc }),
  });
  const store = createProseMirrorDevtoolsStore();
  const attachment = attachProseMirrorDevtools({
    id: "editor",
    view,
    store,
    performanceMarks: false,
    ...(getState ? { getState } : {}),
  });
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(
    () => <ProseMirrorDevtoolsPanel defaultPanel="state" store={store} />,
    container,
  );
  const documentViewLabels = () =>
    Array.from(
      container.querySelectorAll<HTMLButtonElement>('[aria-label="Document view"] button'),
      (button) => button.textContent,
    );
  const showView = (ariaLabel: string) =>
    container.querySelector<HTMLButtonElement>(`[aria-label="${ariaLabel}"]`)!.click();

  cleanups.push(() => {
    dispose();
    attachment.detach();
    view.destroy();
  });

  return { container, view, documentViewLabels, showView };
}

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
});

describe("document views", () => {
  it("offers every document view without any option and opens on Boxes", () => {
    const panel = mountPanel();
    expect(panel.documentViewLabels()).toEqual(["Boxes", "Structure", "JSON", "DOM"]);
    expect(
      panel.container
        .querySelector('[aria-label="Show document as nested boxes"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("renders inline content as a flat row of chips carrying their marks", () => {
    const panel = mountPanel();
    panel.showView("Show document as nested boxes");

    const paragraph = panel.container.querySelector('.pm-doc-box[data-node-type="paragraph"]')!;
    const chips = Array.from(paragraph.querySelectorAll(".pm-doc-box-inline > .pm-doc-box-chip"));
    expect(
      chips.map((chip) => ({
        text: chip.querySelector(".pm-doc-box-text")?.textContent,
        marks: Array.from(chip.querySelectorAll(".pm-doc-box-mark"), (mark) => mark.textContent),
        range: chip.querySelector(".pm-node-range")?.textContent,
      })),
    ).toEqual([
      { text: '"This is "', marks: [], range: "1–9" },
      { text: '"strong text with "', marks: ["strong"], range: "9–26" },
      { text: '"emphasis"', marks: ["strong", "em"], range: "26–34" },
    ]);

    const secondParagraph = panel.container.querySelectorAll(
      '.pm-doc-box[data-node-type="paragraph"]',
    )[1]!;
    expect(
      Array.from(secondParagraph.querySelectorAll(".pm-doc-box-chip"), (chip) =>
        chip.getAttribute("data-node-type"),
      ),
    ).toEqual(["text", "hard_break", "text"]);
  });

  it("opens collapsed boxes that hold the inspected node", () => {
    const panel = mountPanel(
      schema.node("doc", null, [
        schema.node("blockquote", null, [
          schema.node("blockquote", null, [schema.node("paragraph", null, [schema.text("deep")])]),
        ]),
      ]),
    );
    const box = (type: string) =>
      panel.container.querySelector<HTMLElement>(`.pm-doc-box[data-node-type="${type}"]`);
    panel.showView("Show document as nested boxes");
    expect(box("paragraph")).toBeNull();

    panel.container.querySelector<HTMLButtonElement>('[aria-label="Expand blockquote"]')!.click();
    panel.container.querySelector<HTMLButtonElement>('[aria-label="Expand paragraph"]')!.click();
    box("paragraph")!.querySelector<HTMLButtonElement>(".pm-doc-box-chip-main")!.click();
    panel.showView("Show document structure");
    panel.showView("Show document as nested boxes");

    expect(
      box("paragraph")!.querySelector(".pm-doc-box-chip")?.getAttribute("data-inspected"),
    ).toBe("true");
  });

  it("inspects the node of a clicked chip", () => {
    const panel = mountPanel();
    panel.showView("Show document as nested boxes");

    const emphasis = panel.container.querySelectorAll<HTMLElement>(".pm-doc-box-chip")[2]!;
    emphasis.querySelector<HTMLButtonElement>(".pm-doc-box-chip-main")!.click();

    expect(emphasis.getAttribute("data-inspected")).toBe("true");
    expect(panel.container.textContent).toContain("open 26");
    expect(panel.container.textContent).toContain("close 34");
  });
});

function outline(entry: RenderedDomEntry): unknown {
  if (entry.kind === "text")
    return `${JSON.stringify(entry.text)}${entry.range ? ` ${entry.range.from}–${entry.range.to}` : ""}`;
  const { role } = entry;
  return {
    tag: entry.tag,
    role:
      role === null
        ? null
        : role.kind === "node" || role.kind === "mark"
          ? `${role.kind} ${role.name} ${role.from}–${role.to}`
          : role.kind === "widget"
            ? `widget @${role.from}`
            : "outside",
    children: entry.children.map(outline),
  };
}

describe("rendered DOM", () => {
  it("labels elements with the node or mark they render and text with its positions", () => {
    const { view } = mountPanel();
    const { entries, truncated } = readRenderedDom(view);

    expect(truncated).toBe(false);
    expect(entries.map(outline)).toEqual([
      {
        tag: "div",
        role: "node doc 0–40",
        children: [
          {
            tag: "p",
            role: "node paragraph 0–35",
            children: [
              '"This is " 1–9',
              {
                tag: "strong",
                role: "mark strong 9–34",
                children: [
                  '"strong text with " 9–26',
                  { tag: "em", role: "mark em 26–34", children: ['"emphasis" 26–34'] },
                ],
              },
            ],
          },
          {
            tag: "p",
            role: "node paragraph 35–40",
            children: [
              '"a" 36–37',
              { tag: "br", role: "node hard_break 37–38", children: [] },
              '"b" 38–39',
            ],
          },
        ],
      },
    ]);
  });

  it("tells widgets and decoration wrappers apart from document content", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("This is "),
        schema.text("bold", [schema.marks.strong.create()]),
      ]),
    ]);
    const mount = document.createElement("div");
    document.body.append(mount);
    const view = new EditorView(mount, {
      state: EditorState.create({ schema, doc }),
      decorations: (state) =>
        DecorationSet.create(state.doc, [
          Decoration.widget(1, () => document.createElement("i")),
          Decoration.inline(1, 5, { class: "highlight" }),
          Decoration.node(0, 14, { nodeName: "section" }),
        ]),
    });
    cleanups.push(() => view.destroy());

    expect(readRenderedDom(view).entries.map(outline)).toEqual([
      {
        tag: "div",
        role: "node doc 0–14",
        children: [
          {
            tag: "section",
            role: "outside",
            children: [
              {
                tag: "p",
                role: "node paragraph 0–14",
                children: [
                  { tag: "i", role: "widget @1", children: [] },
                  { tag: "span", role: "outside", children: ['"This" 1–5'] },
                  '" is " 5–9',
                  { tag: "strong", role: "mark strong 9–13", children: ['"bold" 9–13'] },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("reads the schema serialization of a state without positions", () => {
    const state = EditorState.create({ schema, doc: nestedMarksDoc() });

    expect(readSerializedDom(state, document).entries.map(outline)).toEqual([
      {
        tag: "p",
        role: null,
        children: [
          '"This is "',
          {
            tag: "strong",
            role: null,
            children: ['"strong text with "', { tag: "em", role: null, children: ['"emphasis"'] }],
          },
        ],
      },
      {
        tag: "p",
        role: null,
        children: ['"a"', { tag: "br", role: null, children: [] }, '"b"'],
      },
    ]);
  });

  it("stops at the node limit and says so", () => {
    const { view } = mountPanel();
    const { entries, truncated } = readRenderedDom(view, 2);

    expect(truncated).toBe(true);
    const count = (entry: RenderedDomEntry): number =>
      entry.kind === "text" ? 1 : 1 + entry.children.reduce((sum, child) => sum + count(child), 0);
    expect(entries.reduce((sum, entry) => sum + count(entry), 0)).toBe(2);
  });

  it("inspects the node behind a node, mark or text row and follows edits", () => {
    const panel = mountPanel();
    panel.showView("Show document DOM");
    const row = (text: string) =>
      Array.from(panel.container.querySelectorAll<HTMLElement>(".pm-doc-row")).find((candidate) =>
        candidate.textContent?.includes(text),
      )!;
    const inspect = (text: string) =>
      row(text).querySelector<HTMLButtonElement>(".pm-doc-row-main")!.click();

    expect(panel.container.textContent).toContain("ranges are document positions");

    inspect("paragraph 35–40");
    expect(row("paragraph 35–40").getAttribute("data-inspected")).toBe("true");
    expect(panel.container.textContent).toContain("open 35");

    inspect('"strong text with "');
    expect(panel.container.textContent).toContain("open 9");
    expect(panel.container.textContent).toContain("close 26");

    inspect("em 26–34");
    expect(panel.container.textContent).toContain("open 26");
    expect(panel.container.textContent).toContain("close 34");

    panel.view.dispatch(panel.view.state.tr.insertText("!", 39));
    expect(row('"b!"').textContent).toContain("38–40");
  });

  it("outlines the text node a mark row wraps", () => {
    const panel = mountPanel();
    panel.showView("Show document DOM");
    const strongRow = Array.from(panel.container.querySelectorAll<HTMLElement>(".pm-doc-row")).find(
      (candidate) => candidate.textContent?.includes("strong 9–34"),
    )!;
    // jsdom has no layout, so text ranges have no client rects of their own.
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    cleanups.push(() => delete (Range.prototype as Partial<Range>).getClientRects);

    strongRow.dispatchEvent(new MouseEvent("mouseenter"));

    expect(document.querySelector("[data-prosemirror-node-overlay]")?.textContent).toBe(
      "text 9–26",
    );
  });

  it("shows the schema export without positions for a state the editor does not render", () => {
    const modelState = EditorState.create({
      schema,
      doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("xThis is ")])]),
    });
    const panel = mountPanel(nestedMarksDoc(), () => modelState);
    panel.showView("Show document DOM");

    expect(panel.container.textContent).toContain(
      "Not the live editor state: schema HTML export, positions are only shown for the live editor.",
    );
    expect(panel.container.textContent).toContain('"xThis is "');
    expect(panel.container.textContent).not.toContain("paragraph 0–");
    expect(panel.container.textContent).not.toContain("ranges are document positions");
  });
});

describe("node picker", () => {
  function startPicker() {
    const { view } = mountPanel();
    const onPick = vi.fn();
    const onCancel = vi.fn();
    const stop = startNodePicker(view, { onPick, onCancel });
    cleanups.push(stop);
    const paragraphs = view.dom.querySelectorAll("p");
    return { view, onPick, onCancel, paragraphs };
  }

  function fire(target: Element, type: string): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true });
    target.dispatchEvent(event);
    return event;
  }

  it("swallows pointer presses inside the editor only", () => {
    const { view, paragraphs } = startPicker();
    const editorListener = vi.fn();
    view.dom.addEventListener("mousedown", editorListener);
    const outside = document.createElement("button");
    document.body.append(outside);
    const outsideListener = vi.fn();
    outside.addEventListener("mousedown", outsideListener);

    expect(fire(paragraphs[0]!, "mousedown").defaultPrevented).toBe(true);
    expect(editorListener).not.toHaveBeenCalled();
    fire(outside, "mousedown");
    expect(outsideListener).toHaveBeenCalledTimes(1);
  });

  it("picks the node whose element was clicked", () => {
    const { onPick, paragraphs } = startPicker();

    fire(paragraphs[1]!, "click");

    expect(onPick).toHaveBeenCalledWith(35, false);
  });

  it("prefers the text leaf under the pointer", () => {
    const { view, onPick, paragraphs } = startPicker();
    view.posAtCoords = () => ({ pos: 12, inside: -1 });

    fire(paragraphs[0]!.querySelector("strong")!, "click");

    expect(onPick).toHaveBeenCalledWith(9, false);
  });

  it("outlines the hovered node and cancels on Escape", () => {
    const { view, onPick, onCancel, paragraphs } = startPicker();

    fire(paragraphs[1]!, "mousemove");
    expect(document.querySelector("[data-prosemirror-node-overlay]")?.textContent).toBe(
      "paragraph 35–40",
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-prosemirror-node-overlay]")).toBeNull();

    const editorListener = vi.fn();
    view.dom.addEventListener("pointerdown", editorListener);
    fire(paragraphs[1]!, "pointerdown");
    fire(paragraphs[1]!, "click");
    expect(editorListener).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("is a toolbar toggle that inspects the picked node", () => {
    const panel = mountPanel();
    const toggle = panel.container.querySelector<HTMLButtonElement>(
      '[aria-label="Pick a node in the editor"]',
    )!;

    toggle.click();
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fire(panel.view.dom.querySelectorAll("p")[1]!, "click");

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(panel.container.textContent).toContain("open 35");
    expect(panel.container.textContent).toContain("close 40");
  });
});
