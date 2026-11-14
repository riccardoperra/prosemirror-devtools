---
"prosemirror-inspector": patch
---

Panel styles follow the design guide's tokens. Radii use a 4 / 6 / 8px scale, and the default `--prosemirror-devtools-radius` changes from 7px to 6px. Font weights are 500, 650 or 700. View switches share one `ViewSwitch` component, every button has its own class, and component font and color rules on buttons now apply instead of being overridden by a global `font: inherit` (for example tab labels use their 650 weight). Event status and coverage badges use sentence case.
