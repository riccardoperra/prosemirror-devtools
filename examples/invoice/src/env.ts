/** Diagnostics run in development and in the GitHub Pages showcase, which is a production build. */
export const devtoolsEnabled = import.meta.env.DEV || import.meta.env.VITE_SHOWCASE === "true";

/**
 * The bundler only drops a dynamic import whose condition it can fold in the same module, so the
 * loader lives next to the flag and ordinary production builds emit no devtools chunk at all.
 */
export const loadDevtoolsShell = devtoolsEnabled ? () => import("./devtools/shell") : null;
