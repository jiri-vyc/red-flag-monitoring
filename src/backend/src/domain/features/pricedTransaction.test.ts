import { createFxRateTable, MissingFxRateError } from "./fxRates";
import { priceTransaction } from "./pricedTransaction";
import { at, buildTransaction } from "./testing/featureTestData";

const FX_RATES = createFxRateTable([
  { currency: "EUR", rateDate: "2026-07-02", czkPerUnit: 24.3 },
  { currency: "EUR", rateDate: "2026-07-03", czkPerUnit: 24.25 },
]);
const euroPayment = (wallClock: string) =>
  buildTransaction({ transactionId: "TX1", currency: "EUR", amount: "100.00", occurredAt: at(wallClock) });

describe("priceTransaction", () => {
  it("uses the rate of the transaction date", () => {
    const priced = priceTransaction(euroPayment("2026-07-02 09:00"), FX_RATES);

    expect(priced.amountCzk).toBe(2430);
    expect(priced.fxRate).toEqual({ currency: "EUR", rate_date: "2026-07-02", czk_per_unit: 24.3 });
  });

  it("uses the last published rate on a weekend", () => {
    const priced = priceTransaction(euroPayment("2026-07-05 09:00"), FX_RATES);

    expect(priced.fxRate?.rate_date).toBe("2026-07-03");
  });

  it("keeps CZK amounts without a rate", () => {
    const priced = priceTransaction(buildTransaction({ transactionId: "TX2", amount: "1500.50" }), FX_RATES);

    expect(priced.amountCzk).toBe(1500.5);
    expect(priced.fxRate).toBeNull();
  });

  it("fails without a rate on or before the transaction date", () => {
    expect(() => priceTransaction(euroPayment("2026-07-01 09:00"), FX_RATES)).toThrow(MissingFxRateError);
  });
});
