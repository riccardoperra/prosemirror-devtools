const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
});

export function formatMs(value: number | null): string {
  if (value == null) return "—";
  if (value < 0.01) return "<0.01 ms";
  if (value < 10) return `${value.toFixed(2)} ms`;
  return `${value.toFixed(1)} ms`;
}

export function formatTime(timestamp: number): string {
  return timeFormatter.format(timestamp);
}
