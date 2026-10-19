import { isBetween, isOneOf, isSubsetOf } from "./sqlChecks";

describe("isOneOf", () => {
  it("builds an IN check over the quoted column", () => {
    expect(isOneOf("tx_type", ["outgoing", "incoming"])).toBe(`"tx_type" IN ('outgoing', 'incoming')`);
  });

  it("escapes single quotes in allowed values", () => {
    expect(isOneOf("note", ["it's"])).toBe(`"note" IN ('it''s')`);
  });
});

describe("isBetween", () => {
  it("builds an inclusive range check", () => {
    expect(isBetween("base_score", 0, 100)).toBe(`"base_score" BETWEEN 0 AND 100`);
  });
});

describe("isSubsetOf", () => {
  it("builds an array containment check with quoted values", () => {
    expect(isSubsetOf("risk_profiles", ["low", "it's"])).toBe(
      `"risk_profiles" <@ ARRAY['low', 'it''s']::text[]`,
    );
  });
});
