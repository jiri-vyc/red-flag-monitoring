import { FX_RATE_FEATURE_KEY, UnknownFeatureError } from "./calculateFeatures";
import { createPayeeDayClientIndex } from "./payeeDayClientIndex";
import {
  at,
  buildClient,
  buildIncoming,
  buildOutgoing,
  buildTransaction,
  calculateFeaturesOf,
} from "./testing/featureTestData";

describe("calculateFeatures", () => {
  it("ignores transactions after the evaluated one (F1)", () => {
    const history = [
      buildOutgoing({ id: "TX1", at: "2026-07-01 09:00", amount: 1000, payee: "A" }),
      buildOutgoing({ id: "TX2", at: "2026-07-01 10:00", amount: 2000, payee: "A" }),
      buildOutgoing({ id: "TX3", at: "2026-07-01 11:00", amount: 4000, payee: "A" }),
    ];

    const { features, contextRefs } = calculateFeaturesOf({
      featureIds: ["day_volume_czk"],
      history,
      evaluatedId: "TX2",
    });

    expect(features.day_volume_czk).toBe(3000);
    expect(contextRefs).toEqual(["TX2", "TX1"]);
  });

  it("stores the FX rate next to the features", () => {
    const { features } = calculateFeaturesOf({
      featureIds: ["tx_amount_czk"],
      history: [buildTransaction({ transactionId: "TX1" })],
      evaluatedId: "TX1",
    });

    expect(features).toEqual({ [FX_RATE_FEATURE_KEY]: null, tx_amount_czk: 1000 });
  });

  it("rejects a feature outside the catalogue", () => {
    expect(() =>
      calculateFeaturesOf({
        featureIds: ["amount_czk"],
        history: [buildTransaction({ transactionId: "TX1" })],
        evaluatedId: "TX1",
      }),
    ).toThrow(UnknownFeatureError);
  });

  it("leaves Q2 baselines empty for a client without Q2 transactions", () => {
    const { features } = calculateFeaturesOf({
      featureIds: ["client_q2_daily_avg_volume_czk", "client_q2_max_tx_czk"],
      history: [buildTransaction({ transactionId: "TX1" })],
      evaluatedId: "TX1",
      client: buildClient({ q2TxCount: 0, q2VolumeCzk: "0.00", q2MaxTxCzk: "0.00" }),
    });

    expect(features.client_q2_daily_avg_volume_czk).toBeNull();
    expect(features.client_q2_max_tx_czk).toBeNull();
  });
});

describe("payee_small_out_count_7d (PR-01)", () => {
  const history = [
    buildOutgoing({ id: "TX1", at: "2026-07-01 09:00", amount: 9000, payee: "A" }),
    buildOutgoing({ id: "TX2", at: "2026-07-03 09:00", amount: 30000, payee: "A" }),
    buildOutgoing({ id: "TX3", at: "2026-07-04 09:00", amount: 9000, payee: "B" }),
    buildOutgoing({ id: "TX4", at: "2026-07-07 09:00", amount: 9000, payee: "A" }),
    buildOutgoing({ id: "TX5", at: "2026-07-08 10:00", amount: 9000, payee: "A" }),
  ];

  it("counts small payments to the same payee in the trailing 7 days", () => {
    const { features } = calculateFeaturesOf({
      featureIds: ["payee_small_out_count_7d", "payee_small_out_sum_7d_czk"],
      history,
      evaluatedId: "TX5",
    });

    expect(features.payee_small_out_count_7d).toBe(2);
    expect(features.payee_small_out_sum_7d_czk).toBe(18000);
  });

  it("is empty for an incoming payment", () => {
    const { features } = calculateFeaturesOf({
      featureIds: ["payee_small_out_count_7d"],
      history: [...history, buildIncoming({ id: "TX6", at: "2026-07-08 11:00", amount: 9000, payer: "A" })],
      evaluatedId: "TX6",
    });

    expect(features.payee_small_out_count_7d).toBeNull();
  });
});

describe("quick_forward_match_count (PR-05)", () => {
  it.each([
    ["forwards within 2 h to another account", "2026-07-01 11:30", 31000, "B", 1],
    ["is outside the 2 h window", "2026-07-01 12:30", 31000, "B", 0],
    ["is outside the 0.9–1.1 band", "2026-07-01 11:30", 40000, "B", 0],
    ["returns the money to the payer", "2026-07-01 11:30", 31000, "A", 0],
  ])(
    "counts 0 or 1 when the outgoing payment %s",
    (_case, outgoingAt, outgoingAmount, payee, expectedCount) => {
      const history = [
        buildIncoming({ id: "TX1", at: "2026-07-01 10:00", amount: 30000, payer: "A" }),
        buildOutgoing({ id: "TX2", at: outgoingAt, amount: outgoingAmount, payee }),
      ];

      const { features } = calculateFeaturesOf({
        featureIds: ["quick_forward_match_count"],
        history,
        evaluatedId: "TX2",
      });

      expect(features.quick_forward_match_count).toBe(expectedCount);
    },
  );
});

describe("round_trip_match_count_72h (PR-06)", () => {
  const history = [
    buildOutgoing({ id: "TX1", at: "2026-07-01 10:00", amount: 50000, payee: "X" }),
    buildIncoming({ id: "TX2", at: "2026-07-03 10:00", amount: 40000, payer: "X" }),
  ];

  it("hits on the second payment of the pair", () => {
    const { features, contextRefs } = calculateFeaturesOf({
      featureIds: ["round_trip_match_count_72h"],
      history,
      evaluatedId: "TX2",
    });

    expect(features.round_trip_match_count_72h).toBe(1);
    expect(contextRefs).toEqual(["TX2", "TX1"]);
  });

  it("does not look ahead from the first payment", () => {
    const { features } = calculateFeaturesOf({
      featureIds: ["round_trip_match_count_72h"],
      history,
      evaluatedId: "TX1",
    });

    expect(features.round_trip_match_count_72h).toBe(0);
  });
});

describe("passthrough features (TM-04)", () => {
  const featureIds = ["passthrough_in_24h_czk", "passthrough_out_6h_czk", "passthrough_ratio"];
  const inflow = [
    buildIncoming({ id: "TX1", at: "2026-07-01 01:00", amount: 60000, payer: "P1" }),
    buildIncoming({ id: "TX2", at: "2026-07-01 08:00", amount: 60000, payer: "P2" }),
  ];

  it("sums outflow after the anchor to accounts that did not pay in", () => {
    const history = [
      ...inflow,
      buildOutgoing({ id: "TX3", at: "2026-07-01 09:00", amount: 50000, payee: "M" }),
      buildOutgoing({ id: "TX4", at: "2026-07-01 10:00", amount: 10000, payee: "P1" }),
      buildOutgoing({ id: "TX5", at: "2026-07-01 12:00", amount: 50000, payee: "M" }),
    ];

    const { features } = calculateFeaturesOf({ featureIds, history, evaluatedId: "TX5" });

    expect(features).toMatchObject({
      passthrough_in_24h_czk: 120000,
      passthrough_out_6h_czk: 100000,
      passthrough_ratio: 0.8333,
    });
  });

  it("is empty when the anchor is more than 6 h back", () => {
    const history = [
      ...inflow,
      buildOutgoing({ id: "TX3", at: "2026-07-01 14:30", amount: 120000, payee: "M" }),
    ];

    const { features } = calculateFeaturesOf({ featureIds, history, evaluatedId: "TX3" });

    expect(features.passthrough_ratio).toBeNull();
  });
});

describe("payee_day_distinct_clients (PR-03)", () => {
  it("counts clients paying the same payee that day up to the evaluated payment", () => {
    const otherClientPayments = ["K000002", "K000003", "K000004"].map((clientId, position) =>
      buildTransaction({
        transactionId: `TX${position + 10}`,
        clientId,
        payeeAccount: "SHOP",
        occurredAt: at(`2026-07-01 0${position + 8}:00`),
      }),
    );
    const evaluatedPayment = buildTransaction({
      transactionId: "TX1",
      payeeAccount: "SHOP",
      occurredAt: at("2026-07-01 09:30"),
    });
    const payeeDayClientIndex = createPayeeDayClientIndex([...otherClientPayments, evaluatedPayment]);

    const { features } = calculateFeaturesOf({
      featureIds: ["payee_day_distinct_clients"],
      history: [evaluatedPayment],
      evaluatedId: "TX1",
      payeeDayClientIndex,
    });

    expect(features.payee_day_distinct_clients).toBe(3);
  });
});
