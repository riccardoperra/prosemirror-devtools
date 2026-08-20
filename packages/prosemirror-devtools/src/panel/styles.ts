import panelStyles from "./panel.module.css";

const STYLE_ID = "prosemirror-devtools-panel-styles";

export { panelStyles };

export function cx(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

function panelCssText(source: Document): string {
  const marker = `.${panelStyles.pmDevtools}`;
  const rules: string[] = [];

  for (const sheet of source.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.cssText.includes(marker)) rules.push(rule.cssText);
      }
    } catch {
      // Cross-origin stylesheets cannot expose cssRules. The local package
      // stylesheet remains readable in normal bundler and dev-server output.
    }
  }

  if (rules.length > 0) return rules.join("\n");

  for (const style of source.querySelectorAll("style")) {
    if (style.textContent?.includes(marker)) return style.textContent;
  }

  return "";
}

/** Copies the compiled module stylesheet into a popup or picture-in-picture document. */
export function ensurePanelStyles(target: Document = document): void {
  const source = typeof document === "undefined" ? target : document;
  if (target === source || target.getElementById(STYLE_ID)) return;

  const cssText = panelCssText(source);
  if (!cssText) return;

  const style = target.createElement("style");
  style.id = STYLE_ID;
  style.textContent = cssText;
  target.head.append(style);
}
