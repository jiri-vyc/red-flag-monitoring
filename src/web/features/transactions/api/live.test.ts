import { requestJson } from "@/lib/httpClient";

import { liveTransactionsService } from "./live";

// Requests are served by a mocked HTTP client, never by the shared backend database.
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

const TRANSACTION = {
  transactionId: "TX000000583",
  clientId: "K002989",
  occurredAt: "2026-07-01T04:11:48.000Z",
  amount: "7384.21",
  currency: "EUR",
  payerCountry: "SK",
  payeeCountry: "DK",
  payerAccount: null,
  payeeAccount: "K002989",
  transactionType: "remittance",
};

beforeEach(() => requestJsonMock.mockReset());

describe("liveTransactionsService", () => {
  it("requests the client's first page and maps the backend transaction", async () => {
    requestJsonMock.mockResolvedValue({ items: [TRANSACTION], total: 1, limit: 50, offset: 0 });

    const page = await liveTransactionsService.loadTransactions({ clientId: "K002989", cursor: null });

    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/transactions?limit=50&offset=0&clientId=K002989" }),
    );
    expect(page).toEqual({
      items: [
        {
          transactionId: "TX000000583",
          clientId: "K002989",
          bookedAt: "2026-07-01T04:11:48.000Z",
          amount: 7384.21,
          currency: "EUR",
          amountCzk: null,
          payerCountry: "SK",
          payeeCountry: "DK",
          payerAccount: "",
          payeeAccount: "K002989",
          transactionType: "remittance",
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });
  });

  it("lists every transaction without a client filter and continues from the cursor", async () => {
    requestJsonMock.mockResolvedValue({ items: [TRANSACTION], total: 120, limit: 50, offset: 50 });

    const page = await liveTransactionsService.loadTransactions({ clientId: null, cursor: "50" });

    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/transactions?limit=50&offset=50" }),
    );
    expect(page.nextCursor).toBe("51");
    expect(page.totalCount).toBe(120);
  });
});
