import { buildCoverageMatrix } from "./coverageMatrix";

describe("buildCoverageMatrix", () => {
  it("leaves Z9 and Z11 uncovered with the sample rules", () => {
    const sampleRuleCodes = Array.from(
      { length: 17 },
      (_, index) => `R-${String(index + 1).padStart(2, "0")}`,
    );
    const uncovered = buildCoverageMatrix(sampleRuleCodes)
      .filter((row) => row.ruleCodes.length === 0)
      .map((row) => row.indicator);

    expect(uncovered).toEqual(["Z9", "Z10", "Z11", "Z12"]);
  });

  it("drops a rule that is not in the reviewed rule set", () => {
    const z4 = buildCoverageMatrix(["R-01", "R-05"]).find((row) => row.indicator === "Z4");

    expect(z4?.ruleCodes).toEqual([]);
  });
});
