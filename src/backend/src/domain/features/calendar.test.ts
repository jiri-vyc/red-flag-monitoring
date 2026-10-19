import { calculateFullMonthsBetween, toIsoWeekKey } from "./calendar";
import { at } from "./testing/featureTestData";

describe("toIsoWeekKey", () => {
  it.each([
    ["2026-07-01", "2026-W27"],
    ["2026-06-29", "2026-W27"],
    ["2026-06-28", "2026-W26"],
    ["2027-01-01", "2026-W53"],
    ["2025-12-29", "2026-W01"],
  ])("puts %s into %s", (date, expectedWeek) => {
    expect(toIsoWeekKey(at(date))).toBe(expectedWeek);
  });
});

describe("calculateFullMonthsBetween", () => {
  it.each([
    ["2026-01-01", "2026-07-01", 6],
    ["2026-01-02", "2026-07-01", 5],
    ["2025-12-31", "2026-07-01", 6],
    ["2026-01-31", "2026-07-30", 5],
    ["2026-07-15", "2026-07-15", 0],
  ])("counts whole months from %s to %s as %i", (from, to, expectedMonths) => {
    expect(calculateFullMonthsBetween(from, to)).toBe(expectedMonths);
  });
});
