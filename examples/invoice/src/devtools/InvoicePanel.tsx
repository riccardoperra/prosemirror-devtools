import { createReactDevtoolsExtension } from "prosemirror-inspector/react";
import type { DevtoolsExtensionContext } from "prosemirror-inspector";
import { NodeSelection, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { revealSelection } from "../invoice/commands";
import { formatMoney, type Cents } from "../invoice/model";
import { readInvoiceDebugState, type InvoiceDebugState } from "./debug-state";
import { domainEventLog, sessionId, type DomainEventEntry } from "./session";
import "./invoice-panel.css";

function formatTime(at: number): string {
  const time = new Date(at);
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}.${pad(time.getMilliseconds(), 3)}`;
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="invoice-panel__section" aria-label={title}>
      <header>
        <h3>{title}</h3>
        {meta ? <span>{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

function DocumentSection({ document }: { document: InvoiceDebugState["document"] }) {
  const money = (amount: Cents) => formatMoney(amount, document.currency);
  const facts: readonly (readonly [string, ReactNode])[] = [
    [
      "Status",
      <span key="status" className="invoice-panel__status" data-status={document.status}>
        {document.status}
      </span>,
    ],
    ["Next", document.next.length ? document.next.join(", ") : "none (terminal)"],
    ["Editable", document.editable ? "yes" : "no"],
    ["Pages", document.pages],
    ["Rows", document.rows],
    ["Net", money(document.totals.net)],
    ...document.totals.vatByRate.map(
      (bucket) => [`VAT ${bucket.rate}%`, money(bucket.tax)] as const,
    ),
    ["Gross", <strong key="gross">{money(document.totals.gross)}</strong>],
  ];
  return (
    <Section title="Document">
      <dl className="invoice-panel__facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function CommentsSection({
  comments,
  view,
}: {
  comments: InvoiceDebugState["comments"];
  view: EditorView;
}) {
  return (
    <Section title="Comments" meta={comments.length}>
      {comments.length === 0 ? (
        <p className="invoice-panel__empty">No comment marks in the document.</p>
      ) : (
        <ul className="invoice-panel__list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <button
                type="button"
                aria-label={`Select comment by ${comment.author}`}
                onClick={() =>
                  revealSelection(
                    view,
                    (doc) => TextSelection.create(doc, comment.from, comment.to),
                    {
                      kind: "text",
                      from: comment.from,
                      to: comment.to,
                    },
                  )
                }
              >
                <span className="invoice-panel__row-title">
                  <strong>{comment.author}</strong>
                  <span data-tone={comment.resolved ? "success" : "warning"}>
                    {comment.resolved ? "resolved" : "open"}
                  </span>
                </span>
                <span className="invoice-panel__quote">{comment.quote}</span>
                <code>
                  {comment.id} · {comment.from}–{comment.to}
                </code>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ValidationSection({
  validation,
  view,
}: {
  validation: InvoiceDebugState["validation"];
  view: EditorView;
}) {
  return (
    <Section
      title="Validation"
      meta={`${validation.invalidRows} invalid · ${validation.delayMs ? `${validation.delayMs} ms delay` : "no delay"}`}
    >
      {validation.groups.length === 0 ? (
        <p className="invoice-panel__empty">Every row passes.</p>
      ) : (
        validation.groups.map((group) => (
          <div key={group.code} className="invoice-panel__group">
            <p>
              <code>{group.code}</code> {group.message}
            </p>
            <ul className="invoice-panel__chips">
              {group.rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-label={`Select row ${row.id}`}
                    onClick={() => {
                      const node = view.state.doc.nodeAt(row.pos);
                      if (!node) return;
                      revealSelection(view, (doc) => NodeSelection.create(doc, row.pos), {
                        kind: "node",
                        from: row.pos,
                        to: row.pos + node.nodeSize,
                      });
                    }}
                  >
                    {row.id} @ {row.pos}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </Section>
  );
}

function eventDetail(event: DomainEventEntry): string {
  if (event.durationMs !== undefined) return `${event.durationMs.toFixed(2)} ms`;
  return event.data === undefined ? "" : JSON.stringify(event.data);
}

function EventsSection({ events }: { events: readonly DomainEventEntry[] }) {
  return (
    <Section title="Domain events" meta={`last ${events.length}`}>
      {events.length === 0 ? (
        <p className="invoice-panel__empty">Edit the invoice or run a scenario.</p>
      ) : (
        <ol className="invoice-panel__events">
          {[...events].reverse().map((event) => (
            <li key={event.id} data-tone={event.tone}>
              <time>{formatTime(event.at)}</time>
              <span className="invoice-panel__event-label">
                {event.label}
                <small>
                  {event.kind} · {event.category}
                </small>
              </span>
              <code>{eventDetail(event)}</code>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function InvoicePanel({ context }: { context: DevtoolsExtensionContext }) {
  const instance = context.data.instance(sessionId);
  // EditorState is immutable, so its identity is a faithful snapshot of every dispatch.
  const view = useSyncExternalStore(instance.subscribe, () => instance()?.view);
  const editorState = useSyncExternalStore(instance.subscribe, () => instance()?.view.state);
  const events = useSyncExternalStore(domainEventLog.subscribe, domainEventLog.get);
  const debug = useMemo(
    () => (editorState ? readInvoiceDebugState(editorState, events) : null),
    [editorState, events],
  );
  if (!view || !debug) {
    return <p className="invoice-panel__empty">The invoice editor is not registered.</p>;
  }
  return (
    <div className="invoice-panel" data-theme={context.host.theme}>
      <div className="invoice-panel__column">
        <DocumentSection document={debug.document} />
        <Section title="Find" meta={debug.find.query ? `“${debug.find.query}”` : "idle"}>
          <p className="invoice-panel__empty">
            {debug.find.query
              ? `${debug.find.matches} matches decorated`
              : "No query. Use Find in the toolbar."}
          </p>
        </Section>
      </div>
      <div className="invoice-panel__column">
        <CommentsSection comments={debug.comments} view={view} />
        <ValidationSection validation={debug.validation} view={view} />
      </div>
      <div className="invoice-panel__column">
        <EventsSection events={debug.events} />
      </div>
    </div>
  );
}

export const invoiceDevtoolsExtension = createReactDevtoolsExtension({
  id: "invoice-workbench",
  panels: [
    {
      id: "invoice",
      title: "Invoice",
      order: 40,
      requiresInstance: true,
      render: (context) => <InvoicePanel context={context} />,
    },
  ],
});
