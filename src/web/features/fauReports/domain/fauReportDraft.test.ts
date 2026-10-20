import type { TransactionEvaluation } from "@/features/batches/types";
import type { Rule } from "@/features/rules/types";

import { buildTestReport, SOURCE } from "../testing/fauReportFixtures";
import { buildFauReportDescription, toFauReportSource } from "./fauReportDraft";

const EVALUATION: TransactionEvaluation = {
  batchId: "batch-1",
  transaction: { ...SOURCE.transaction, clientId: "K000001" },
  client: { id: "K000001", riskProfile: "high", isPep: true, country: "CZ" },
  bucket: "alert",
  failedRules: [
    {
      ruleId: "rule-1",
      ruleName: "R-03 Velká částka",
      ruleType: "deterministic",
      ruleVersionNumber: 2,
      baseScore: 90,
      sensitivity: 100,
      score: 90,
      adjustedScore: 90,
      isFailed: true,
      escalationRole: "contact_person",
      trace: [
        { condition: "Částka", isMet: true, detail: "amount_czk (950000) > 500000" },
        { condition: "Země", isMet: false, detail: "CY není HRJ" },
      ],
    },
  ],
  passedRules: [],
  skippedRules: [],
};

const RULE = {
  id: "rule-1",
  versions: [
    { versionNumber: 1, legalBases: [{ regulationId: "reg-aml-act", ref: "§ 9" }] },
    { versionNumber: 2, legalBases: [{ regulationId: "reg-aml-act", ref: "§ 6 odst. 1 písm. b)" }] },
  ],
} as unknown as Rule;

describe("toFauReportSource", () => {
  it("keeps the met trace steps as reasons and the evaluated version's legal bases", () => {
    const source = toFauReportSource({
      evaluation: EVALUATION,
      alertRaisedAt: SOURCE.alertRaisedAt,
      rules: [RULE],
      regulationNames: { "reg-aml-act": "AML zákon" },
    });

    expect(source).toEqual(SOURCE);
  });

  it("leaves the legal basis empty when the rule is not known", () => {
    const source = toFauReportSource({
      evaluation: EVALUATION,
      alertRaisedAt: SOURCE.alertRaisedAt,
      rules: [],
      regulationNames: {},
    });

    expect(source.failedRules[0]?.legalBases).toEqual([]);
  });
});

describe("buildFauReportDescription", () => {
  it("describes the transaction, the client and each failed rule with reason, score and legal basis", () => {
    const description = buildFauReportDescription(SOURCE);

    expect(description).toContain("Spouštěcí transakce TX000000001");
    expect(description).toContain("trasa: CZ → CY");
    expect(description).toContain("Klient K000001");
    expect(description).toContain("PEP: ano");
    expect(description).toContain("R-03 Velká částka (v2), upravené skóre 90/100");
    expect(description).toContain("důvod: Částka: amount_czk (950000) > 500000");
    expect(description).toContain("právní základ: AML zákon § 6 odst. 1 písm. b)");
  });

  it("is deterministic", () => {
    expect(buildFauReportDescription(SOURCE)).toBe(buildFauReportDescription(SOURCE));
  });
});

describe("buildFauReportDraft", () => {
  it("prefills sections I to VI and leaves the subject type to be picked", () => {
    const report = buildTestReport();

    expect(report).toMatchObject({
      referenceNumber: "OPO-2026-0001",
      status: "draft",
      reportType: "money_laundering",
      subject: { clientId: "K000001", country: "CZ", riskProfile: "high", isPep: true, subjectType: null },
      execution: { status: "executed" },
      alertRaisedAt: SOURCE.alertRaisedAt,
      approvedBy: null,
      submission: null,
    });
    expect(report.description).toBe(buildFauReportDescription(SOURCE));
    expect(report.reportingInstitution.companyId).toBe("00000000");
  });
});
