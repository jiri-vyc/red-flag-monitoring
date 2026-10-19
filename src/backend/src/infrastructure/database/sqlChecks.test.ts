import { isOneOf } from "./sqlChecks";

describe("isOneOf", () => {
  it("builds an IN check over the quoted column", () => {
    expect(isOneOf("tx_type", ["outgoing", "incoming"])).toBe(`"tx_type" IN ('outgoing', 'incoming')`);
  });

  it("escapes single quotes in allowed values", () => {
    expect(isOneOf("note", ["it's"])).toBe(`"note" IN ('it''s')`);
  });
});
