import { formatApproximateDuration, formatDuration } from "./format";

describe("formatDuration", () => {
  it.each([
    [0, "0 s"],
    [8000, "8 s"],
    [60_000, "1 min"],
    [253_000, "4 min 13 s"],
    [3_900_000, "1 h 5 min"],
  ])("formats %d ms as %s", (milliseconds, expected) => {
    expect(formatDuration(milliseconds)).toBe(expected);
  });
});

describe("formatApproximateDuration", () => {
  it.each([
    [200, "1 s"],
    [42_400, "42 s"],
    [61_000, "1 min"],
    [63_600, "1 min 5 s"],
    [258_600, "4 min 20 s"],
    [754_000, "13 min"],
  ])("rounds %d ms to %s", (milliseconds, expected) => {
    expect(formatApproximateDuration(milliseconds)).toBe(expected);
  });
});
