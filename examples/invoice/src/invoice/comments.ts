import type { Node as ProseMirrorNode } from "prosemirror-model";

export interface CommentThread {
  readonly id: string;
  readonly author: string;
  readonly resolved: boolean;
  readonly from: number;
  readonly to: number;
  readonly quote: string;
}

const threadsByDoc = new WeakMap<ProseMirrorNode, readonly CommentThread[]>();

/** One thread per comment id, spanning every text node that carries its mark. */
export function collectComments(doc: ProseMirrorNode): readonly CommentThread[] {
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
