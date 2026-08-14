import { describe, expect, it } from "vitest";
import { nextOccurrences, recurrenceKey, zonedDate } from "./campaign-task-recurrence.js";

describe("campaign task recurring scheduler", () => {
  it("calculates deterministic daily occurrences in a timezone", () => {
    const values = nextOccurrences({ cadence: "daily", interval: 2, weekdays: [], localTime: "09:00", timezone: "Africa/Algiers", startDate: "2026-07-24" }, new Date("2026-07-24T00:00:00Z"), 3);
    expect(values.map((value) => value.toISOString())).toEqual(["2026-07-24T08:00:00.000Z", "2026-07-26T08:00:00.000Z", "2026-07-28T08:00:00.000Z"]);
    expect(recurrenceKey("task", values[0]!, "Africa/Algiers")).toBe(recurrenceKey("task", values[0]!, "Africa/Algiers"));
  });
  it("calculates weekly weekdays and respects end date", () => {
    const values = nextOccurrences({ cadence: "weekly", interval: 1, weekdays: [1, 3], localTime: "10:30", timezone: "UTC", startDate: "2026-07-20", endDate: "2026-07-27" }, new Date("2026-07-20T00:00:00Z"), 10);
    expect(values.map((value) => value.toISOString())).toEqual(["2026-07-20T10:30:00.000Z", "2026-07-22T10:30:00.000Z", "2026-07-27T10:30:00.000Z"]);
  });
  it("handles daylight-saving offsets deterministically", () => {
    expect(zonedDate("2026-01-15", "09:00", "America/Chicago").toISOString()).toBe("2026-01-15T15:00:00.000Z");
    expect(zonedDate("2026-07-15", "09:00", "America/Chicago").toISOString()).toBe("2026-07-15T14:00:00.000Z");
  });
  it("produces different recurrence keys for different timezones", () => {
    const date = new Date("2026-07-24T08:00:00.000Z");
    expect(recurrenceKey("task", date, "Africa/Algiers")).not.toBe(recurrenceKey("task", date, "UTC"));
  });
  it("rejects invalid IANA timezones", () => {
    expect(() => zonedDate("2026-07-24", "09:00", "Mars/Phobos")).toThrow();
    expect(() => nextOccurrences({ cadence: "daily", interval: 1, weekdays: [], localTime: "09:00", timezone: "Mars/Phobos" }, new Date(), 1)).toThrow();
  });
});
