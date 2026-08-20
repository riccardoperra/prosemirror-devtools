import { For, Show, type JSX } from "solid-js";

export interface CompactMetric {
  label: string;
  value: string;
  detail?: string;
}

export function CompactMetrics(props: {
  label: string;
  metrics: readonly CompactMetric[];
}): JSX.Element {
  return (
    <section aria-label={props.label} class="pm-compact-metrics">
      <For each={props.metrics}>
        {(metric) => (
          <div class="pm-compact-metric">
            <i aria-hidden="true" class="pm-status-dot" />
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <Show when={metric.detail}>
              {(detail) => <small title={detail()}>{detail()}</small>}
            </Show>
          </div>
        )}
      </For>
    </section>
  );
}
