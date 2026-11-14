import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { collectComments } from "../invoice/comments";
import { revealRange } from "../invoice/commands";

export function CommentsSidebar({ editor }: { editor: Editor }) {
  const comments = useEditorState({
    editor,
    selector: ({ editor: current }) => collectComments(current.state.doc),
  });
  return (
    <aside className="sidebar sidebar-end comments" aria-label="Comments">
      <h2 className="sidebar-label">Comments</h2>
      {comments.length === 0 ? (
        <p className="comments-empty">Select text and use the bubble menu to comment.</p>
      ) : (
        <ul>
          {comments.map((comment) => (
            <li key={comment.id}>
              <button
                type="button"
                className={comment.resolved ? "comment-card is-resolved" : "comment-card"}
                onClick={() => revealRange(editor, comment.from, comment.to)}
              >
                <span className="comment-meta">
                  <span className="comment-author">{comment.author}</span>
                  {comment.resolved ? <span className="comment-resolved">Resolved</span> : null}
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
