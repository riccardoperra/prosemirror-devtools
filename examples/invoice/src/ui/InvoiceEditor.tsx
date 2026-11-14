import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useState } from "react";
import { resumeTiptapDevtools, suspendTiptapDevtools } from "prosemirror-inspector/tiptap";

import { InvoiceDevtools } from "../devtools/extension";
import { findQuery } from "../invoice/commands";
import { readMeta } from "../invoice/document";
import { invoiceExtensions } from "../invoice/extensions";
import { initialInvoice } from "../invoice/fixture";
import { InvoiceViewContext } from "../invoice/view-context";
import { CommentsSidebar } from "./CommentsSidebar";
import { FindBar } from "./FindBar";
import { InvoiceBubbleMenu } from "./InvoiceBubbleMenu";
import { LoadLab } from "./LoadLab";
import { ScenariosPanel } from "./ScenariosPanel";
import { Toolbar } from "./Toolbar";

export function InvoiceEditor() {
  const [extensions] = useState(() => [
    ...invoiceExtensions,
    ...(import.meta.env.DEV ? [InvoiceDevtools] : []),
  ]);
  const editor = useEditor({
    extensions,
    content: initialInvoice,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    enableExtensionDispatchTransaction: true,
    editorProps: {
      attributes: {
        "aria-label": "Invoice editor",
        "aria-multiline": "true",
        role: "textbox",
        class: "invoice-document",
      },
    },
  });
  useEffect(() => {
    if (!editor || !import.meta.env.DEV) return;
    resumeTiptapDevtools(editor);
    return () => suspendTiptapDevtools(editor);
  }, [editor]);
  return editor ? (
    <InvoiceWorkspace editor={editor} />
  ) : (
    <p className="loading">Loading invoice…</p>
  );
}

function InvoiceWorkspace({ editor }: { editor: Editor }) {
  const [findOpen, setFindOpen] = useState(false);
  const view = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      editable: current.isEditable,
      currency: readMeta(current.state.doc).currency,
    }),
  });
  const closeFind = () => {
    findQuery(editor, "");
    setFindOpen(false);
  };
  return (
    <InvoiceViewContext.Provider value={view}>
      <Toolbar
        editor={editor}
        findOpen={findOpen}
        onToggleFind={() => (findOpen ? closeFind() : setFindOpen(true))}
      />
      <LoadLab editor={editor} />
      {findOpen ? <FindBar editor={editor} onClose={closeFind} /> : null}
      <div className="workspace">
        <ScenariosPanel editor={editor} />
        <article className="document">
          <EditorContent editor={editor} />
        </article>
        <CommentsSidebar editor={editor} />
      </div>
      <InvoiceBubbleMenu editor={editor} />
    </InvoiceViewContext.Provider>
  );
}
