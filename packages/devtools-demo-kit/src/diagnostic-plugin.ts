import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

/** Real editor hooks used to exercise the optional diagnostics panels in every demo. */
export function createDiagnosticDemoPlugin({ blockExamples = false } = {}): Plugin {
  return new Plugin({
    key: new PluginKey("demo-visuals"),
    props: {
      decorations(state) {
        const { $from } = state.selection;
        if (!$from.parent.isTextblock || $from.parent.content.size === 0)
          return DecorationSet.empty;
        const from = $from.start();
        const to = Math.min(from + 5, $from.end());
        const decorations = [
          Decoration.inline(
            from,
            to,
            { style: "text-decoration: underline dotted #8b5cf6; text-underline-offset: 4px" },
            { label: "First five positions in the active block" },
          ),
        ];
        if (blockExamples && $from.depth > 0) {
          decorations.push(
            Decoration.node(
              $from.before(),
              $from.after(),
              { class: "demo-active-block" },
              { label: "Active text block" },
            ),
            Decoration.widget(
              $from.end(),
              (view) => {
                const marker = view.dom.ownerDocument.createElement("span");
                marker.className = "demo-widget";
                marker.setAttribute("aria-hidden", "true");
                return marker;
              },
              { key: "demo-widget", label: "Marker at the end of the active block" },
            ),
          );
        }
        return DecorationSet.create(state.doc, decorations);
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
