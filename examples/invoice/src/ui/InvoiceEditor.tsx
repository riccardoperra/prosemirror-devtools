import type { AnyExtension, Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useState } from "react";
import { resumeTiptapDevtools, suspendTiptapDevtools } from "prosemirror-inspector/tiptap";

import { findQuery } from "../invoice/commands";
import { readMeta } from "../invoice/document";
import { useCollab } from "../collab/context";
import { createInvoiceExtensions } from "../invoice/extensions";
import { initialInvoice } from "../invoice/fixture";
import { InvoiceViewContext } from "../invoice/view-context";
import { CommentsSidebar } from "./CommentsSidebar";
import { FindBar } from "./FindBar";
import { InvoiceBubbleMenu } from "./InvoiceBubbleMenu";
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
    // A collaborative document comes from the room. Only its first peer seeds the fixture.
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
    if (editor && collab) void collab.seed(editor, initialInvoice);
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
        <p className="topbar-note">
          {collab
            ? `${collab.config.user.name} · room ${collab.config.room} · this browser only`
            : import.meta.env.DEV
              ? "⌘⇧D outside the editor opens the inspector"
              : "Diagnostics are off in production"}
        </p>
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
