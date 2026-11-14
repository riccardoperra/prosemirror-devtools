import type { AnyExtension, Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { TextSelection } from "prosemirror-state";
import { useEffect, useState } from "react";
import { resumeTiptapDevtools, suspendTiptapDevtools } from "prosemirror-inspector/tiptap";

import { findQuery } from "../invoice/commands";
import { readMeta } from "../invoice/document";
import { useCollab } from "../collab/context";
import { devtoolsEnabled } from "../env";
import { createInvoiceExtensions } from "../invoice/extensions";
import { initialInvoice } from "../invoice/fixture";
import { InvoiceViewContext } from "../invoice/view-context";
import { CommentsSidebar } from "./CommentsSidebar";
import { FindBar } from "./FindBar";
import { InvoiceBubbleMenu } from "./InvoiceBubbleMenu";
import { PresenceBar } from "./PresenceBar";
import { ScenariosPanel } from "./ScenariosPanel";
import { Toolbar } from "./Toolbar";

/** The devtools extension arrives from the lazily loaded shell, so production never bundles it. */
export function InvoiceEditor({ devtools }: { devtools: AnyExtension | null }) {
  const collab = useCollab();
  const [extensions] = useState(() => [
    ...createInvoiceExtensions({ history: !collab }),
    ...(collab?.extensions ?? []),
    ...(devtools ? [devtools] : []),
  ]);
  const editor = useEditor({
    extensions,
    // A collaborative document comes from the shared Y.Doc, which the session already seeded.
    ...(collab ? {} : { content: initialInvoice }),
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    enableExtensionDispatchTransaction: true,
    editorProps: {
      // Keeps scrolled-to selections clear of the sticky top bar.
      scrollMargin: { top: 80, bottom: 24, left: 0, right: 0 },
      scrollThreshold: { top: 80, bottom: 24, left: 0, right: 0 },
      attributes: {
        "aria-label": "Invoice editor",
        "aria-multiline": "true",
        role: "textbox",
        class: "invoice-document",
      },
    },
  });
  useEffect(() => {
    if (!editor || !collab) return;
    // y-sync renders the shared document over an empty one and clamps the old selection into it,
    // which leaves a range over the cover that the first keystroke would replace. Start at a caret.
    const start = TextSelection.findFrom(editor.state.doc.resolve(0), 1, true);
    if (start) editor.view.dispatch(editor.state.tr.setSelection(start));
  }, [editor, collab]);
  useEffect(() => {
    if (!editor || !devtools) return;
    resumeTiptapDevtools(editor);
    return () => suspendTiptapDevtools(editor);
  }, [editor, devtools]);
  return editor ? (
    <InvoiceWorkspace editor={editor} />
  ) : (
    <p className="loading">Loading invoice…</p>
  );
}

function InvoiceWorkspace({ editor }: { editor: Editor }) {
  const collab = useCollab();
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
      <header className="topbar">
        <h1>Invoice workbench</h1>
        <Toolbar
          editor={editor}
          findOpen={findOpen}
          onToggleFind={() => (findOpen ? closeFind() : setFindOpen(true))}
        />
        {collab ? (
          <PresenceBar editor={editor} collab={collab} />
        ) : (
          <p className="topbar-note">
            {devtoolsEnabled
              ? "⌘⇧D outside the editor opens the inspector"
              : "Diagnostics are off in production"}
          </p>
        )}
        {findOpen ? <FindBar editor={editor} onClose={closeFind} /> : null}
      </header>
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
