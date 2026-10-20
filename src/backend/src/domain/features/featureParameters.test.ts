import { calculateFeatures } from "./calculateFeatures";
import { createFeatureContext } from "./featureContext";
import { DEFAULT_FEATURE_PARAMETERS, type FeatureParameters } from "./featureParameters";
import { createFxRateTable } from "./fxRates";
import { EMPTY_PAYEE_DAY_CLIENT_INDEX } from "./payeeDayClientIndex";
import { priceTransactionsChronologically } from "./pricedTransaction";
import { buildClient, buildIncoming, buildOutgoing } from "./testing/featureTestData";
import type { Transaction } from "../transaction";
import * as thresholds from "./thresholds";

function calculateWith(
  history: Transaction[],
  evaluatedId: string,
  featureId: string,
  parameters?: FeatureParameters,
) {
  const pricedHistory = priceTransactionsChronologically(history, createFxRateTable([]));
  const transaction = pricedHistory.find((candidate) => candidate.transactionId === evaluatedId);

  if (!transaction) {
    throw new Error(`Transaction ${evaluatedId} is not in the history`);
  }

  const context = createFeatureContext({
    transaction,
    client: buildClient(),
    clientHistory: pricedHistory,
    payeeDayClientIndex: EMPTY_PAYEE_DAY_CLIENT_INDEX,
    parameters,
  });

  return calculateFeatures({ featureIds: [featureId], context }).features[featureId];
}

describe("feature parameters (3.2 kind 2)", () => {
  it("default to the thresholds detection uses", () => {
    expect(DEFAULT_FEATURE_PARAMETERS).toMatchObject({
      quickForwardWindowHours: thresholds.QUICK_FORWARD_WINDOW_HOURS,
      roundTripWindowHours: thresholds.ROUND_TRIP_WINDOW_HOURS,
      passthroughMinInflowCzk: thresholds.PASSTHROUGH_MIN_INFLOW_CZK,
      nearLimitLowerCzk: thresholds.NEAR_LIMIT_LOWER_CZK,
      smallPaymentMaxCzk: thresholds.LIMIT_L_CZK,
    });
  });

  it("let a relaxed window see a forward the default window misses", () => {
    const history = [
      buildIncoming({ id: "IN", at: "2026-07-01 10:00", amount: 30_000, payer: "B" }),
      buildOutgoing({ id: "OUT", at: "2026-07-01 12:15", amount: 30_000, payee: "C" }),
    ];

    expect(calculateWith(history, "OUT", "quick_forward_match_count")).toBe(0);
    expect(
      calculateWith(history, "OUT", "quick_forward_match_count", {
        ...DEFAULT_FEATURE_PARAMETERS,
        quickForwardWindowHours: 2.5,
      }),
    ).toBe(1);
  });

  it("let a lower minimum inflow see a pass-through just under 100 000 CZK", () => {
    const history = [
      buildIncoming({ id: "IN", at: "2026-07-01 10:00", amount: 96_000, payer: "B" }),
      buildOutgoing({ id: "OUT", at: "2026-07-01 12:00", amount: 90_000, payee: "C" }),
    ];

    expect(calculateWith(history, "OUT", "passthrough_ratio")).toBeNull();
    expect(
      calculateWith(history, "OUT", "passthrough_ratio", {
        ...DEFAULT_FEATURE_PARAMETERS,
        passthroughMinInflowCzk: 95_000,
      }),
    ).toBe(0.9375);
  });
});
