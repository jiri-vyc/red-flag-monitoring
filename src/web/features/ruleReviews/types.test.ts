import { isParameterProposal } from "./types";

describe("isParameterProposal", () => {
  it("accepts a parameter proposal", () => {
    expect(
      isParameterProposal({
        parameter: "feature:roundTripWindowHours",
        parameterType: "window",
        currentValue: 72,
        proposedValue: 75.6,
        step: 0.05,
      }),
    ).toBe(true);
  });

  it("rejects a proposed rule definition", () => {
    expect(isParameterProposal({ definition: { match: "all", conditions: [] } })).toBe(false);
  });

  it("rejects a missing proposal, e.g. evidence of a coverage gap finding", () => {
    expect(isParameterProposal(null)).toBe(false);
    expect(isParameterProposal(undefined)).toBe(false);
  });
});
