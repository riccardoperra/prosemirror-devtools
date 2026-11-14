import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useCallback } from "react";

import { revealOutlineEntry } from "../invoice/commands";
import {
  findOutlineEntry,
  outlineEntryById,
  outlineSignature,
  readOutline,
  type OutlineEntry,
} from "../invoice/outline";

function Badges({ entry }: { entry: OutlineEntry }) {
  return (
    <>
      {entry.issues > 0 ? (
        <span className="outline-badge is-issue" title={`${entry.issues} invalid rows`}>
          {entry.issues}
        </span>
      ) : null}
      {entry.openComments > 0 ? (
        <span className="outline-badge is-comment" title={`${entry.openComments} open comments`}>
          {entry.openComments}
        </span>
      ) : null}
    </>
  );
}

function OutlineButton({
  entry,
  activeId,
  onJump,
}: {
  entry: OutlineEntry;
  activeId: string | null;
  onJump: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="outline-entry"
      aria-current={entry.id === activeId ? "location" : undefined}
      onClick={() => onJump(entry.id)}
    >
      <span className="outline-label">{entry.label}</span>
      <Badges entry={entry} />
    </button>
  );
}

export function OutlinePanel({ editor }: { editor: Editor }) {
  // Typing shifts positions but rarely what the outline shows, so it re-renders on its signature.
  const { activeId } = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { doc, selection } = current.state;
      const outline = readOutline(doc);
      return {
        signature: outlineSignature(outline),
        activeId: findOutlineEntry(outline, selection.from)?.id ?? null,
      };
    },
    equalityFn: (a, b) => a.signature === b?.signature && a.activeId === b.activeId,
  });
  const outline = readOutline(editor.state.doc);
  const onJump = useCallback(
    (id: string) => {
      const entry = outlineEntryById(readOutline(editor.state.doc), id);
      if (entry) revealOutlineEntry(editor, entry);
    },
    [editor],
  );
  return (
    <details className="sidebar-section outline" open>
      <summary>
        <h2>Outline</h2>
      </summary>
      <nav aria-label="Document outline">
        <ol>
          {outline.map((page) => (
            <li key={page.id}>
              <OutlineButton entry={page} activeId={activeId} onJump={onJump} />
              {page.children.length > 0 ? (
                <ul>
                  {page.children.map((child) => (
                    <li key={child.id}>
                      <OutlineButton entry={child} activeId={activeId} onJump={onJump} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
