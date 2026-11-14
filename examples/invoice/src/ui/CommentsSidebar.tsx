import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

import { selectRange } from "../invoice/commands";

interface CommentThread {
  readonly id: string;
  readonly author: string;
  readonly resolved: boolean;
  readonly from: number;
  readonly to: number;
  readonly quote: string;
}

function collectComments(editor: Editor): CommentThread[] {
  const threads = new Map<string, CommentThread>();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return true;
    for (const mark of node.marks) {
      if (mark.type.name !== "comment") continue;
      const id = mark.attrs.id as string;
      const existing = threads.get(id);
      threads.set(id, {
        id,
        author: mark.attrs.author as string,
        resolved: mark.attrs.resolved as boolean,
        from: existing?.from ?? pos,
        to: pos + node.nodeSize,
        quote: (existing?.quote ?? "") + node.text,
      });
    }
    return false;
  });
  return [...threads.values()];
}

export function CommentsSidebar({ editor }: { editor: Editor }) {
  const comments = useEditorState({
    editor,
    selector: ({ editor: current }) => collectComments(current),
  });
  return (
    <aside className="comments" aria-label="Comments">
      <h2>Comments</h2>
      {comments.length === 0 ? (
        <p className="comments-empty">Select text and use the bubble menu to comment.</p>
      ) : (
        <ul>
          {comments.map((comment) => (
            <li key={comment.id}>
              <button
                type="button"
                className={comment.resolved ? "comment-card is-resolved" : "comment-card"}
                onClick={() => selectRange(editor, comment.from, comment.to)}
              >
                <span className="comment-author">
                  {comment.author}
                  {comment.resolved ? " · resolved" : ""}
                </span>
                <q>{comment.quote}</q>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
