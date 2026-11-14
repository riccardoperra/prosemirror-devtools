/** Diagnostics run in development and in the GitHub Pages showcase, which is a production build. */
export const devtoolsEnabled = import.meta.env.DEV || import.meta.env.VITE_SHOWCASE === "true";
