import {
  addCalendarDays,
  addWorkingDays,
  computeFauReportDeadlines,
  DEADLINE_WARNING_MS,
} from "./fauReportDeadlines";

const HOUR_MS = 60 * 60 * 1000;
// Mid-day UTC, so the local weekday is the same in every European time zone the tests may run in.
const WEDNESDAY = "2026-10-14T10:00:00.000Z";
const THURSDAY = "2026-10-15T10:00:00.000Z";
const FRIDAY = "2026-10-16T10:00:00.000Z";
const SATURDAY = "2026-10-17T10:00:00.000Z";

const toIso = (date: Date) => date.toISOString();

describe("addWorkingDays", () => {
  it("counts weekdays only", () => {
    expect(toIso(addWorkingDays(new Date(WEDNESDAY), 2))).toBe("2026-10-16T10:00:00.000Z");
  });

  it("skips the weekend: Friday + 2 working days is Tuesday", () => {
    expect(toIso(addWorkingDays(new Date(FRIDAY), 2))).toBe("2026-10-20T10:00:00.000Z");
  });

  it("starts counting on Monday when the start is on a weekend", () => {
    expect(toIso(addWorkingDays(new Date(SATURDAY), 2))).toBe("2026-10-20T10:00:00.000Z");
  });

  it("treats a public holiday as a working day (no holiday calendar)", () => {
    // 28 October is a Czech public holiday; it still counts.
    expect(toIso(addWorkingDays(new Date("2026-10-27T10:00:00.000Z"), 1))).toBe("2026-10-28T10:00:00.000Z");
  });
});

describe("addCalendarDays", () => {
  it("includes weekends", () => {
    expect(toIso(addCalendarDays(new Date(FRIDAY), 5))).toBe("2026-10-21T10:00:00.000Z");
  });
});

describe("computeFauReportDeadlines", () => {
  it("counts the internal limit from the conclusion and the maximum from the alert", () => {
    const deadlines = computeFauReportDeadlines({
      alertRaisedAt: WEDNESDAY,
      suspicionConcludedAt: THURSDAY,
      submittedAt: null,
      nowMs: Date.parse(THURSDAY) + HOUR_MS,
    });

    expect(deadlines.elapsedSinceAlertMs).toBe(25 * HOUR_MS);
    expect(deadlines.elapsedSinceConclusionMs).toBe(HOUR_MS);
    expect(deadlines.internal).toMatchObject({ dueAt: "2026-10-19T10:00:00.000Z", state: "on_track" });
    expect(deadlines.maximum).toMatchObject({ dueAt: "2026-10-19T10:00:00.000Z", state: "on_track" });
  });

  it("warns within the last day and flags an overdue deadline", () => {
    const internalDueMs = Date.parse("2026-10-16T10:00:00.000Z");
    const compute = (nowMs: number) =>
      computeFauReportDeadlines({
        alertRaisedAt: WEDNESDAY,
        suspicionConcludedAt: WEDNESDAY,
        submittedAt: null,
        nowMs,
      }).internal.state;

    expect(compute(internalDueMs - DEADLINE_WARNING_MS - 1)).toBe("on_track");
    expect(compute(internalDueMs - DEADLINE_WARNING_MS)).toBe("approaching");
    expect(compute(internalDueMs + 1)).toBe("overdue");
  });

  it("stops the clock at submission and tells whether the deadline was met", () => {
    const deadlines = computeFauReportDeadlines({
      alertRaisedAt: WEDNESDAY,
      suspicionConcludedAt: WEDNESDAY,
      submittedAt: "2026-10-17T10:00:00.000Z",
      nowMs: Date.parse("2026-11-30T10:00:00.000Z"),
    });

    expect(deadlines.elapsedSinceAlertMs).toBe(72 * HOUR_MS);
    expect(deadlines.internal.state).toBe("missed");
    expect(deadlines.maximum.state).toBe("met");
  });
});
