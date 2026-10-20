import { mockTransactionsService } from "./transactions.mock";

jest.mock("../latency", () => ({ simulateLatency: () => Promise.resolve() }));

describe("mockTransactionsService", () => {
  it("lists only the client's transactions, newest first", async () => {
    const allTransactions = await mockTransactionsService.loadTransactions({ clientId: null, cursor: null });
    const clientId = allTransactions.items[0]?.clientId ?? "";

    const page = await mockTransactionsService.loadTransactions({ clientId, cursor: null });

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((transaction) => transaction.clientId === clientId)).toBe(true);
    const bookedAts = page.items.map((transaction) => transaction.bookedAt);
    expect(bookedAts).toEqual([...bookedAts].sort().reverse());
  });

  it("pages through every transaction with the cursor", async () => {
    const firstPage = await mockTransactionsService.loadTransactions({ clientId: null, cursor: null });
    const secondPage = await mockTransactionsService.loadTransactions({
      clientId: null,
      cursor: firstPage.nextCursor,
    });

    expect(firstPage.items).toHaveLength(50);
    expect(firstPage.nextCursor).toBe("50");
    expect(secondPage.items[0]?.transactionId).not.toBe(firstPage.items[0]?.transactionId);
    expect(secondPage.totalCount).toBe(firstPage.totalCount);
  });

  it("returns an empty page for an unknown client", async () => {
    const page = await mockTransactionsService.loadTransactions({ clientId: "K999999", cursor: null });

    expect(page).toEqual({ items: [], nextCursor: null, totalCount: 0 });
  });
});
