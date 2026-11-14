import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { createContext, useContext } from "react";

import { readInvoice } from "./document";
import type { Currency, Invoice } from "./model";

export interface InvoiceViewState {
  readonly editable: boolean;
  readonly currency: Currency;
}

/** Row node views read this instead of subscribing to the editor, so 300 rows rerender only when it changes. */
export const InvoiceViewContext = createContext<InvoiceViewState>({
  editable: true,
  currency: "EUR",
});

export function useInvoiceView(): InvoiceViewState {
  return useContext(InvoiceViewContext);
}

export function useInvoiceSelector<T>(editor: Editor, select: (invoice: Invoice) => T): T {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => select(readInvoice(current.state.doc)),
  });
}
