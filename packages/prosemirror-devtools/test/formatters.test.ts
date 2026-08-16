import { formatDateTime, formatTime } from "../src/panel/formatters";
import { describe, expect, it } from "vitest";

const timestamp = Date.UTC(2026, 7, 16, 10, 47, 36, 106);

describe("panel timestamp formatters", () => {
  it("uses the browser locale and a compact 24-hour clock for history rows", () => {
    expect(formatTime(timestamp)).toBe(
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
        hourCycle: "h23",
      }).format(timestamp),
    );
  });

  it("provides the browser-local date and time for timestamp tooltips", () => {
    expect(formatDateTime(timestamp)).toBe(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(timestamp),
    );
  });
});
