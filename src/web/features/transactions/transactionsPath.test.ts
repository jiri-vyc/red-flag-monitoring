import { transactionsPath } from "./transactionsPath";

describe("transactionsPath", () => {
  it("links to every transaction without a filter", () => {
    expect(transactionsPath({ clientId: null })).toBe("/transactions");
  });

  it("keeps the client, the highlighted transaction and the return path in the URL", () => {
    expect(
      transactionsPath({
        clientId: "K002989",
        highlightedTransactionId: "TX000000583",
        returnPath: "/batches/run-1/transactions/TX000000583",
      }),
    ).toBe(
      "/transactions?clientId=K002989&highlight=TX000000583&from=%2Fbatches%2Frun-1%2Ftransactions%2FTX000000583",
    );
  });
});
