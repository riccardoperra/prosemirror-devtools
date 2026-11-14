const showcase = process.env.VITE_SHOWCASE === "true";

/**
 * The GitHub Pages showcase is a production build with the inspector on. Ordinary builds only get
 * the flag as a literal, so the bundler drops diagnostics code. Showcase builds also resolve each
 * listed inspector entry to its production twin, because the default entries render nothing
 * outside development.
 */
export function showcaseConfig(entries: readonly string[] = []) {
  return {
    define: { "import.meta.env.VITE_SHOWCASE": JSON.stringify(String(showcase)) },
    resolve: {
      alias: showcase
        ? entries.map((entry) => ({
            find: new RegExp(`^prosemirror-inspector/${entry}$`),
            replacement: `prosemirror-inspector/${entry}/production`,
          }))
        : [],
    },
  };
}
