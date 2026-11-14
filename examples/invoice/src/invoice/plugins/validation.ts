import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { measure } from "../../devtools/session";
import { lineItemRows, readLineItem } from "../document";
import { validateLineItem, type Issue } from "../model";

export interface InvalidRow {
  readonly id: string;
  readonly pos: number;
  readonly issues: readonly Issue[];
}

export interface ValidationState {
  readonly invalid: readonly InvalidRow[];
  readonly decorations: DecorationSet;
}

function issueWidget(row: InvalidRow): HTMLElement {
  const element = document.createElement("div");
  element.className = "row-issues";
  element.setAttribute("role", "note");
  element.textContent = row.issues.map((issue) => issue.message).join(" ");
  return element;
}

function validate(doc: ProseMirrorNode): ValidationState {
  return measure("Validate line items", "validation", () => {
    const invalid: InvalidRow[] = [];
    const decorations: Decoration[] = [];
    for (const { node, pos } of lineItemRows(doc)) {
      const item = readLineItem(node);
      const issues = validateLineItem(item);
      if (issues.length === 0) continue;
      const row = { id: item.id, pos, issues };
      invalid.push(row);
      const end = pos + node.nodeSize;
      decorations.push(
        Decoration.node(pos, end, {
          class: "is-invalid",
          title: issues.map((issue) => issue.message).join("\n"),
        }),
        Decoration.widget(end, () => issueWidget(row), {
          side: -1,
          ignoreSelection: true,
          key: `issues:${item.id}:${issues.map((issue) => issue.code).join(",")}`,
        }),
      );
    }
    return { invalid, decorations: DecorationSet.create(doc, decorations) };
  });
}

export const validationKey = new PluginKey<ValidationState>("lineItemValidation");

export const validationPlugin = new Plugin<ValidationState>({
  key: validationKey,
  state: {
    init: (_config, state) => validate(state.doc),
    apply: (tr, value, _oldState, newState) => (tr.docChanged ? validate(newState.doc) : value),
  },
  props: {
    decorations: (state) => validationKey.getState(state)?.decorations,
  },
});

export const LineItemValidation = Extension.create({
  name: "lineItemValidation",
  addProseMirrorPlugins: () => [validationPlugin],
});
