export type ProseMirrorDevtoolsTab =
  | "state"
  | "selection"
  | "decorations"
  | "events"
  | "history"
  | "performance"
  | "plugins"
  | "schema"
  | "snapshots"
  | "inspection-context";

/** Experimental panel features. These views are experimental and may change in any release. */
export const EXPERIMENTAL_FEATURES = ["document-boxes", "rendered-dom", "node-picker"] as const;

export type ExperimentalFeature = (typeof EXPERIMENTAL_FEATURES)[number];

/**
 * Opts into experimental panel features: `true` enables all of them, a list enables only those.
 * Experimental views may change or be removed in any release.
 */
export type ExperimentalFeatures = boolean | readonly ExperimentalFeature[];

export function resolveExperimentalFeatures(
  option: ExperimentalFeatures | undefined,
): ReadonlySet<ExperimentalFeature> {
  if (option === true) return new Set(EXPERIMENTAL_FEATURES);
  if (!option) return new Set();
  return new Set(option.filter((feature) => EXPERIMENTAL_FEATURES.includes(feature)));
}
