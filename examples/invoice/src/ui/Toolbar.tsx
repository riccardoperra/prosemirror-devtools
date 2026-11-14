import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useState } from "react";

import {
  addLineItem,
  applyDiscountToAll,
  deleteRows,
  duplicateSelectedRows,
  insertField,
  insertPageBreak,
  moveSectionToNextPage,
  redo,
  selectAllLineItems,
  setStatus,
  undo,
} from "../invoice/commands";
import { readMeta, rowsInRange } from "../invoice/document";
import { fieldKeys, fieldRegistry, type FieldKey } from "../invoice/fields";
import { isLocked, transitions } from "../invoice/model";

const statusActions = { sent: "Send", paid: "Mark paid", void: "Void", draft: "Back to draft" };

export function Glyph({ children }: { children: string }) {
  return (
    <span className="glyph" aria-hidden="true">
      {children}
    </span>
  );
}

interface ToolbarProps {
  readonly editor: Editor;
  readonly findOpen: boolean;
  readonly onToggleFind: () => void;
}

export function Toolbar({ editor, findOpen, onToggleFind }: ToolbarProps) {
  const [field, setField] = useState<FieldKey>("customer.name");
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { doc, selection } = current.state;
      const status = readMeta(doc).status;
      return {
        status,
        locked: isLocked(status),
        selectedRows: rowsInRange(doc, selection.from, selection.to).length,
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      };
    },
  });
  const { locked, selectedRows } = state;
  return (
    <div className="toolbar" role="toolbar" aria-label="Invoice actions">
      <div className="toolbar-group">
        <button type="button" disabled={!state.canUndo} onClick={() => undo(editor)}>
          <Glyph>↶</Glyph>Undo
        </button>
        <button type="button" disabled={!state.canRedo} onClick={() => redo(editor)}>
          <Glyph>↷</Glyph>Redo
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" disabled={locked} onClick={() => addLineItem(editor)}>
          <Glyph>+</Glyph>Add line item
        </button>
        <button
          type="button"
          disabled={locked || selectedRows === 0}
          onClick={() => duplicateSelectedRows(editor)}
        >
          <Glyph>⧉</Glyph>Duplicate row{selectedRows > 1 ? "s" : ""}
        </button>
        <button
          type="button"
          disabled={locked || selectedRows === 0}
          onClick={() => deleteRows(editor)}
        >
          <Glyph>−</Glyph>Delete row{selectedRows > 1 ? "s" : ""}
        </button>
        <button type="button" onClick={() => selectAllLineItems(editor)}>
          <Glyph>▤</Glyph>Select all rows
        </button>
        <button type="button" disabled={locked} onClick={() => applyDiscountToAll(editor, 10)}>
          <Glyph>%</Glyph>10% off all rows
        </button>
      </div>
      <div className="toolbar-group">
        <select
          aria-label="Merge field"
          value={field}
          disabled={locked}
          onChange={(event) => setField(event.target.value as FieldKey)}
        >
          {fieldKeys.map((key) => (
            <option key={key} value={key}>
              {fieldRegistry[key].label}
            </option>
          ))}
        </select>
        <button type="button" disabled={locked} onClick={() => insertField(editor, field)}>
          <Glyph>{"{}"}</Glyph>Insert field
        </button>
      </div>
      <div className="toolbar-group">
        {transitions[state.status].map((next) => (
          <button
            key={next}
            type="button"
            className={`status-action status-action-${next}`}
            onClick={() => setStatus(editor, next)}
          >
            {statusActions[next]}
          </button>
        ))}
      </div>
      <div className="toolbar-group">
        <button type="button" disabled={locked} onClick={() => insertPageBreak(editor)}>
          <Glyph>⤓</Glyph>Page break
        </button>
        <button type="button" disabled={locked} onClick={() => moveSectionToNextPage(editor)}>
          <Glyph>↧</Glyph>Move section to next page
        </button>
        <button type="button" aria-pressed={findOpen} onClick={onToggleFind}>
          <Glyph>⌕</Glyph>Find
        </button>
      </div>
    </div>
  );
}
