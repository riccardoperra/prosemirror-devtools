import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { TextSelection } from "prosemirror-state";

import { addComment, resolveComment, toggleMark } from "../invoice/commands";

const marks = [
  { name: "bold", label: "Bold", glyph: "B" },
  { name: "italic", label: "Italic", glyph: "I" },
  { name: "strike", label: "Strikethrough", glyph: "S" },
] as const;

export function InvoiceBubbleMenu({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      comment: current.isActive("comment", { resolved: false }),
    }),
  });
  return (
    <BubbleMenu
      editor={editor}
      className="bubble-menu"
      shouldShow={({ editor: current, state, from, to }) =>
        current.isEditable && from !== to && state.selection instanceof TextSelection
      }
    >
      {marks.map((mark) => (
        <button
          key={mark.name}
          type="button"
          className={`bubble-${mark.name}`}
          aria-label={mark.label}
          aria-pressed={active[mark.name]}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => toggleMark(editor, mark.name)}
        >
          {mark.glyph}
        </button>
      ))}
      <span className="bubble-divider" aria-hidden="true" />
      {active.comment ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => resolveComment(editor)}
        >
          Resolve comment
        </button>
      ) : (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => addComment(editor, "You")}
        >
          Comment
        </button>
      )}
    </BubbleMenu>
  );
}
