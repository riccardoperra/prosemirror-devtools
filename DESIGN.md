# ProseMirror Inspector design guide

This guide defines how every Inspector panel looks and behaves. Follow it when adding a tab,
an extension panel, or a component, and when fixing an existing one. The styles live in
`packages/prosemirror-devtools/src/panel/panel.module.css` and are exposed as `panelStyles`.

The [audit](#audit-november-2026) at the end lists where the current panels differ from this
guide. Fix those deviations by applying the rules below, not by adding new variants.

## Principles

1. **Evidence first.** The panel shows captured editor facts. Chrome stays quiet so values,
   states and differences stand out.
2. **One pattern per job.** A list row, a section heading, a note and a selected item look the
   same in every tab. A tab never invents its own variant.
3. **Dense but readable.** Developer tools need density. Density comes from tight spacing, not
   from tiny text.
4. **Isolated from the host.** The panel renders inside arbitrary applications. It never relies on
   browser defaults or host styles for any property it depends on.
5. **Tokens, not literals.** Colors, radii and type sizes come from the scales below. A raw value
   in a component is a bug unless the guide lists it as an exception.

## Tokens

### Color

Public custom properties are `--prosemirror-devtools-*`. Components use the short `--pm-*`
aliases. Both light and dark themes define every token.

| Token                                                            | Use                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `--pm-bg`                                                        | Panel background and pane background behind content.                   |
| `--pm-panel`                                                     | Surfaces: headers, rows, cards, inputs, default buttons.               |
| `--pm-panel-2`                                                   | Subtle surfaces: section headings, hover, code blocks, notes.          |
| `--pm-border`                                                    | All dividers and control borders.                                      |
| `--pm-border-strong`                                             | Scrollbars and emphasized control borders only.                        |
| `--pm-text`                                                      | Primary text and values.                                               |
| `--pm-muted`                                                     | Secondary text, labels, metadata.                                      |
| `--pm-faint`                                                     | Tertiary text: counts, units, separators. Never for essential content. |
| `--pm-accent` / `--pm-accent-soft`                               | Selection, current view, focus, primary action.                        |
| `--pm-green`, `--pm-yellow`, `--pm-red`, `--pm-blue` and `-soft` | Semantic tones only. See [Badge](#badge).                              |

Do not use accent for decoration. Accent means "selected", "current" or "primary".

### Typography

The panel font is `--prosemirror-devtools-font-family` at 12px with weight 500. Monospace
(`ui-monospace, SFMono-Regular, Menlo, monospace`) is for identifiers, values, positions, JSON,
timings and badges.

| Step    | Size | Weight  | Use                                                                      |
| ------- | ---- | ------- | ------------------------------------------------------------------------ |
| Title   | 13px | 650     | The single heading of a full-pane view (for example Context).            |
| Body    | 12px | 500     | Default text, row titles, buttons, inputs, disclosure summaries.         |
| Small   | 11px | 500     | Row metadata, table cells, JSON tree.                                    |
| Caption | 10px | 500–700 | Notes, badges, uppercase section titles, tab counts, view switch labels. |

Rules:

- **10px is the minimum.** Chart axis ticks may use 9px. No other text goes below 10px.
- Weights are 500, 650 and 700. Do not introduce 750 or 800.
- Section titles use the `pmSectionTitle` style: caption size, weight 700, uppercase, `0.06em`
  tracking, `--pm-muted`. Write the source text in sentence case; CSS uppercases it.
- Numbers use `font-variant-numeric: tabular-nums` (inherited from the root).

### Spacing

Use a 4px grid: **2, 4, 6, 8, 10, 12, 16**. Horizontal padding inside panes is **10px**.
Row vertical padding is **6px**. Gaps between inline elements are **6px**; between stacked
blocks inside a section, **8px**.

### Radius

| Token value | Use                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------ |
| `0`         | List rows, table rows, section headings, bands, panes. Anything that spans the pane width. |
| `4px`       | Small inline controls: JSON toggles, inline actions, chips, meters.                        |
| `6px`       | Buttons, inputs, selects, view switches, code blocks.                                      |
| `8px`       | Cards and warnings.                                                                        |
| `999px`     | Badges and status dots only.                                                               |

Define these as `--pm-radius-sm` (4px), `--pm-radius` (6px) and `--pm-radius-lg` (8px). Today
`--prosemirror-devtools-radius` is 7px; changing it to 6px is part of this guide.
Full-width elements are always square: a rounded shape inside a list reads as a floating chip.

### Elevation

The panel is flat. Separate regions with 1px `--pm-border` dividers. `--pm-shadow` is only for
cards in a grid (Snapshots, Context) and for popovers.

## Layout

### Panel shell

```
┌ brand · instance select ··························· theme ┐  header
│ State  Selection  Transactions 12  …  Context             │  tabs
├────────────────────────────────────────────────────────────┤
│ [Dispatch #11 · after] [Before | After] [Follow live]      │  inspection toolbar (optional)
├────────────────────────────────────────────────────────────┤
│ tab content                                               │
└────────────────────────────────────────────────────────────┘
```

- Tabs: body size, weight 650, `--pm-muted`; the selected tab is `--pm-text` with a 2px accent
  underline. Counts follow the label in caption mono `--pm-faint`.
- The inspection toolbar is shared. Tabs do not add their own toolbar row above it.

### Tab content patterns

Every tab uses one of three layouts:

1. **List and detail.** A resizable list on the left, the selected item on the right. Use
   `ResizableSplit`. Used by State, Selection, Transactions, Events, WebMCP.
2. **Sections.** A single scrolling pane of stacked [sections](#section). Used by Plugins,
   Rendering, Schema.
3. **Overview.** A chart or card grid with a detail area below. Used by Performance, Snapshots,
   Context.

Do not nest a list-and-detail split inside another split.

### Pane header

The header of a list pane. `pmPaneHeader`: sticky, 35px minimum height, `--pm-panel` background,
bottom border, 10px horizontal padding, 6px gap. Content order: section title, optional count
badge, spacer, actions (buttons, view switch). Filters wrap onto a second line inside the same
header.

### Section

A titled block inside a detail pane or a sections layout.

- Heading: `pmDetailHeading`, 32px minimum height, `--pm-panel-2` background, section title,
  then badges, then right-aligned actions. Square corners.
- Body: `--pm-panel` background, 10px padding, bottom border.
- Sections stack directly. No margin between them: the background must not show through as an
  empty strip.

### Note

Explanatory text that is not data. Caption size, `--pm-muted`.

- Inside a section body, a note is plain muted text with no band.
- A note that applies to a whole pane sits directly under the pane header as a single
  `--pm-panel-2` band.
- Never stack two bands (heading, note, heading, note). Merge the note into the section body.

### Warning

`pmWarning`: `--pm-yellow-soft` background, 8px radius, used only for a limitation the user must
act on or understand before trusting the data (for example missing instrumentation).

### Disclosure

`<details>` with a body-size summary in `--pm-muted`, a 6px chevron, and the same 10px
padding as section bodies. Never larger than body text.

### Empty state

One component for every empty pane or list: centered in the available area, caption-to-body
text in `--pm-muted`, one sentence saying what will appear and, if the user can do something,
one sentence or one button saying how. Use the same component for "loading", with the text
"Loading …".

## Components

### Button

All buttons use a panel class. A bare `<button>` is not allowed.

| Variant       | Class                                                    | Look                                                               |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Default       | `pmButton`                                               | 28px high, 6px radius, `--pm-panel`, 1px `--pm-border`, body text. |
| Primary       | `pmButton` + `data-variant="primary"`                    | Accent background, white text. One per view at most.               |
| Danger        | `pmButton` + `data-variant="danger"`                     | Red text and border. Only for destructive actions.                 |
| Icon          | `pmIconButton`                                           | 28px square, same border and radius. Needs `aria-label`.           |
| Inline action | `pmInlineAction` (new; generalizes `pmNodeSelectAction`) | 20px high, 4px radius, small text. Inside rows (Select, copy).     |

Hover: `--pm-panel-2`. Disabled: `--pm-faint` text, no hover.

### View switch

`pmViewSwitch` for two to four mutually exclusive views of the same data (Structure / HTML /
JSON, Before / After, Calls / Tools). Caption text, 22px high, 6px radius on the group, square
inner buttons. The pressed button uses `--pm-accent-soft` and `--pm-accent`. Use
`aria-pressed` on each button.

### List row

The single row style for every selectable list: document tree, dispatches, events, plugins,
WebMCP calls.

| State            | Style                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Rest             | `--pm-panel`, bottom border, square corners.                                                            |
| Hover            | `--pm-panel-2`.                                                                                         |
| Selected         | `--pm-accent-soft` background. The row title uses `--pm-accent`. **No left bar, no radius, no border.** |
| Focus (keyboard) | 2px `--pm-accent` outline inset by 2px (`outline-offset: -2px`).                                        |

- Mark selection with `aria-pressed="true"` on button rows, or `aria-selected="true"` in a
  listbox. Style both selectors the same way.
- A secondary marker (for example "contains the editor selection" in the document tree) uses a
  `--pm-blue` dot or badge in the row, not another background or bar.
- Layout: identifier (mono, muted), title and metadata stacked, then right-aligned outcome badge
  and duration.

### Badge

`pmBadge`: caption mono, weight 650, 18px high, `999px` radius, 1px border.

| Tone     | Meaning                                                             |
| -------- | ------------------------------------------------------------------- |
| `green`  | Available, passed, handled, recording.                              |
| `yellow` | Partial, expired, unobserved, inconclusive, pending.                |
| `red`    | Failed, error.                                                      |
| `blue`   | Editor-selection related values and kinds (`selection`, `History`). |
| neutral  | Counts, sizes, durations and neutral facts.                         |

Text rules: protocol and data values appear verbatim (`available`, `expired`, `doc`). UI states
use sentence case (`Returned`, `Recording`). Do not mix both in one badge.

### Table

`pmTable`: small text, header cells in section-title style, rows with bottom border, numbers
right-aligned. Tables scroll horizontally inside their section instead of truncating headers.

### JSON tree

`pmJson`: small mono text. Keys `--pm-blue`, strings `--pm-green`, numbers `--pm-yellow`,
booleans `--pm-accent`, null and summaries `--pm-faint`. Toggles and copy actions are inline actions.

## Host isolation

The panel resets every property it relies on for its own controls. Inside `.pm-devtools`:

```css
.pm-devtools :is(button, input, select, textarea) {
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  text-transform: none;
  letter-spacing: inherit;
  line-height: inherit;
}
```

Every component then sets its own radius, padding, border and background. Test the panel inside
a host that styles `button`, `input` and `select` globally. The standalone demo does this
(`packages/standalone-demo/src/style.css`), so any rounding or padding that appears there and not
in this guide is a leak.

## Accessibility

- Every interactive element is a native button, input, select or `<summary>`.
- Icon-only buttons have `aria-label`. Toggle rows and switches expose `aria-pressed`.
- Text contrast against its background is at least 4.5:1, including in the dark theme.
  `--pm-faint` is for non-essential text only.
- Focus is always visible with the accent outline; never remove it without a replacement.

## Writing

- Sentence case for labels, buttons and headings in source. Section titles are uppercased by CSS.
- Buttons start with a verb: "Clear", "Save current", "Inspect plugin".
- State the limitation, not an apology: "Historical plugin state requires a semantic serializer."
- Times use `toLocaleTimeString()`; durations use `formatMs`.

## Checklist for a new or changed panel

- [ ] Uses one of the three tab layouts.
- [ ] Every list uses the list row and its selected style.
- [ ] Every button has a panel class; no bare `<button>`.
- [ ] No text below 10px outside chart ticks; weights are 500, 650 or 700.
- [ ] Radii come from the radius scale; full-width elements are square.
- [ ] No stacked bands; notes sit inside section bodies.
- [ ] Empty and loading states use the empty-state component.
- [ ] No inline `style` for colors, sizes or spacing that a class can express.
- [ ] Checked in light and dark themes and inside the standalone demo.

## Audit (November 2026)

Deviations found by reviewing every tab in the standalone demo with captured data. Ordered by
impact.

| #   | Deviation                                                                                                                                                                                                   | Where                                                                                                           | Fix                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Selected rows look like rounded chips with a left bar: `inset 2px` accent shadow plus a 5px radius leaked from the host. The document tree uses background only, so selection looks different between tabs. | `.pm-list-row[aria-pressed="true"]`, `.pm-doc-row[data-inspected="true"]`, `.pm-doc-row[data-editor-selection]` | Apply the [list row](#list-row) states. Replace the blue left bar for the editor selection with a marker in the row. |
| 2   | Host styles leak into panel buttons. Every button without its own radius (list rows, view switches, JSON toggles, carets, inline actions) inherits the host's `border-radius: 5px`.                         | Global button reset in `panel.module.css`                                                                       | Add the [host isolation](#host-isolation) reset.                                                                     |
| 3   | Text below the minimum: 8.5px, 9px and 9.5px in 14 rules, including the view switch (9px) and chart summaries.                                                                                              | `panel.module.css`                                                                                              | Move to the 10px caption step; keep 9px only for chart ticks.                                                        |
| 4   | Stacked grey bands in Plugins, Rendering and Schema: pane note, heading, note, disclosure, each on `--pm-panel-2`, with empty strips of background between sections.                                        | Inspection read-out sections                                                                                    | Use the [section](#section) and [note](#note) rules: one heading band, note inside the body, no gaps.                |
| 5   | Disclosure summaries ("Coverage and read point", "Technical details", "Related evidence") are larger or smaller than body text and vary between tabs.                                                       | Inspection read-out, Context, dispatch inspector                                                                | Apply the [disclosure](#disclosure) rule.                                                                            |
| 6   | Radius values 2, 3, 4, 5, 6, 7, 8, 9 and 13px are used without a scale.                                                                                                                                     | 34 rules in `panel.module.css`                                                                                  | Map each to the [radius scale](#radius).                                                                             |
| 7   | Font weights 750 and 800 alongside 650 and 700.                                                                                                                                                             | Brand, section title, rank badges                                                                               | Use 650 or 700.                                                                                                      |
| 8   | Unclassed buttons: the Performance navigation arrow renders at 15px; view switch buttons rely on the parent selector.                                                                                       | Performance chart navigation, view switches                                                                     | Give each button a panel class.                                                                                      |
| 9   | Badge casing is mixed: `unhandled`, `Returned`, `Recording`, `History`.                                                                                                                                     | Events, WebMCP, Context, Transactions                                                                           | Apply the [badge](#badge) text rules.                                                                                |
| 10  | Empty and loading states differ: centered in Snapshots and Performance, a left-aligned note band in Events and WebMCP.                                                                                      | Several panels                                                                                                  | Use one empty-state component.                                                                                       |
| 11  | Context is the only tab with a 15px page heading and card summaries.                                                                                                                                        | Context                                                                                                         | Use the title step (13px). Cards are allowed for the overview layout.                                                |
| 12  | 44 inline `style={{}}` objects set spacing, grids and colors in components.                                                                                                                                 | `features/**`, `ui/**`                                                                                          | Move recurring ones to classes; keep inline styles only for computed values.                                         |
| 13  | Truncated content: dispatch rows cut "1 steps" to "1 ste…"; the ancestors table cuts header labels.                                                                                                         | Transactions list, Selection ancestors                                                                          | Give metadata priority over badges in narrow rows; let tables scroll.                                                |
