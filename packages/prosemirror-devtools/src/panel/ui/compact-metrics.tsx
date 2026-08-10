import type { ReactElement } from "react";

export interface CompactMetric {
  label: string;
  value: string;
  detail?: string;
}

export function CompactMetrics({
  label,
  metrics,
}: {
  label: string;
  metrics: readonly CompactMetric[];
}): ReactElement {
  return (
    <section aria-label={label} className="pm-compact-metrics">
      {metrics.map((metric) => (
        <div className="pm-compact-metric" key={metric.label}>
          <i aria-hidden="true" className="pm-status-dot" />
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          {metric.detail ? <small title={metric.detail}>{metric.detail}</small> : null}
        </div>
      ))}
    </section>
  );
}
