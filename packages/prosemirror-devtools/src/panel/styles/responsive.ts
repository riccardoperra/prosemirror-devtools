export const responsiveStyles = String.raw`
@container (max-width: 780px) {
  .pm-dispatch-workspace[data-layout="split"] { block-size: auto; overflow: visible; grid-template-columns: 1fr; }
  .pm-dispatch-workspace[data-layout="split"] > .pm-dispatch-plugin-pane, .pm-dispatch-workspace[data-layout="split"] > .pm-dispatch-detail-pane { overflow: visible; }
  .pm-dispatch-workspace[data-layout="split"] .pm-dispatch-detail-pane { border-inline-start: 0; border-block-start: 1px solid var(--pm-border); }
}
@container (max-width: 640px) {
  .pm-brand-copy { display: none; }
  .pm-toolbar { gap: 6px; }
  .pm-instance-select { min-inline-size: 0; max-inline-size: none; flex: 1; }
  .pm-toolbar > .pm-spacer { display: none; }
  .pm-body { overflow: auto; }
  .pm-split { block-size: auto; min-block-size: 100%; grid-template-columns: 1fr; overflow: visible; }
  .pm-split > .pm-pane { overflow: visible; }
  .pm-history-layout { block-size: auto; min-block-size: 100%; grid-template-columns: 1fr; overflow: visible; }
  .pm-pane + .pm-pane { border-inline-start: 0; border-block-start: 1px solid var(--pm-border); }
  .pm-history-list { block-size: clamp(180px, 42vh, 320px); overflow: auto; border-inline-end: 0; border-block-end: 1px solid var(--pm-border); }
  .pm-history-layout > .pm-dispatch-inspector { block-size: auto; overflow: visible; scrollbar-gutter: auto; }
  .pm-transaction-payload, .pm-detail-columns { grid-template-columns: 1fr; }
  .pm-transaction-payload > * + *, .pm-detail-columns > * + * { border-inline-start: 0; border-block-start: 1px solid var(--pm-border); }
  .pm-plugin-timing-columns { display: none; }
  .pm-plugin-timing-group { grid-template-columns: minmax(0, 1fr) auto; }
  .pm-plugin-hook-list { grid-column: 1 / -1; grid-row: 2; }
  .pm-plugin-full-time { grid-column: 2; grid-row: 1; }
  .pm-timeline-shell { grid-template-columns: clamp(140px, 40%, 190px) minmax(0, 1fr); }
  .pm-timeline-scroll-cue { display: none; }
  .pm-snapshot-actions { flex-wrap: wrap; }
  .pm-tabs { scrollbar-width: thin; }
  .pm-tabs::-webkit-scrollbar { display: block; block-size: 4px; }
}
@container (max-width: 420px) {
  .pm-brand { display: none; }
  .pm-toolbar { padding-inline: 7px; }
  .pm-tabs { gap: 13px; padding-inline: 8px; }
  .pm-pane-header { flex-wrap: wrap; }
  .pm-node-range, .pm-node-selection-label { display: none; }
  .pm-timeline-shell { grid-template-columns: 132px minmax(0, 1fr); }
}
`;
