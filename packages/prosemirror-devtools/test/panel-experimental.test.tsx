import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachProseMirrorDevtools,
  createProseMirrorDevtoolsStore,
  type ExperimentalFeatures,
} from "../src/core";
import { startNodePicker } from "../src/panel/features/inspector/node-picker";
import { readRenderedDom, type RenderedDomEntry } from "../src/panel/features/state/rendered-dom";
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

function mountPanel(experimental: ExperimentalFeatures = false, doc = nestedMarksDoc()) {
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
  });
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(
    () => (
      <ProseMirrorDevtoolsPanel defaultPanel="state" experimental={experimental} store={store} />
    ),
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

describe("experimental document views", () => {
  it("keeps only the stable views when the flag is off", () => {
    const panel = mountPanel();
    expect(panel.documentViewLabels()).toEqual(["HTML", "Structure", "JSON"]);
  });

  it("adds the experimental views when enabled", () => {
    const panel = mountPanel(true);
    expect(panel.documentViewLabels()).toEqual(["HTML", "Structure", "JSON", "Boxes", "DOM"]);
  });

  it("enables only the listed experiments", () => {
    const panel = mountPanel([]);
    expect(panel.documentViewLabels()).toEqual(["HTML", "Structure", "JSON"]);
  });

  it("renders inline content as a flat row of chips carrying their marks", () => {
    const panel = mountPanel(["document-boxes"]);
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
      true,
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
    const panel = mountPanel(true);
    panel.showView("Show document as nested boxes");

    const emphasis = panel.container.querySelectorAll<HTMLElement>(".pm-doc-box-chip")[2]!;
    emphasis.querySelector<HTMLButtonElement>(".pm-doc-box-chip-main")!.click();

    expect(emphasis.getAttribute("data-inspected")).toBe("true");
    expect(panel.container.textContent).toContain("open 26");
    expect(panel.container.textContent).toContain("close 34");
  });
});

function outline(entry: RenderedDomEntry): unknown {
  return entry.kind === "text"
    ? `${JSON.stringify(entry.text)} @${entry.pos}`
    : {
        tag: entry.tag,
        node: entry.node ? `${entry.node.name} ${entry.node.from}–${entry.node.to}` : null,
        children: entry.children.map(outline),
      };
}

describe("rendered DOM", () => {
  it("maps elements to the nodes they render and text to positions", () => {
    const { view } = mountPanel();
    const { root, truncated } = readRenderedDom(view);

    expect(truncated).toBe(false);
    expect(outline(root)).toEqual({
      tag: "div",
      node: "doc 0–40",
      children: [
        {
          tag: "p",
          node: "paragraph 0–35",
          children: [
            '"This is " @1',
            {
              tag: "strong",
              node: null,
              children: [
                '"strong text with " @9',
                { tag: "em", node: null, children: ['"emphasis" @26'] },
              ],
            },
          ],
        },
        {
          tag: "p",
          node: "paragraph 35–40",
          children: ['"a" @36', { tag: "br", node: "hard_break 37–38", children: [] }, '"b" @38'],
        },
      ],
    });
  });

  it("stops at the node limit and says so", () => {
    const { view } = mountPanel();
    const { root, truncated } = readRenderedDom(view, 2);

    expect(truncated).toBe(true);
    const count = (entry: RenderedDomEntry): number =>
      entry.kind === "text" ? 1 : 1 + entry.children.reduce((sum, child) => sum + count(child), 0);
    expect(count(root) - 1).toBe(2);
  });

  it("selects the node an element renders and follows edits", () => {
    const panel = mountPanel(["rendered-dom"]);
    panel.showView("Show rendered editor DOM");

    const paragraphRow = () =>
      panel.container.querySelectorAll<HTMLElement>(
        '[data-dom-kind="element"][data-node-type="paragraph"]',
      )[1]!;
    paragraphRow().querySelector<HTMLButtonElement>(".pm-doc-row-main")!.click();
    expect(paragraphRow().getAttribute("data-inspected")).toBe("true");
    expect(panel.container.textContent).toContain("open 35");

    panel.view.dispatch(panel.view.state.tr.insertText("!", 39));
    expect(panel.container.textContent).toContain('"b!"');
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
    const panel = mountPanel(["node-picker"]);
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

  it("hides the toolbar toggle when the experiment is off", () => {
    const panel = mountPanel(["document-boxes"]);
    expect(panel.container.querySelector('[aria-label="Pick a node in the editor"]')).toBeNull();
  });
});
