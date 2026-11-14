import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { mark, measure } from "../../devtools/session";
import { lineItemRows, readLineItem } from "../document";
import { validateLineItem, type Issue } from "../model";

export interface InvalidRow {
  readonly id: string;
  readonly pos: number;
  readonly issues: readonly Issue[];
}

export interface ValidationState {
  /** Artificial cost per recompute, so the Performance panel has a hot plugin hook to show. */
  readonly delayMs: number;
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

function busyWait(ms: number): void {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // Blocks on purpose: the slow-plugin scenario needs real main-thread time in the hook.
  }
}

function validate(doc: ProseMirrorNode, delayMs: number): ValidationState {
  return measure("Validate line items", "validation", () => {
    if (delayMs > 0) busyWait(delayMs);
    const invalid: InvalidRow[] = [];
    const decorations: Decoration[] = [];
    const rows = lineItemRows(doc);
    for (const { node, pos } of rows) {
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
    mark("Validation", "validation", { rows: rows.length, invalid: invalid.length, delayMs });
    return { delayMs, invalid, decorations: DecorationSet.create(doc, decorations) };
  });
}

export const validationKey = new PluginKey<ValidationState>("lineItemValidation");

export const validationPlugin = new Plugin<ValidationState>({
  key: validationKey,
  state: {
    init: (_config, state) => validate(state.doc, 0),
    apply(tr, value, _oldState, newState) {
      const delay = tr.getMeta(validationKey) as { delayMs: number } | undefined;
      if (delay) return validate(newState.doc, delay.delayMs);
      return tr.docChanged ? validate(newState.doc, value.delayMs) : value;
    },
  },
  props: {
    decorations: (state) => validationKey.getState(state)?.decorations,
  },
});

export function setValidationDelay(tr: Transaction, delayMs: number): Transaction {
  return tr.setMeta(validationKey, { delayMs });
}

export const LineItemValidation = Extension.create({
  name: "lineItemValidation",
  addProseMirrorPlugins: () => [validationPlugin],
});
