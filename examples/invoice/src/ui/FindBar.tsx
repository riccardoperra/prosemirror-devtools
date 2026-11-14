import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useState } from "react";

import { findQuery, findStep } from "../invoice/commands";
import { getFindState } from "../invoice/plugins/find";

export function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { count, current } = useEditorState({
    editor,
    selector: ({ editor: state }) => {
      const { matches } = getFindState(state.state);
      const { from, to } = state.state.selection;
      const index = matches.findIndex((match) => match.from === from && match.to === to);
      return { count: matches.length, current: index + 1 };
    },
  });
  return (
    <div className="find-bar" role="search">
      <input
        type="search"
        aria-label="Find in invoice"
        placeholder="Find in invoice"
        autoFocus
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          findQuery(editor, event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") findStep(editor, event.shiftKey ? -1 : 1);
          if (event.key === "Escape") onClose();
        }}
      />
      <output aria-live="polite">{query ? `${current || "–"} of ${count}` : ""}</output>
      <button type="button" disabled={count === 0} onClick={() => findStep(editor, -1)}>
        Previous
      </button>
      <button type="button" disabled={count === 0} onClick={() => findStep(editor, 1)}>
        Next
      </button>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
