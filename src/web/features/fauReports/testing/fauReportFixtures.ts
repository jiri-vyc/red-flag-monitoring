import { buildFauReportDraft } from "../domain/fauReportDraft";
import { DEMO_REPORTING_INSTITUTION } from "../reportingInstitution";
import type { FauReport, FauReportActor, FauReportSource } from "../types";

// Synthetic test data only: pseudonymous client and transaction IDs, no personal data.
export const AUTHOR: FauReportActor = { id: "user-contact", name: "Kontaktní osoba" };
export const APPROVER: FauReportActor = { id: "user-officer", name: "Compliance officer" };

export const SOURCE: FauReportSource = {
  alert: { batchId: "batch-1", transactionId: "TX000000001" },
  alertRaisedAt: "2026-10-14T10:00:00.000Z",
  transaction: {
    transactionId: "TX000000001",
    bookedAt: "2026-07-01T10:00:00.000Z",
    amount: 950000,
    currency: "CZK",
    amountCzk: 950000,
    transactionType: "outgoing payment",
    payerCountry: "CZ",
    payeeCountry: "CY",
    payerAccount: "ACC-0001",
    payeeAccount: "ACC-0002",
  },
  client: { id: "K000001", country: "CZ", riskProfile: "high", isPep: true },
  failedRules: [
    {
      ruleName: "R-03 Velká částka",
      ruleVersionNumber: 2,
      adjustedScore: 90,
      reasons: ["Částka: amount_czk (950000) > 500000"],
      legalBases: ["AML zákon § 6 odst. 1 písm. b)"],
    },
  ],
};

export function buildTestReport(overrides: Partial<FauReport> = {}): FauReport {
  return {
    ...buildFauReportDraft({
      id: "fau-report-1",
      referenceNumber: "OPO-2026-0001",
      source: SOURCE,
      reportingInstitution: DEMO_REPORTING_INSTITUTION,
      author: AUTHOR,
      now: "2026-10-15T10:00:00.000Z",
    }),
    ...overrides,
  };
}
