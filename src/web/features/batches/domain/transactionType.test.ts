import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

import { formatTransactionType, toTransactionType } from "./transactionType";

describe("toTransactionType", () => {
  it("accepts the live values and maps the dataset spelling used by the mock to them", () => {
    expect(toTransactionType("incoming")).toBe("incoming");
    expect(toTransactionType("remittance")).toBe("remittance");
    expect(toTransactionType("incoming payment")).toBe("incoming");
    expect(toTransactionType("outgoing payment")).toBe("outgoing");
  });

  it("returns null for an unknown value", () => {
    expect(toTransactionType("card")).toBeNull();
  });
});

describe("formatTransactionType", () => {
  it("translates a known type in either spelling", () => {
    expect(formatTransactionType("outgoing", en.transactionType)).toBe(en.transactionType.outgoing);
    expect(formatTransactionType("outgoing payment", cs.transactionType)).toBe(cs.transactionType.outgoing);
  });

  it("shows an unknown value as it came", () => {
    expect(formatTransactionType("card", en.transactionType)).toBe("card");
  });
});
