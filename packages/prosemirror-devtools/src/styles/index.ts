/**
 * Stable CSS custom properties inherited by built-in and extension panels.
 *
 * Override them through `ProseMirrorDevtoolsPanel`'s `style` prop, or consume
 * them from any descendant mounted through the extension API.
 */
export const proseMirrorDevtoolsCssVariables = {
  background: "--prosemirror-devtools-background",
  surface: "--prosemirror-devtools-surface",
  surfaceSubtle: "--prosemirror-devtools-surface-subtle",
  border: "--prosemirror-devtools-border",
  borderStrong: "--prosemirror-devtools-border-strong",
  text: "--prosemirror-devtools-text",
  textMuted: "--prosemirror-devtools-text-muted",
  textFaint: "--prosemirror-devtools-text-faint",
  accent: "--prosemirror-devtools-accent",
  accentSoft: "--prosemirror-devtools-accent-soft",
  success: "--prosemirror-devtools-success",
  successSoft: "--prosemirror-devtools-success-soft",
  warning: "--prosemirror-devtools-warning",
  warningSoft: "--prosemirror-devtools-warning-soft",
  danger: "--prosemirror-devtools-danger",
  dangerSoft: "--prosemirror-devtools-danger-soft",
  info: "--prosemirror-devtools-info",
  infoSoft: "--prosemirror-devtools-info-soft",
  shadow: "--prosemirror-devtools-shadow",
  fontFamily: "--prosemirror-devtools-font-family",
  fontSize: "--prosemirror-devtools-font-size",
  lineHeight: "--prosemirror-devtools-line-height",
  radius: "--prosemirror-devtools-radius",
} as const;

export type ProseMirrorDevtoolsCssVariable =
  (typeof proseMirrorDevtoolsCssVariables)[keyof typeof proseMirrorDevtoolsCssVariables];
