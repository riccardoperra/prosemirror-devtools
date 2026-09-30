import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

/** Real editor hooks used to exercise the optional diagnostics panels in every demo. */
export function createDiagnosticDemoPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey("demo-visuals"),
    props: {
      decorations(state) {
        const { $from } = state.selection;
        if (!$from.parent.isTextblock || $from.parent.content.size === 0)
          return DecorationSet.empty;
        const from = $from.start();
        const to = Math.min(from + 5, $from.end());
        return DecorationSet.create(state.doc, [
          Decoration.inline(
            from,
            to,
            { style: "text-decoration: underline dotted #8b5cf6; text-underline-offset: 4px" },
            { label: "First five positions in the active block" },
          ),
        ]);
      },
      handleClick() {
        return false;
      },
      nodeViews: {
        paragraph(node, view) {
          const dom = view.dom.ownerDocument.createElement("p");
          return { dom, contentDOM: dom, update: (next) => next.type === node.type, destroy() {} };
        },
      },
    },
  });
}
