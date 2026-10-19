import { calculateBaseScore } from "./rulePriority";

describe("calculateBaseScore", () => {
  it("maps a priority base onto the scores at or above the hit threshold", () => {
    expect(calculateBaseScore(0)).toBe(50);
    expect(calculateBaseScore(40)).toBe(70);
    expect(calculateBaseScore(100)).toBe(100);
  });

  it("rounds odd priorities", () => {
    expect(calculateBaseScore(15)).toBe(58);
  });

  it("clamps priorities outside 0–100", () => {
    expect(calculateBaseScore(-10)).toBe(50);
    expect(calculateBaseScore(140)).toBe(100);
  });
});
