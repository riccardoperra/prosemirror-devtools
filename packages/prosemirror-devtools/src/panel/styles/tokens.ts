export const panelTokens = String.raw`
.pm-devtools {
  --pm-bg: #f7f8fa;
  --pm-panel: #ffffff;
  --pm-panel-2: #f0f2f5;
  --pm-border: #dfe3e8;
  --pm-border-strong: #c8ced6;
  --pm-text: #20242b;
  --pm-muted: #68717d;
  --pm-faint: #8e97a2;
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
  letter-spacing: -.005em;
}
.pm-devtools[data-theme="dark"] {
  --pm-bg: #111318;
  --pm-panel: #171a20;
  --pm-panel-2: #20242c;
  --pm-border: #2a303a;
  --pm-border-strong: #3a424f;
  --pm-text: #edf0f4;
  --pm-muted: #a4abb5;
  --pm-faint: #747d89;
  --pm-accent: #a99cf8;
  --pm-accent-soft: #2b2848;
  --pm-green: #5bd1a5;
  --pm-green-soft: #183a31;
  --pm-yellow: #f2b55a;
  --pm-yellow-soft: #3b2d18;
  --pm-red: #ff8393;
  --pm-red-soft: #40232a;
  --pm-blue: #73b7ff;
  --pm-blue-soft: #1d3045;
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
