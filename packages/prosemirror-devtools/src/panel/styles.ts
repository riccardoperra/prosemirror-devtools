import { responsiveStyles } from "./styles/responsive";
import { panelTokens } from "./styles/tokens";

const STYLE_ID = "prosemirror-devtools-panel-styles";

const styles = String.raw`${panelTokens}
@scope (.pm-devtools) {
.pm-header { flex: none; block-size: auto !important; background: var(--pm-panel); border-block-end: 1px solid var(--pm-border); z-index: 2; }
.pm-header[data-embedded="true"] { display: flex; align-items: stretch; min-inline-size: 0; }
.pm-header[data-embedded="true"] .pm-toolbar { flex: none; border-inline-end: 1px solid var(--pm-border); }
.pm-header[data-embedded="true"] .pm-tabs { min-inline-size: 0; flex: 1; align-items: stretch; }
.pm-toolbar { min-block-size: 42px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; }
.pm-brand { display: flex; align-items: center; gap: 7px; min-inline-size: 0; }
.pm-brand-mark { inline-size: 24px; block-size: 24px; display: grid; place-items: center; border-radius: 7px; color: #fff; background: linear-gradient(145deg, #7868ec, #5141bd); font: 800 9px/1 ui-monospace, monospace; box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); }
.pm-brand-copy { font-size: 12px; font-weight: 750; white-space: nowrap; }
.pm-live { inline-size: 6px; block-size: 6px; border-radius: 50%; background: var(--pm-green); box-shadow: 0 0 0 3px var(--pm-green-soft); }
.pm-spacer { flex: 1; }
.pm-instance-select { min-inline-size: 140px; max-inline-size: min(270px, 40vw); block-size: 28px; border: 1px solid var(--pm-border); background: var(--pm-panel-2); border-radius: 7px; padding: 0 28px 0 9px; }
.pm-icon-button, .pm-button { border: 1px solid var(--pm-border); background: var(--pm-panel); border-radius: 7px; min-block-size: 28px; padding: 0 9px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; }
.pm-icon-button { inline-size: 28px; padding: 0; color: var(--pm-muted); }
.pm-button:hover, .pm-icon-button:hover { border-color: var(--pm-border-strong); background: var(--pm-panel-2); }
.pm-button[data-variant="primary"] { background: var(--pm-accent); border-color: var(--pm-accent); color: var(--pm-panel); }
.pm-button[data-variant="danger"] { color: var(--pm-red); }
.pm-tabs { display: flex; align-items: stretch; gap: 16px; padding: 0 10px; overflow-x: auto; scrollbar-width: none; }
.pm-tabs::-webkit-scrollbar { display: none; }
.pm-tab { position: relative; min-block-size: 35px; border: 0; background: transparent; color: var(--pm-muted); padding: 0 1px; font-weight: 650; }
.pm-tab:hover { color: var(--pm-text); }
.pm-tab[aria-selected="true"] { color: var(--pm-text); }
.pm-tab::after { content: ""; position: absolute; inset: auto 0 -1px; block-size: 2px; background: transparent; }
.pm-tab[aria-selected="true"]::after { background: var(--pm-accent); }
.pm-tab-count { margin-inline-start: 4px; color: var(--pm-faint); font: 600 10px/1 ui-monospace, monospace; }
.pm-body { flex: 1; block-size: auto !important; min-block-size: 0; overflow: hidden; }
.pm-extension-panel { block-size: 100%; min-block-size: 0; overflow: auto; }
.pm-scroll { block-size: 100%; overflow: auto; scrollbar-color: var(--pm-border-strong) transparent; }
.pm-performance-view { background: var(--pm-bg); }
.pm-empty { block-size: 100%; min-block-size: 260px; display: grid; place-items: center; color: var(--pm-muted); text-align: center; padding: 32px; }
.pm-empty-mark { inline-size: 42px; block-size: 42px; margin: 0 auto 12px; border: 1px dashed var(--pm-border-strong); border-radius: 13px; display: grid; place-items: center; font: 800 13px/1 ui-monospace, monospace; color: var(--pm-faint); }
.pm-split { display: grid; grid-template-columns: minmax(230px, 38%) minmax(0, 1fr); block-size: 100%; min-block-size: 0; }
.pm-pane { min-inline-size: 0; min-block-size: 0; overflow: auto; }
.pm-pane + .pm-pane { border-inline-start: 1px solid var(--pm-border); }
.pm-pane-header { position: sticky; inset-block-start: 0; z-index: 1; min-block-size: 35px; padding: 7px 9px; display: flex; align-items: center; gap: 7px; background: color-mix(in srgb, var(--pm-panel) 94%, transparent); backdrop-filter: blur(8px); border-block-end: 1px solid var(--pm-border); }
.pm-pane-title, .pm-section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--pm-muted); }
.pm-eyebrow { display: block; color: var(--pm-muted); font-size: 9px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
.pm-compact-metrics { min-block-size: 34px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; padding: 6px 10px; border-block-end: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-compact-metric { min-inline-size: 0; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.pm-status-dot { inline-size: 6px; block-size: 6px; flex: none; border-radius: 50%; background: var(--pm-faint); }
.pm-compact-metric > span { color: var(--pm-muted); font-size: 10px; }
.pm-compact-metric > strong { font: 700 10.5px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.pm-compact-metric > small { max-inline-size: 210px; overflow: hidden; color: var(--pm-faint); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.pm-compact-metric > small::before { content: "· "; }
.pm-badge { display: inline-flex; align-items: center; min-block-size: 18px; padding: 1px 6px; border-radius: 999px; color: var(--pm-muted); background: var(--pm-panel-2); border: 1px solid var(--pm-border); font: 650 10px/1.2 ui-monospace, monospace; white-space: nowrap; }
.pm-badge[data-tone="green"] { color: var(--pm-green); background: var(--pm-green-soft); border-color: transparent; }
.pm-badge[data-tone="yellow"] { color: var(--pm-yellow); background: var(--pm-yellow-soft); border-color: transparent; }
.pm-badge[data-tone="red"] { color: var(--pm-red); background: var(--pm-red-soft); border-color: transparent; }
.pm-badge[data-tone="blue"] { color: var(--pm-blue); background: var(--pm-blue-soft); border-color: transparent; }
.pm-list { margin: 0; padding: 0; list-style: none; }
.pm-list-row { inline-size: 100%; min-block-size: 34px; display: flex; align-items: center; gap: 7px; padding: 6px 9px; border: 0; border-block-end: 1px solid var(--pm-border); background: transparent; text-align: start; }
.pm-list-row:hover { background: var(--pm-panel-2); }
.pm-list-row[aria-selected="true"] { background: var(--pm-accent-soft); box-shadow: inset 2px 0 var(--pm-accent); }
.pm-row-main { min-inline-size: 0; flex: 1; display: flex; align-items: baseline; gap: 6px; }
.pm-row-title { min-inline-size: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
.pm-row-detail { min-inline-size: 0; flex: 1 1 auto; color: var(--pm-muted); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-variant-numeric: tabular-nums; }
.pm-muted { color: var(--pm-muted); }
.pm-inspector-stats { display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 9px; border-block-end: 1px solid var(--pm-border); }
.pm-doc-row { --depth: 0; inline-size: 100%; min-block-size: 29px; display: flex; align-items: center; gap: 5px; border-block-end: 1px solid color-mix(in srgb, var(--pm-border) 65%, transparent); background: transparent; padding: 3px 7px 3px calc(8px + var(--depth) * 13px); text-align: start; }
.pm-doc-row:hover { background: var(--pm-panel-2); }
.pm-doc-row[data-inspected="true"] { background: var(--pm-accent-soft); }
.pm-doc-row[data-editor-selection] { box-shadow: inset 2px 0 var(--pm-blue); }
.pm-doc-row[data-editor-selection="full"] { background: color-mix(in srgb, var(--pm-blue-soft) 62%, transparent); }
.pm-doc-row[data-inspected="true"][data-editor-selection] { background: linear-gradient(90deg, var(--pm-accent-soft), color-mix(in srgb, var(--pm-blue-soft) 46%, var(--pm-accent-soft))); }
.pm-doc-row-main { min-inline-size: 0; min-block-size: 22px; flex: 1; display: flex; align-items: center; gap: 5px; border: 0; padding: 0; color: inherit; background: transparent; text-align: start; }
.pm-node-caret { inline-size: 12px; block-size: 22px; flex: none; display: grid; place-items: center; border: 0; padding: 0; color: var(--pm-faint); background: transparent; text-align: center; }
.pm-node-name { color: var(--pm-accent); font: 650 11px/1.3 ui-monospace, monospace; }
.pm-node-text { min-inline-size: 0; color: var(--pm-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-node-selection-label { flex: none; padding: 2px 5px; border-radius: 999px; color: var(--pm-blue); background: var(--pm-blue-soft); font: 700 8px/1 ui-monospace, monospace; letter-spacing: .02em; }
.pm-node-selection-label[data-coverage="partial"] { border: 1px dashed color-mix(in srgb, var(--pm-blue) 55%, transparent); padding: 1px 4px; background: transparent; }
.pm-node-range { flex: none; display: inline-flex; align-items: center; gap: 3px; color: var(--pm-faint); font: 600 9px/1 ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.pm-node-range > span:nth-child(2) { color: var(--pm-border-strong); }
.pm-node-select-action { min-block-size: 21px; flex: none; border: 1px solid var(--pm-border); border-radius: 5px; padding: 0 6px; opacity: 0; pointer-events: none; color: var(--pm-blue); background: var(--pm-panel); font-size: 8.5px; font-weight: 750; }
.pm-doc-row:hover .pm-node-select-action, .pm-doc-row:focus-within .pm-node-select-action, .pm-doc-row[data-inspected="true"] .pm-node-select-action, .pm-node-select-action:focus-visible { opacity: 1; pointer-events: auto; }
.pm-node-select-action:hover { border-color: color-mix(in srgb, var(--pm-blue) 45%, var(--pm-border)); background: var(--pm-blue-soft); }
.pm-document-json { min-block-size: 100%; background: var(--pm-panel); }
.pm-doc-tree-item, .pm-json-node, .pm-list-row, .pm-snapshot-card, .pm-plugin-timing-group { content-visibility: auto; contain-intrinsic-block-size: 32px; }
.pm-json { padding: 6px 7px 10px; font: 500 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pm-json-row { min-block-size: 22px; display: flex; align-items: flex-start; gap: 4px; padding-inline-start: calc(var(--depth, 0) * 12px); border-radius: 4px; }
.pm-json-row:hover { background: var(--pm-panel-2); }
.pm-json-toggle { flex: none; inline-size: 14px; block-size: 20px; border: 0; padding: 0; color: var(--pm-faint); background: transparent; }
.pm-json-key { color: var(--pm-blue); }
.pm-json-string { color: var(--pm-green); overflow-wrap: anywhere; }
.pm-json-number { color: var(--pm-yellow); }
.pm-json-boolean { color: var(--pm-accent); }
.pm-json-null, .pm-json-summary { color: var(--pm-faint); }
.pm-json-actions { opacity: 0; margin-inline-start: auto; }
.pm-json-row:hover .pm-json-actions, .pm-json-row:focus-within .pm-json-actions { opacity: 1; }
.pm-detail-block { border-block-end: 1px solid var(--pm-border); }
.pm-detail-heading { min-block-size: 32px; padding: 7px 9px; background: var(--pm-panel-2); display: flex; align-items: center; gap: 7px; }
.pm-history-layout { display: grid; grid-template-columns: minmax(250px, 34%) minmax(0, 1fr); block-size: 100%; min-block-size: 0; overflow: hidden; }
.pm-history-list { min-block-size: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; border-inline-end: 1px solid var(--pm-border); }
.pm-history-row { display: grid; grid-template-columns: var(--pm-history-id-width, 4ch) minmax(0, 1fr) auto; }
.pm-history-row .pm-row-main { display: grid; grid-template-columns: 12.5ch minmax(0, 1fr); }
.pm-transaction-time { inline-size: 100%; color: var(--pm-accent); font: 700 11px/1 ui-monospace, monospace; text-align: end; }
.pm-history-timestamp { font-variant-numeric: tabular-nums; }
.pm-history-badges { min-inline-size: 0; display: flex; justify-content: flex-end; gap: 4px; }
.pm-detail-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pm-detail-columns > * + * { border-inline-start: 1px solid var(--pm-border); }
.pm-dispatch-inspector { container-type: inline-size; min-inline-size: 0; overflow: hidden; border-block-end: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-history-layout > .pm-dispatch-inspector { block-size: 100%; min-block-size: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; border: 0; }
.pm-history-layout > .pm-dispatch-inspector .pm-dispatch-header { position: sticky; z-index: 2; inset-block-start: 0; }
.pm-dispatch-header { min-block-size: 43px; padding: 6px 9px; display: flex; align-items: center; gap: 7px; border-block-end: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-dispatch-identity { min-inline-size: 0; display: grid; grid-template-columns: auto minmax(0, auto); align-items: baseline; gap: 1px 7px; }
.pm-dispatch-identity .pm-eyebrow { grid-column: 1 / -1; }
.pm-dispatch-identity > strong { color: var(--pm-accent); font: 750 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pm-dispatch-badges { display: flex; flex-wrap: wrap; gap: 4px; }
.pm-dispatch-inspector > .pm-compact-metrics { background: var(--pm-panel-2); }
.pm-dispatch-workspace { display: grid; min-inline-size: 0; grid-template-columns: minmax(0, 1.12fr) minmax(320px, .88fr); }
.pm-dispatch-workspace[data-layout="split"] { block-size: clamp(300px, 55vh, 460px); overflow: hidden; }
.pm-dispatch-workspace[data-layout="details"] { display: block; }
.pm-dispatch-plugin-pane, .pm-dispatch-detail-pane { min-inline-size: 0; }
.pm-dispatch-workspace[data-layout="split"] > .pm-dispatch-plugin-pane, .pm-dispatch-workspace[data-layout="split"] > .pm-dispatch-detail-pane { min-block-size: 0; overflow: auto; }
.pm-dispatch-detail-pane { border-inline-start: 1px solid var(--pm-border); }
.pm-dispatch-workspace[data-layout="details"] .pm-dispatch-detail-pane { border-inline-start: 0; }
.pm-workspace-heading { min-block-size: 34px; display: flex; align-items: center; gap: 7px; padding: 6px 9px; border-block-end: 1px solid var(--pm-border); background: var(--pm-panel-2); }
.pm-view-switch { display: inline-flex; overflow: hidden; border: 1px solid var(--pm-border); border-radius: 6px; background: var(--pm-panel); }
.pm-view-switch > button { min-block-size: 22px; border: 0; padding: 0 8px; color: var(--pm-muted); background: transparent; font-size: 9px; font-weight: 700; }
.pm-view-switch > button + button { border-inline-start: 1px solid var(--pm-border); }
.pm-view-switch > button:hover { color: var(--pm-text); background: var(--pm-panel-2); }
.pm-view-switch > button[aria-pressed="true"] { color: var(--pm-accent); background: var(--pm-accent-soft); }
.pm-marker-section { border-block-end: 1px solid var(--pm-border); }
.pm-marker-entry + .pm-marker-entry { border-block-start: 1px solid var(--pm-border); }
.pm-marker-row { min-block-size: 39px; display: flex; align-items: center; gap: 7px; padding: 6px 9px; }
.pm-marker-row > .pm-mono { color: var(--pm-muted); font-size: 10px; }
.pm-marker-entry[data-tone="info"] .pm-status-dot { background: var(--pm-blue); }
.pm-marker-entry[data-tone="success"] .pm-status-dot { background: var(--pm-green); }
.pm-marker-entry[data-tone="warning"] .pm-status-dot { background: var(--pm-yellow); }
.pm-marker-entry[data-tone="danger"] .pm-status-dot { background: var(--pm-red); }
.pm-marker-entry > .pm-json { margin: 0 8px 8px; overflow: auto; border: 1px solid var(--pm-border); border-radius: 6px; background: var(--pm-bg); }
.pm-inspector-empty { padding: 24px 12px; color: var(--pm-muted); text-align: center; }
.pm-transaction-stack { display: grid; }
.pm-transaction-record { border-block-end: 1px solid var(--pm-border); }
.pm-transaction-record:last-child { border-block-end: 0; }
.pm-transaction-record > summary { min-block-size: 36px; display: flex; align-items: center; gap: 7px; padding: 5px 9px; list-style: none; cursor: pointer; }
.pm-transaction-record > summary::-webkit-details-marker { display: none; }
.pm-transaction-record > summary::before { content: "›"; inline-size: 12px; color: var(--pm-faint); font: 700 14px/1 ui-monospace, monospace; transition: transform 120ms ease; }
.pm-transaction-record[open] > summary::before { transform: rotate(90deg); }
.pm-transaction-record > summary:hover { background: var(--pm-panel-2); }
.pm-transaction-record > summary > strong { font-size: 11px; }
.pm-transaction-kind { min-inline-size: 56px; color: var(--pm-accent); font: 700 9px/1 ui-monospace, monospace; letter-spacing: .05em; text-transform: uppercase; }
.pm-transaction-payload { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-block-start: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-transaction-payload > * + * { border-inline-start: 1px solid var(--pm-border); }
.pm-transaction-payload .pm-json, .pm-selection-detail .pm-json, .pm-document-disclosure .pm-json { margin: 8px; overflow: auto; border: 1px solid var(--pm-border); border-radius: 6px; background: var(--pm-bg); }
.pm-dispatch-workspace[data-layout="split"] .pm-transaction-payload { grid-template-columns: 1fr; }
.pm-dispatch-workspace[data-layout="split"] .pm-transaction-payload > * + * { border-inline-start: 0; border-block-start: 1px solid var(--pm-border); }
.pm-selection-detail { border-block-start: 1px solid var(--pm-border); }
.pm-document-disclosure { border-block-start: 1px solid var(--pm-border); }
.pm-document-disclosure > summary { min-block-size: 36px; display: flex; align-items: center; gap: 7px; padding: 6px 9px; list-style: none; background: var(--pm-panel-2); cursor: pointer; }
.pm-document-disclosure > summary::-webkit-details-marker { display: none; }
.pm-document-disclosure > summary::before { content: "›"; color: var(--pm-faint); font: 700 14px/1 ui-monospace, monospace; transition: transform 120ms ease; }
.pm-document-disclosure[open] > summary::before { transform: rotate(90deg); }
.pm-chart-wrap { container-type: inline-size; margin: 0; overflow: hidden; border-block-end: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-chart-header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 10px; border-block-end: 1px solid var(--pm-border); }
.pm-chart-legend { display: flex; flex-wrap: wrap; gap: 10px; color: var(--pm-muted); font-size: 10px; }
.pm-performance-toolbar { min-block-size: 38px; flex-wrap: nowrap; gap: 10px; overflow-x: auto; padding-block: 5px; scrollbar-width: thin; }
.pm-performance-toolbar > .pm-spacer { min-inline-size: 4px; }
.pm-performance-toolbar .pm-chart-legend { flex: none; flex-wrap: nowrap; }
.pm-chart-summary { flex: none; display: flex; align-items: center; }
.pm-chart-summary-metric { min-inline-size: 0; display: inline-flex; align-items: baseline; gap: 5px; padding-inline: 10px; border-inline-start: 1px solid var(--pm-border); white-space: nowrap; }
.pm-chart-summary-metric:first-child { padding-inline-start: 0; border-inline-start: 0; }
.pm-chart-summary-metric > span { color: var(--pm-muted); font-size: 9.5px; }
.pm-chart-summary-metric > strong { font: 700 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.pm-chart-summary-metric > small { color: var(--pm-faint); font-size: 8.5px; }
.pm-chart-summary-metric > small::before { content: "· "; }
.pm-dispatch-selection { flex: none; display: inline-grid; grid-template-columns: 29px minmax(64px, auto) 29px; overflow: hidden; border: 1px solid var(--pm-border-strong); border-radius: 6px; background: var(--pm-panel); }
.pm-dispatch-selection > button { block-size: 27px; border: 0; padding: 0; color: var(--pm-accent); background: var(--pm-accent-soft); font: 800 15px/1 ui-monospace, monospace; transition: color 100ms ease, background 100ms ease; }
.pm-dispatch-selection > button:hover:not(:disabled) { color: var(--pm-text); background: color-mix(in srgb, var(--pm-accent) 22%, var(--pm-panel)); }
.pm-dispatch-selection > button:active:not(:disabled) { background: color-mix(in srgb, var(--pm-accent) 32%, var(--pm-panel)); }
.pm-dispatch-selection > button:focus-visible { position: relative; z-index: 1; outline: 1px solid var(--pm-accent); outline-offset: -1px; }
.pm-dispatch-selection > button:disabled { color: color-mix(in srgb, var(--pm-faint) 38%, transparent); background: var(--pm-panel); cursor: not-allowed; }
.pm-dispatch-selection > output { min-block-size: 27px; display: grid; place-items: center; padding-inline: 7px; border-inline: 1px solid var(--pm-border-strong); color: var(--pm-text); background: var(--pm-panel-2); font: 700 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pm-tanstack-chart { position: relative; min-inline-size: 0; color: var(--pm-text); --ts-chart-1: var(--pm-accent); --ts-chart-2: var(--pm-green); --ts-chart-3: var(--pm-blue); --ts-chart-4: var(--pm-yellow); --ts-chart-5: var(--pm-muted); --ts-chart-focus-fill: var(--pm-panel); }
.pm-tanstack-chart .ts-chart-host { inline-size: 100%; font-family: inherit; }
.pm-tanstack-chart svg { display: block; inline-size: 100%; }
.pm-tanstack-chart svg:focus { outline: none; }
.pm-tanstack-chart svg:focus-visible { outline: 1px solid var(--pm-accent); outline-offset: -1px; border-radius: 4px; }
.pm-dispatch-chart { padding: 4px 8px 2px; }
.pm-dispatch-chart-plot { position: relative; z-index: 1; inline-size: 100%; max-inline-size: 100%; }
.pm-duration-detail-zone { position: absolute; z-index: 2; border-block-start: 1px dotted color-mix(in srgb, var(--pm-blue) 65%, var(--pm-border)); background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--pm-blue-soft) 34%, transparent)); pointer-events: none; }
.pm-frame-budget-reference { position: absolute; z-index: 3; border-block-start: 1px dashed var(--pm-red); pointer-events: none; }
.pm-frame-budget-label { position: absolute; inset-inline-start: 5px; inset-block-start: -4px; transform: translateY(-100%); padding: 2px 5px; border-radius: 4px; color: var(--pm-red); background: color-mix(in srgb, var(--pm-panel) 94%, transparent); font: 700 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
.pm-plugin-cost-chart { padding: 4px 6px 2px; border-block-end: 1px solid var(--pm-border); background: var(--pm-panel-2); }
.pm-dispatch-cost-summary { padding: 9px 10px 8px; border-block-end: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-dispatch-cost-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 10px; color: var(--pm-muted); }
.pm-dispatch-cost-heading > strong { color: var(--pm-text); font-size: 11px; }
.pm-dispatch-cost-meter { block-size: 9px; display: flex; margin-block-start: 7px; overflow: hidden; border-radius: 5px; background: var(--pm-panel-2); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pm-border) 75%, transparent); }
.pm-dispatch-cost-meter > span { min-inline-size: 0; block-size: 100%; }
.pm-dispatch-cost-meter > [data-segment="plugin"], .pm-legend-dot[data-segment="plugin"] { background: var(--pm-accent); }
.pm-dispatch-cost-meter > [data-segment="other"], .pm-legend-dot[data-segment="other"] { background: var(--pm-blue); }
.pm-dispatch-cost-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-block-start: 7px; color: var(--pm-muted); font-size: 9px; }
.pm-dispatch-cost-legend > span { display: inline-flex; align-items: center; gap: 2px; }
.pm-dispatch-cost-legend strong { margin-inline-start: 2px; color: var(--pm-text); }
.pm-dispatch-cost-note { margin: 5px 0 0; color: var(--pm-faint); font-size: 9px; }
.pm-fast-plugin-disclosure { padding: 6px 10px; border-block-end: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-fast-plugin-disclosure > button { min-block-size: 25px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--pm-border); border-radius: 6px; padding: 0 8px; color: var(--pm-muted); background: var(--pm-panel-2); font: 650 9.5px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pm-fast-plugin-disclosure > button:hover { color: var(--pm-text); border-color: var(--pm-border-strong); }
.pm-fast-plugin-disclosure > button > span { color: var(--pm-accent); font-size: 12px; }
.pm-plugin-timeline { border-block-end: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-plugin-timeline-heading { min-block-size: 42px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; border-block-end: 1px solid var(--pm-border); }
.pm-plugin-timeline-copy { min-inline-size: 0; display: grid; gap: 1px; }
.pm-plugin-timeline-copy > strong { color: var(--pm-text); font-size: 10px; }
.pm-plugin-timeline-copy > span { overflow: hidden; color: var(--pm-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.pm-plugin-timeline-legend { min-block-size: 29px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; padding: 5px 10px; border-block-end: 1px solid var(--pm-border); color: var(--pm-muted); background: var(--pm-panel-2); font-size: 8.5px; }
.pm-plugin-timeline-legend > span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.pm-plugin-timeline-legend i { inline-size: 7px; block-size: 7px; display: inline-block; border-radius: 2px; }
.pm-plugin-timeline-legend i[data-family="state"] { background: var(--pm-accent); }
.pm-plugin-timeline-legend i[data-family="transaction"] { background: var(--pm-blue); }
.pm-plugin-timeline-legend i[data-family="view"] { background: var(--pm-green); }
.pm-plugin-timeline-legend i[data-family="props"] { background: var(--pm-yellow); }
.pm-plugin-timeline-legend i[data-kind="minimum"] { block-size: 3px; border-radius: 1px; background: var(--pm-accent); }
.pm-timeline-scroll-cue { margin-inline-start: auto; color: var(--pm-faint); font: 650 8.5px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pm-timeline-shell { min-inline-size: 0; display: grid; grid-template-columns: clamp(190px, 29%, 310px) minmax(0, 1fr); align-items: start; background: var(--pm-panel); }
.pm-timeline-lane-rail { position: relative; z-index: 2; overflow: hidden; border-inline-end: 1px solid var(--pm-border); background: var(--pm-panel); }
.pm-timeline-lane-label { position: absolute; inset-inline: 0; min-block-size: 27px; display: flex; align-items: center; gap: 6px; padding: 3px 9px; transform: translateY(-50%); color: var(--pm-muted); }
.pm-timeline-lane-label[data-kind="dispatch"], .pm-timeline-lane-label[data-kind="phase"] { background: color-mix(in srgb, var(--pm-panel-2) 68%, transparent); }
.pm-timeline-lane-label[data-sequence="1"]::before { content: ""; position: absolute; inset: -3px 0 auto; border-block-start: 1px solid var(--pm-border); }
.pm-timeline-sequence { flex: none; inline-size: 18px; color: var(--pm-faint); font: 650 8px/1 ui-monospace, SFMono-Regular, Menlo, monospace; text-align: end; }
.pm-timeline-lane-copy { min-inline-size: 0; display: grid; gap: 1px; }
.pm-timeline-lane-copy > strong, .pm-timeline-lane-copy > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-timeline-lane-copy > strong { color: var(--pm-text); font-size: 9.5px; }
.pm-timeline-lane-copy > span { color: var(--pm-faint); font: 600 8px/1.15 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pm-timeline-scroll { min-inline-size: 0; overflow-x: auto; overflow-y: hidden; overscroll-behavior-inline: contain; scrollbar-gutter: stable; background: var(--pm-panel); }
.pm-timeline-scroll:focus-visible { outline: 1px solid var(--pm-accent); outline-offset: -1px; }
.pm-timeline-chart-surface { inline-size: max(960px, 200%); }
.pm-timeline-chart-surface .ts-chart-host { inline-size: 100%; }
.pm-timeline-chart-surface svg { display: block; inline-size: 100%; }
.pm-plugin-breakdown-details { border-block-start: 1px solid var(--pm-border); }
.pm-plugin-breakdown-details > summary { min-block-size: 34px; display: flex; align-items: center; gap: 7px; padding: 6px 10px; list-style: none; cursor: pointer; background: var(--pm-panel); }
.pm-plugin-breakdown-details > summary::-webkit-details-marker { display: none; }
.pm-plugin-breakdown-details > summary::before { content: "›"; color: var(--pm-faint); font: 700 14px/1 ui-monospace, monospace; transition: transform 120ms ease; }
.pm-plugin-breakdown-details[open] > summary::before { transform: rotate(90deg); }
.pm-legend-dot { inline-size: 7px; block-size: 7px; display: inline-block; border-radius: 2px; margin-inline-end: 4px; }
.pm-cumulative-hooks > summary { cursor: pointer; list-style: none; border-block-end: 0; }
.pm-cumulative-hooks > summary::-webkit-details-marker { display: none; }
.pm-cumulative-hooks > summary::before { content: "›"; color: var(--pm-faint); font: 700 14px/1 ui-monospace, monospace; transition: transform 120ms ease; }
.pm-cumulative-hooks[open] > summary { border-block-end: 1px solid var(--pm-border); }
.pm-cumulative-hooks[open] > summary::before { transform: rotate(90deg); }
.pm-plugin-timing-columns, .pm-plugin-timing-group { display: grid; grid-template-columns: minmax(120px, .72fr) minmax(0, 2fr) minmax(78px, auto); gap: 10px; }
.pm-plugin-timing-columns { padding: 6px 10px; color: var(--pm-muted); background: var(--pm-panel-2); border-block-end: 1px solid var(--pm-border); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; }
.pm-plugin-timing-columns > :last-child { text-align: end; }
.pm-plugin-timing-list { display: grid; }
.pm-plugin-timing-group { min-block-size: 52px; align-items: center; padding: 7px 10px; border-block-end: 1px solid var(--pm-border); }
.pm-plugin-timing-group:last-child { border-block-end: 0; }
.pm-plugin-timing-group:first-child { background: color-mix(in srgb, var(--pm-accent) 4%, transparent); }
.pm-plugin-timing-identity { min-inline-size: 0; display: flex; align-items: center; gap: 7px; }
.pm-plugin-timing-rank { flex: none; inline-size: 18px; block-size: 18px; display: grid; place-items: center; border: 1px solid var(--pm-border); border-radius: 5px; color: var(--pm-muted); background: var(--pm-panel-2); font: 700 9px/1 ui-monospace, monospace; }
.pm-plugin-timing-group:first-child .pm-plugin-timing-rank { color: var(--pm-accent); border-color: color-mix(in srgb, var(--pm-accent) 35%, var(--pm-border)); background: var(--pm-accent-soft); }
.pm-plugin-hook-list { min-inline-size: 0; display: flex; flex-wrap: wrap; gap: 4px; }
.pm-plugin-timing-identity .pm-row-main { display: grid; gap: 1px; }
.pm-plugin-hook-chip { min-inline-size: 0; max-inline-size: 100%; min-block-size: 25px; display: inline-flex; align-items: center; gap: 6px; padding: 3px 6px; border: 1px solid var(--pm-border); border-radius: 6px; background: var(--pm-panel-2); white-space: nowrap; }
.pm-plugin-hook-chip::before { content: ""; inline-size: 5px; block-size: 5px; border-radius: 2px; background: var(--pm-muted); }
.pm-plugin-hook-chip[data-family="state"]::before { background: var(--pm-accent); }
.pm-plugin-hook-chip[data-family="transaction"]::before { background: var(--pm-blue); }
.pm-plugin-hook-chip[data-family="view"]::before { background: var(--pm-green); }
.pm-plugin-hook-chip[data-family="props"]::before { background: var(--pm-yellow); }
.pm-plugin-hook-name { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; color: var(--pm-muted); font: 600 10px/1.2 ui-monospace, monospace; }
.pm-plugin-hook-count { color: var(--pm-faint); font: 650 9px/1 ui-monospace, monospace; }
.pm-plugin-full-time { min-inline-size: 90px; display: grid; justify-items: end; }
.pm-plugin-full-value { font: 750 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pm-plugin-full-label { margin-block-start: 1px; color: var(--pm-faint); font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
.pm-plugin-full-meter { inline-size: 74px; block-size: 3px; margin-block-start: 5px; overflow: hidden; border-radius: 3px; background: var(--pm-panel-2); }
.pm-plugin-full-meter > span { display: block; block-size: 100%; border-radius: inherit; background: var(--pm-accent); }
.pm-plugin-timing-empty { padding: 18px 10px; color: var(--pm-muted); text-align: center; }
.pm-performance-note { padding: 8px 10px; border-block-end: 1px solid var(--pm-border); color: var(--pm-muted); background: var(--pm-panel-2); font-size: 10px; }
.pm-performance-note strong { color: var(--pm-text); }
.pm-performance-note code { color: var(--pm-green); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.pm-table { inline-size: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.pm-table th { position: sticky; inset-block-start: 0; z-index: 1; padding: 6px 8px; text-align: start; color: var(--pm-muted); background: var(--pm-panel-2); border-block-end: 1px solid var(--pm-border); font-size: 9px; text-transform: uppercase; letter-spacing: .07em; }
.pm-table td { padding: 7px 8px; border-block-end: 1px solid var(--pm-border); }
.pm-table th:not(:first-child), .pm-table td:not(:first-child) { text-align: end; }
.pm-meter { inline-size: 80px; block-size: 4px; margin-inline-start: auto; border-radius: 4px; overflow: hidden; background: var(--pm-panel-2); }
.pm-meter > span { display: block; block-size: 100%; border-radius: inherit; background: var(--pm-accent); }
.pm-search { inline-size: 100%; block-size: 27px; border: 1px solid var(--pm-border); background: var(--pm-panel); border-radius: 6px; padding: 0 8px; }
.pm-snapshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px; padding: 10px; }
.pm-snapshot-card { border: 1px solid var(--pm-border); background: var(--pm-panel); border-radius: 9px; padding: 10px; box-shadow: var(--pm-shadow); }
.pm-snapshot-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-block-start: 10px; }
.pm-warning { margin: 8px 10px; padding: 8px 9px; border: 1px solid color-mix(in srgb, var(--pm-yellow) 30%, var(--pm-border)); border-radius: 8px; background: var(--pm-yellow-soft); color: var(--pm-yellow); }
${responsiveStyles}
}
`;

export function ensurePanelStyles(target: Document = document): void {
  if (target.getElementById(STYLE_ID)) return;
  const style = target.createElement("style");
  style.id = STYLE_ID;
  style.textContent = styles;
  target.head.append(style);
}
