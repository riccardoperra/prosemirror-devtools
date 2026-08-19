export const panelTokens = String.raw`
.pm-devtools {
  --pm-bg: #f6f6f5;
  --pm-panel: #ffffff;
  --pm-panel-2: #f0f0ef;
  --pm-border: #dededc;
  --pm-border-strong: #c8c8c5;
  --pm-text: #242424;
  --pm-muted: #6f6f6c;
  --pm-faint: #92928e;
  --pm-accent: #6758d7;
  --pm-accent-soft: #eceafd;
  --pm-green: #158f69;
  --pm-green-soft: #dcf5ea;
  --pm-yellow: #b16b10;
  --pm-yellow-soft: #fff0d2;
  --pm-red: #cf3e53;
  --pm-red-soft: #fee7eb;
  --pm-blue: #2775c9;
  --pm-blue-soft: #e5f1fd;
  --pm-shadow: 0 1px 2px rgba(24, 30, 42, .06);
  container-type: inline-size;
  color: var(--pm-text);
  background: var(--pm-bg);
  color-scheme: light;
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  max-inline-size: 100%;
  block-size: 100%;
  min-block-size: 360px;
  overflow: hidden;
  font: 500 12px/1.45 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.005em;
}
.pm-devtools[data-theme="dark"] {
  --pm-bg: #121212;
  --pm-panel: #181818;
  --pm-panel-2: #212121;
  --pm-border: #303030;
  --pm-border-strong: #444444;
  --pm-text: #f0f0f0;
  --pm-muted: #a8a8a8;
  --pm-faint: #777777;
  --pm-accent: #aea2f5;
  --pm-accent-soft: #2e2a43;
  --pm-green: #5bd1a5;
  --pm-green-soft: #19342b;
  --pm-yellow: #f2b55a;
  --pm-yellow-soft: #362a19;
  --pm-red: #ff8393;
  --pm-red-soft: #392126;
  --pm-blue: #7ab8ef;
  --pm-blue-soft: #1d2c38;
  --pm-shadow: 0 1px 2px rgba(0, 0, 0, .3);
  color-scheme: dark;
}
.pm-devtools * { box-sizing: border-box; }
.pm-devtools button, .pm-devtools select, .pm-devtools input { font: inherit; color: inherit; }
.pm-devtools button { cursor: pointer; }
.pm-devtools button:focus-visible, .pm-devtools select:focus-visible, .pm-devtools input:focus-visible {
  outline: 2px solid var(--pm-accent); outline-offset: 1px;
}
`;
