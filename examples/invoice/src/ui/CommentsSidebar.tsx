import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "prosemirror-model";

import { selectRange } from "../invoice/commands";

interface CommentThread {
  readonly id: string;
  readonly author: string;
  readonly resolved: boolean;
  readonly from: number;
  readonly to: number;
  readonly quote: string;
}

const threadsByDoc = new WeakMap<ProseMirrorNode, CommentThread[]>();

function collectComments(doc: ProseMirrorNode): CommentThread[] {
  const cached = threadsByDoc.get(doc);
  if (cached) return cached;
  const threads = new Map<string, CommentThread>();
  doc.descendants((node, pos) => {
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
  const result = [...threads.values()];
  threadsByDoc.set(doc, result);
  return result;
}

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
                onClick={() => selectRange(editor, comment.from, comment.to)}
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
