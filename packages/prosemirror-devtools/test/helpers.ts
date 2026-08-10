import { Schema } from "prosemirror-model";
import { EditorState, type Plugin } from "prosemirror-state";
import { EditorView, type DirectEditorProps } from "prosemirror-view";

export const testSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "text*",
      group: "block",
      toDOM: () => ["p", 0],
    },
    text: { group: "inline" },
  },
});

export function createTestState(text = "", plugins: readonly Plugin[] = []): EditorState {
  const paragraph = testSchema.node(
    "paragraph",
    null,
    text.length > 0 ? testSchema.text(text) : undefined,
  );
  return EditorState.create({
    schema: testSchema,
    doc: testSchema.node("doc", null, paragraph),
    plugins,
  });
}

export function createTestView(
  state = createTestState(),
  props: Omit<DirectEditorProps, "state"> = {},
): EditorView {
  const mount = document.createElement("div");
  document.body.append(mount);
  return new EditorView(mount, { state, ...props });
}

export function appendTextTransaction(state: EditorState, text: string) {
  return state.tr.insertText(text, state.doc.content.size - 1);
}
