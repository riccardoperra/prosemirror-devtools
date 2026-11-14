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

- **10px is the minimum.** Text inside a chart (axis ticks, frame-budget label, timeline sequence
  numbers) may use 9px. The decorative, `aria-hidden` brand mark is exempt. No other text goes
  below 10px.
- Weights are 500, 650 and 700. Do not introduce 600, 750 or 800.
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

Use the tokens `--pm-radius-sm` (4px), `--pm-radius` (6px, from the public
`--prosemirror-devtools-radius`) and `--pm-radius-lg` (8px), never a literal value. Chart marks
(legend swatches, the dot inside a plugin hook chip) may use 1–2px.
Full-width elements are always square: a rounded shape inside a list reads as a floating chip.

### Elevation

The panel is flat. Separate regions with 1px `--pm-border` dividers. `--pm-shadow` is only for
cards in a grid (Snapshots, Context) and for popovers.

## Layout

### Panel shell

```
┌ brand · instance select ··························· theme ┐  header
│ Document  Timeline 12  Snapshots  Performance 12  …       │  section tabs
├────────────────────────────────────────────────────────────┤
│ State  Selection  Schema                                   │  view tabs (only for a section with 2+ views)
├────────────────────────────────────────────────────────────┤
│ [Dispatch #11 · after] [Before | After] [Follow live]      │  inspection toolbar (optional)
├────────────────────────────────────────────────────────────┤
│ view content                                              │
└────────────────────────────────────────────────────────────┘
```

- Section tabs: `pmTabs` and `pmTab`. Body size, weight 650, `--pm-muted`, 35px minimum height;
  the selected tab is `--pm-text` with a 2px accent underline. Counts follow the label in caption
  mono `--pm-faint`, and only on section tabs.
- View tabs: the same classes plus `pmSubTabs` on the list and `pmSubTab` on each tab. A top
  border, 30px minimum height and weight 500; rest, hover and selected states match the section
  tabs. The row appears only when the active section has more than one view. Do not add a third
  row or another tab style; a view that needs its own modes uses a [view switch](#view-switch).
- Selecting a section opens the view last used in it during the session, otherwise its first view.
  The active section always follows the active view.
- The inspection toolbar is shared. Views do not add their own toolbar row above it.

### Sections

Navigation, `defaultPanel`, `activePanel` and `onActivePanelChange` use view (panel) IDs. Sections
are a navigation layer defined in `BUILTIN_PANEL_GROUPS` in `panel-registry.ts`. Every built-in
view belongs to exactly one section, and view titles stay as listed.

| Section     | Views                           |
| ----------- | ------------------------------- |
| Document    | State, Selection, Schema        |
| Timeline    | Transactions, Events            |
| Snapshots   | Snapshots                       |
| Performance | Performance                     |
| Plugins     | Plugins, Rendering              |
| Context     | Context                         |
| Extensions  | One section per extension panel |

Extension sections sort among the built-in sections by the panel's `order`. Add a new built-in
view to the section whose question it answers before you add a section.

### Tab content patterns

Every view uses one of three layouts:

1. **List and detail.** A resizable list on the left, the selected item on the right. Use
   `ResizableSplit`. Used by State, Selection, Transactions, Events, WebMCP. The list opens at
   40% of the container width, clamped so the list keeps at least 180px and the detail at least
   240px, and follows the container while it resizes. Once the user drags the divider or uses
   the arrow, Home or End keys, the split keeps the user's width (still clamped). In narrow
   container layouts the panes stack and the divider is hidden.
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

- Container: `pmSection` (`<section>` with an `aria-label`): `--pm-panel` background and a bottom
  border.
- Heading: `pmDetailHeading`, 32px minimum height, `--pm-panel-2` background, section title,
  then badges, then right-aligned actions. Square corners.
- Body: content directly inside the section, on the `--pm-panel` background. Use
  `pmSectionBody` (8px 10px padding, 4px gap) for text and stacked rows; consecutive bodies are
  separated by a border. Use `pmCode` for monospace payloads such as tool input and output.
- Sections stack directly. No margin between them: the background must not show through as an
  empty strip.

### Note

Explanatory text that is not data. Caption size, `--pm-muted`.

- Inside a section body, a note is plain muted text with no band: `pmSectionNote`.
- A note that applies to a whole pane sits directly under the pane header as a single
  `--pm-panel-2` band.
- Never stack two bands (heading, note, heading, note). Merge the note into the section body.

### Warning

`pmWarning`: `--pm-yellow-soft` background, 8px radius, used only for a limitation the user must
act on or understand before trusting the data (for example missing instrumentation).

### Disclosure

`pmDisclosure` on `<details>`: a body-size summary in `--pm-muted` on `--pm-panel`, a 6px
chevron, 10px horizontal padding, a top border, and `--pm-panel-2` only on hover. Never larger
than body text. Tab-specific classes may add layout for the disclosed content, not a different
summary style.

### Empty state

One component for every empty pane or list: centered in the available area, caption-to-body
text in `--pm-muted`, one sentence saying what will appear and, if the user can do something,
one sentence or one button saying how. Use the same component for "loading", with the text
"Loading …".

The component is `EmptyState` in `ui/empty-state.tsx` (classes `pmEmptyState*`). Pass the
sentence as children, an optional second sentence as `detail` and an optional single `action`.
Pass `role="status"` for loading and other transient states. It fills its pane when it is the
only child, and the remaining space below a pane header or note otherwise. The "No ProseMirror
instances" screen (`NoInstancesState`) is built on it. Short facts inside a section body (for
example "No dispatch observed.") stay section notes.

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

A control with a specific look in one feature gets its own class instead of a parent selector
such as `.group > button`: for example `pmStepButton` (previous and next dispatch in Performance)
and `pmFastPluginToggle`.

### View switch

The `ViewSwitch` component (`ui/view-switch.tsx`) for two to four mutually exclusive views of
the same data (Boxes / Structure / JSON / DOM, Before / After, Calls / Tools). Do not hand-write
the markup. It renders a labelled `role="group"` with `pmViewSwitch` and one `pmViewSwitchOption`
button per view with `aria-pressed`. Caption text, 22px high, 6px radius on the group, square
inner buttons. The pressed button uses `--pm-accent-soft` and `--pm-accent`. Button nodes stay
stable when labels change (for example counts), so focus is not lost.

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

### Document diagrams

The Boxes and DOM views draw the document, so they encode data that list rows do not.

- A box or chip has a 1px `--pm-border` border and the 4px radius. A start border carries the
  node type color: 3px on a box, 2px on a chip. Boxes and the DOM view's node badges use the same
  hue.
- Marks are amber (`--pm-yellow` on `--pm-yellow-soft`) in both views. Widgets are green. Elements
  outside the document are muted with a dashed border.
- The inspected box or chip uses an `--pm-accent` border on `--pm-accent-soft`. Rows inside the
  DOM view are list rows and follow the list row states.

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

### Field list

`pmFields` on a `<dl>`: one fact per line, a mono label column in `--pm-muted` and the value
beside it. Use it for a handful of named values (a selection, a resolved position, a
transaction) instead of a JSON tree or a one-row table. Values can mix text, badges and node
chips. Keep raw JSON available behind a disclosure, not as the main view.

### Step summary

Transactions read as words before JSON: `insert "x" at 92`, `split paragraph at 3`,
`add mark strong 66–78`, `cursor 92 → cursor 93`. `summarize-dispatch.ts` derives them from the
recorded steps, replaying them on the document before the dispatch. `StepLine` renders the action
(weight 650), the subject (mono) and the position (mono, `--pm-muted`) inline, so list rows can
truncate them with an ellipsis.

Document changes use the folded diff in `document-diff.ts`: unchanged siblings collapse into one
`⋯ N unchanged` line, a changed node opens down to the fields that differ (`"text"`, `"attrs"`,
`"marks"`), and added or removed nodes take one `+`/`−` line each. Changed siblings are aligned
by similarity (a weighted longest common subsequence), so an inserted node is not paired with
the next edited one, and a field change marks only the characters that differ. Show a diff, not the two full
documents; the Document tab already shows either document through the Before/After toggle.

Timeline answers "what happened and why"; Performance answers "what it cost". Timeline shows a
dispatch's total duration only, and links to Performance for phases and plugin cost.

### Table

`pmTable`: small text, header cells in section-title style, rows with bottom border, numbers
right-aligned. Tables scroll horizontally inside their section instead of truncating headers.

### JSON tree

`pmJson`: small mono text. Keys `--pm-blue`, strings `--pm-green`, numbers `--pm-yellow`,
booleans `--pm-accent`, null and summaries `--pm-faint`. Toggles and copy actions are inline actions.

## Host isolation

The panel resets every property it relies on for its own controls and containers. Inside
`.pm-devtools`:

```css
.pm-devtools :where(button, input, select, textarea) {
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  text-transform: none;
  letter-spacing: inherit;
  line-height: inherit;
}
.pm-devtools :where(section, article, aside, nav, header, footer, main) {
  margin: 0;
}
```

`:where()` keeps the specificity of a single class, so the reset beats host element selectors
such as `button {}` while component classes, declared later, still win. Host rules that are more
specific than one class (for example `.app button`) can still leak; components must set every
property they depend on. Every component then sets its own radius, padding, border and
background. Global panel defaults for controls (such as `font: inherit`) also use
`.pm-devtools :where(...)`: a selector like `.pm-devtools button` outranks every single-class
component rule and silently discards its font or color. This includes `<pre>` blocks: hosts commonly style `pre` globally, so `pmCode` sets
its own background, border and padding. Test the panel inside
a host that styles `button`, `input` and `select` globally. The standalone demo does this
(`examples/standalone/src/style.css`), so any rounding or padding that appears there and not
in this guide is a leak.

## Accessibility

- Every interactive element is a native button, input, select or `<summary>`.
- Icon-only buttons have `aria-label`. Toggle rows and switches expose `aria-pressed`.
- Section tabs form a tablist labelled "Inspector sections"; view tabs form a tablist labelled
  "<Section> views". Arrow keys, Home and End move within each list. The tab panel is labelled by
  the active view tab; a single-view section tab is that view's tab.
- Text contrast against its background is at least 4.5:1, including in the dark theme.
  `--pm-faint` is for non-essential text only.
- Focus is always visible with the accent outline; never remove it without a replacement.

## Writing

- Sentence case for labels, buttons and headings in source. Section titles are uppercased by CSS.
- Buttons start with a verb: "Clear", "Save current", "Inspect plugin".
- State the limitation, not an apology: "Historical plugin state requires a semantic serializer."
- Times use `toLocaleTimeString()`; durations use `formatMs`.

## Checklist for a new or changed panel

- [ ] Belongs to one section; uses one of the three tab layouts.
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

| #   | Deviation                                                                                                                                                                                                   | Where                                                                                                           | Fix                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Selected rows look like rounded chips with a left bar: `inset 2px` accent shadow plus a 5px radius leaked from the host. The document tree uses background only, so selection looks different between tabs. | `.pm-list-row[aria-pressed="true"]`, `.pm-doc-row[data-inspected="true"]`, `.pm-doc-row[data-editor-selection]` | Apply the [list row](#list-row) states. Replace the blue left bar for the editor selection with a marker in the row. **Fixed:** square rows, background only; the existing selection badge marks the editor selection. |
| 2   | Host styles leak into panel buttons. Every button without its own radius (list rows, view switches, JSON toggles, carets, inline actions) inherits the host's `border-radius: 5px`.                         | Global button reset in `panel.module.css`                                                                       | Add the [host isolation](#host-isolation) reset. **Fixed.**                                                                                                                                                            |
| 3   | Text below the minimum: 8, 8.5, 9 and 9.5px in 26 rules (`font-size` and `font` shorthands), including the view switch (9px) and chart summaries.                                                           | `panel.module.css`                                                                                              | Move to the 10px caption step; keep 9px only for chart ticks. **Fixed:** 10px everywhere except the chart and brand exceptions.                                                                                        |
| 4   | Stacked grey bands in Plugins, Rendering and Schema: pane note, heading, note, disclosure, each on `--pm-panel-2`, with empty strips of background between sections.                                        | Inspection read-out sections                                                                                    | Use the [section](#section) and [note](#note) rules: one heading band, note inside the body, no gaps. **Fixed:** `pmSection` and `pmSectionNote`; host `section` margins reset.                                        |
| 5   | Disclosure summaries ("Coverage and read point", "Technical details", "Related evidence") are larger or smaller than body text and vary between tabs.                                                       | Inspection read-out, Context, dispatch inspector                                                                | Apply the [disclosure](#disclosure) rule. **Fixed:** one `pmDisclosure`, also used by Related evidence and Raw effect samples.                                                                                         |
| 6   | Radius values 2, 3, 4, 5, 6, 7, 8, 9 and 13px are used without a scale.                                                                                                                                     | 34 rules in `panel.module.css`                                                                                  | Map each to the [radius scale](#radius). **Fixed:** radius tokens everywhere; base radius 6px; 1–2px only for chart marks.                                                                                             |
| 7   | Font weights 750 and 800 alongside 650 and 700.                                                                                                                                                             | Brand, section title, rank badges                                                                               | Use 650 or 700. **Fixed:** 750, 800 and 600 replaced by 650 or 700; section titles use 700 and `0.06em`.                                                                                                               |
| 8   | Unclassed buttons: the Performance navigation arrow renders at 15px; view switch buttons rely on the parent selector.                                                                                       | Performance chart navigation, view switches                                                                     | Give each button a panel class. **Fixed:** `ViewSwitch` replaces eight hand-written switches; `pmStepButton` and `pmFastPluginToggle`.                                                                                 |
| 9   | Badge casing is mixed: `unhandled`, `Returned`, `Recording`, `History`.                                                                                                                                     | Events, WebMCP, Context, Transactions                                                                           | Apply the [badge](#badge) text rules. **Fixed:** event statuses and coverage badges use sentence case; data values stay verbatim.                                                                                      |
| 10  | Empty and loading states differ: centered in Snapshots and Performance, a left-aligned note band in Events and WebMCP.                                                                                      | Several panels                                                                                                  | Use one empty-state component. **Fixed:** `EmptyState` for every empty list, pane and loading state.                                                                                                                   |
| 11  | Context is the only tab with a 15px page heading and card summaries.                                                                                                                                        | Context                                                                                                         | Use the title step (13px). Cards are allowed for the overview layout. **Fixed:** 13px, weight 650.                                                                                                                     |
| 12  | 44 inline `style={{}}` objects set spacing, grids and colors in components.                                                                                                                                 | `features/**`, `ui/**`                                                                                          | Move recurring ones to classes; keep inline styles only for computed values. **Fixed:** remaining inline styles set widths, positions, depth or CSS variables.                                                         |
| 13  | Truncated content: dispatch rows cut "1 steps" to "1 ste…"; the ancestors table cuts header labels.                                                                                                         | Transactions list, Selection ancestors                                                                          | Give metadata priority over badges in narrow rows; let tables scroll. **Fixed:** badges wrap below the metadata; `pmTableScroll` wraps the ancestors table.                                                            |
