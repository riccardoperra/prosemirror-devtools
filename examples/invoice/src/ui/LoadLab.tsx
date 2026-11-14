import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useState } from "react";

import {
  loadStressInvoice,
  repriceDispatchLimit,
  repriceInOneTransaction,
  repriceRowByRow,
  resetDocument,
  setSlowPlugin,
} from "../invoice/commands";
import { lineItemRows, pages } from "../invoice/document";
import { validationKey } from "../invoice/plugins/validation";

const stressSizes = [300, 500, 1000, 2000] as const;
const delays = [0, 10, 40, 100] as const;

export function LoadLab({ editor }: { editor: Editor }) {
  const [rows, setRows] = useState<number>(stressSizes[0]);
  const stats = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      rows: lineItemRows(current.state.doc).length,
      pages: pages(current.state.doc).length,
      delayMs: validationKey.getState(current.state)?.delayMs ?? 0,
    }),
  });
  return (
    <details className="sidebar-section load-lab">
      <summary>
        <h2>Load lab</h2>
        <span className="load-lab-stats">
          {stats.rows} rows · {stats.pages} pages
        </span>
      </summary>
      <div className="load-lab-body">
        <label>
          <span>Stress invoice</span>
          <span className="load-lab-control">
            <select
              aria-label="Stress rows"
              value={rows}
              onChange={(event) => setRows(Number(event.target.value))}
            >
              {stressSizes.map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
            <button type="button" onClick={() => loadStressInvoice(editor, rows)}>
              Load
            </button>
          </span>
        </label>
        <label>
          <span>Validation delay</span>
          <select
            aria-label="Validation delay"
            value={stats.delayMs}
            onChange={(event) => setSlowPlugin(editor, Number(event.target.value))}
          >
            {delays.map((delay) => (
              <option key={delay} value={delay}>
                {delay === 0 ? "Off" : `${delay} ms`}
              </option>
            ))}
          </select>
        </label>
        <div className="load-lab-actions">
          <button type="button" onClick={() => repriceInOneTransaction(editor, 5)}>
            +5% in one transaction
          </button>
          <button type="button" onClick={() => repriceRowByRow(editor, 5)}>
            +5% row by row (max {repriceDispatchLimit})
          </button>
          <button type="button" className="is-danger" onClick={() => resetDocument(editor)}>
            Reset document
          </button>
        </div>
      </div>
    </details>
  );
}
