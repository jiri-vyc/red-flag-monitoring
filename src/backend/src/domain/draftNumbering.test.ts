import { findNextPolicyCode, findNextRuleNumber } from "./draftNumbering";

describe("findNextPolicyCode", () => {
  it("continues after the highest policy number", () => {
    expect(findNextPolicyCode(["SVZ-03", "SVZ-06", "AMLZ-SVZ-1-abc123"])).toBe("SVZ-07");
  });

  it("starts at SVZ-01 without existing policies", () => {
    expect(findNextPolicyCode([])).toBe("SVZ-01");
  });
});

describe("findNextRuleNumber", () => {
  it("continues after the highest rule number, including suffixed codes", () => {
    expect(findNextRuleNumber(["R-01", "R-17", "R-14-abc123", "SVZ-06-R1-x"])).toBe(18);
  });

  it("starts at 1 without existing rules", () => {
    expect(findNextRuleNumber([])).toBe(1);
  });
});
