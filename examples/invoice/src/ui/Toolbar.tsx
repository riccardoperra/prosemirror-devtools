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
import { isLocked, transitions, type InvoiceStatus } from "../invoice/model";
import { MoreMenu } from "./MoreMenu";

const statusActions: Record<InvoiceStatus, string> = {
  sent: "Send",
  paid: "Mark paid",
  void: "Void",
  draft: "Back to draft",
};

/** Moving forward is the toolbar's job; stepping back or voiding is rare and lives under More. */
const secondaryStatuses: readonly InvoiceStatus[] = ["void", "draft"];

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
  const { locked, selectedRows, status } = state;
  const rowsLabel = selectedRows > 1 ? "rows" : "row";
  const forward = transitions[status].filter((next) => !secondaryStatuses.includes(next));
  const backward = transitions[status].filter((next) => secondaryStatuses.includes(next));
  return (
    <div className="toolbar" role="toolbar" aria-label="Invoice actions">
      <div className="toolbar-group">
        <button
          type="button"
          className="icon-button"
          aria-label="Undo"
          title="Undo"
          disabled={!state.canUndo}
          onClick={() => undo(editor)}
        >
          <Glyph>↶</Glyph>
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Redo"
          title="Redo"
          disabled={!state.canRedo}
          onClick={() => redo(editor)}
        >
          <Glyph>↷</Glyph>
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" disabled={locked} onClick={() => addLineItem(editor)}>
          <Glyph>+</Glyph>Add line item
        </button>
        <button type="button" aria-pressed={findOpen} onClick={onToggleFind}>
          <Glyph>⌕</Glyph>Find
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
        <span className="status-badge" data-status={status}>
          {status}
        </span>
        {forward.map((next) => (
          <button
            key={next}
            type="button"
            className="primary-action"
            onClick={() => setStatus(editor, next)}
          >
            {statusActions[next]}
          </button>
        ))}
      </div>
      <div className="toolbar-group">
        <MoreMenu label="More">
          {(close) => {
            const item = (
              label: string,
              disabled: boolean,
              action: () => unknown,
              danger = false,
            ) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                className={danger ? "is-danger" : undefined}
                disabled={disabled}
                onClick={() => {
                  action();
                  close();
                }}
              >
                {label}
              </button>
            );
            return (
              <>
                {item(`Duplicate ${rowsLabel}`, locked || selectedRows === 0, () =>
                  duplicateSelectedRows(editor),
                )}
                {item("Select all rows", false, () => selectAllLineItems(editor))}
                {item("10% off all rows", locked, () => applyDiscountToAll(editor, 10))}
                <hr />
                {item("Page break", locked, () => insertPageBreak(editor))}
                {item("Move section to next page", locked, () => moveSectionToNextPage(editor))}
                <hr />
                {backward.map((next) =>
                  item(statusActions[next], false, () => setStatus(editor, next), next === "void"),
                )}
                {item(
                  `Delete ${rowsLabel}`,
                  locked || selectedRows === 0,
                  () => deleteRows(editor),
                  true,
                )}
              </>
            );
          }}
        </MoreMenu>
      </div>
    </div>
  );
}
