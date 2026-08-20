import { For, Show, type JSX } from "solid-js";

import { panelStyles } from "../styles";

export interface CompactMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface CompactMetricsProps {
  label: string;
  metrics: readonly CompactMetric[];
}

export function CompactMetrics(props: CompactMetricsProps): JSX.Element {
  return (
    <section aria-label={props.label} class={panelStyles.pmCompactMetrics}>
      <For each={props.metrics}>
        {(metric) => (
          <div class={panelStyles.pmCompactMetric}>
            <i aria-hidden="true" class={panelStyles.pmStatusDot} />
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
