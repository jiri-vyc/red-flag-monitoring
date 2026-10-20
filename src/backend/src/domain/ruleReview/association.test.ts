import { buildClient, buildIncoming, buildOutgoing } from "../features/testing/featureTestData";
import type { Transaction } from "../transaction";
import {
  buildAssociationFindings,
  collectSeeds,
  describeCounterpartyStructure,
  indexCounterpartyAccounts,
} from "./association";
import { DEFAULT_RULE_REVIEW_PARAMS } from "./ruleReviewParams";
import { buildReviewDataset } from "./testing/ruleReviewTestData";

const caps = DEFAULT_RULE_REVIEW_PARAMS.association;

function forClient(clientId: string, transaction: Transaction): Transaction {
  return { ...transaction, clientId, transactionId: `${clientId}-${transaction.transactionId}` };
}

const SEED = buildClient({ clientId: "SEED", amlRiskScore: "high" });
const LINKED = buildClient({ clientId: "LINKED" });
const FLOW = buildClient({ clientId: "FLOW" });
const HUB_USERS = ["H1", "H2", "H3", "H4"].map((clientId) => buildClient({ clientId }));

const dataset = buildReviewDataset(
  [SEED, LINKED, FLOW, ...HUB_USERS],
  [
    // SEED and LINKED share two private accounts.
    forClient("SEED", buildOutgoing({ id: "1", at: "2026-07-01 09:00", amount: 1000, payee: "P1" })),
    forClient("SEED", buildOutgoing({ id: "2", at: "2026-07-01 10:00", amount: 1000, payee: "P2" })),
    forClient("LINKED", buildOutgoing({ id: "1", at: "2026-07-02 09:00", amount: 1000, payee: "P1" })),
    forClient("LINKED", buildIncoming({ id: "2", at: "2026-07-03 09:00", amount: 1000, payer: "P2" })),
    // SEED pays X, X pays FLOW within 72 h: one strong link is enough.
    forClient("SEED", buildOutgoing({ id: "3", at: "2026-07-05 09:00", amount: 30_000, payee: "X" })),
    forClient("FLOW", buildIncoming({ id: "1", at: "2026-07-06 09:00", amount: 29_000, payer: "X" })),
    // A hub used by the seed and four others links nobody.
    forClient("SEED", buildOutgoing({ id: "4", at: "2026-07-07 09:00", amount: 1000, payee: "HUB" })),
    ...HUB_USERS.map((client) =>
      forClient(
        client.clientId,
        buildOutgoing({ id: "1", at: "2026-07-07 10:00", amount: 1000, payee: "HUB" }),
      ),
    ),
  ],
);

describe("association", () => {
  const seeds = collectSeeds({
    dataset,
    clientIdsByRuleCode: new Map([
      ["R-04", new Set(["H1"])],
      ["R-01", new Set(["H2"])],
    ]),
    caps,
  });
  const accountIndex = indexCounterpartyAccounts(dataset);

  it("takes seeds from the risk score, PEP and serious rule hits only", () => {
    expect([...seeds]).toEqual([
      ["SEED", ["risk_score_high"]],
      ["H1", ["rule_hit:R-04"]],
    ]);
  });

  it("links clients through two private accounts or one strong flow, never through a hub", () => {
    const findings = buildAssociationFindings({ dataset, accountIndex, seeds, caps });

    expect(findings.map((finding) => finding.id)).toEqual(["association:FLOW", "association:LINKED"]);
    expect(findings[1]?.clients[0]).toMatchObject({
      clientId: "LINKED",
      transactionIds: ["LINKED-1", "LINKED-2"],
      seedLinks: [{ seedClientId: "SEED", seedReasons: ["risk_score_high"], accounts: ["P1", "P2"] }],
    });
    expect(findings[0]?.evidence).toMatchObject({
      strongFlows: [
        {
          account: "X",
          seedClientId: "SEED",
          seedTransactionId: "SEED-3",
          clientTransactionId: "FLOW-1",
          hoursBetween: 24,
        },
      ],
    });
  });

  it("describes the account graph for the hypothesis loop", () => {
    const structure = describeCounterpartyStructure({ dataset, accountIndex, seeds, caps });

    expect(structure).toMatchObject({
      accountCount: 4,
      seedCount: 2,
      strongFlowClients: { privateAccounts: 1, anyAccount: 1 },
    });
    expect(structure.linkTable.find((row) => row.maxClientsPerAccount === 50)).toEqual({
      maxClientsPerAccount: 50,
      // LINKED, FLOW (through X) and the three non-seed hub users.
      linkedClients: 5,
      linkedViaTwoOrMoreAccounts: 1,
    });
  });
});
