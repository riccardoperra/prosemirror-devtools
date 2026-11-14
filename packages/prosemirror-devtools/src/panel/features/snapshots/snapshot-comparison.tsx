import { For, Show, type JSX } from "solid-js";

import type { compareSnapshots } from "../../../core/snapshots";
import { panelStyles } from "../../styles";
import { EmptyState } from "../../ui/empty-state";

function differenceText(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  return text.length > 2_000 ? `${text.slice(0, 2_000)}\n… value truncated` : text;
}

export function SnapshotComparison(props: {
  comparison: ReturnType<typeof compareSnapshots>;
  label: string;
}): JSX.Element {
  return (
    <section aria-label={props.label}>
      <Show
        when={props.comparison.differences.length > 0}
        fallback={<EmptyState>Document, root attributes, and selection are identical.</EmptyState>}
      >
        <table class={panelStyles.pmTable} aria-label={props.label}>
          <thead>
            <tr>
              <th scope="col">Path</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.comparison.differences}>
              {(difference) => (
                <tr>
                  <th scope="row">
                    <code>{difference.path}</code> <span>{difference.kind}</span>
                  </th>
                  <td>
                    <pre class={panelStyles.pmPreWrap}>
                      {difference.kind === "added" ? "Absent" : differenceText(difference.before)}
                    </pre>
                  </td>
                  <td>
                    <pre class={panelStyles.pmPreWrap}>
                      {difference.kind === "removed" ? "Absent" : differenceText(difference.after)}
                    </pre>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
      <Show when={props.comparison.truncated}>
        <p role="status" class={panelStyles.pmWarning}>
          Comparison is limited to the first 200 differences.
        </p>
      </Show>
    </section>
  );
}
