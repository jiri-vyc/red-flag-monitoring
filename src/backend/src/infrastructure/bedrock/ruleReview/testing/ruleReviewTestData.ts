import type {
  FindingExplanationContext,
  LlmAuditLog,
} from "../../../../application/ruleReviews/ruleReviewPorts";
import { DEFAULT_RULE_REVIEW_PARAMS } from "../../../../domain/ruleReview/ruleReviewParams";
import type {
  LlmCallAudit,
  RuleBacktest,
  RuleReviewFinding,
  RuleReviewReport,
} from "../../../../domain/ruleReview/ruleReviewReport";

export const TOTAL_CLIENT_COUNT = 5493;

export function createFinding(id: string, clientCount = 3): RuleReviewFinding {
  return {
    id,
    kind: "rule_adjustment",
    rule: { ruleId: "rule-04", ruleVersionId: "version-04", code: "R-04", label: "Průtokový účet" },
    proposal: {
      parameter: "R04_MIN_INFLOW_CZK",
      parameterType: "amount",
      currentValue: 100000,
      proposedValue: 95000,
      step: 0.05,
    },
    growth: { baseClients: 16, addedClients: 3, capExceeded: false },
    clients: Array.from({ length: clientCount }, (_, index) => ({
      clientId: `K00000${index}`,
      transactionIds: [`TX${index}`],
      nearMissCount: index,
      distinctDays: 1,
      minDistance: 0.01,
      seedLinks: [],
    })),
    evidence: { parameterLabel: "Minimální příchozí částka za 24 h (CZK)" },
  };
}

export function createReport(findings: RuleReviewFinding[] = [createFinding("F-01")]): RuleReviewReport {
  return {
    id: "review-1",
    status: "running",
    startedAt: "2026-10-20T08:00:00.000Z",
    finishedAt: null,
    errorMessage: null,
    createdBy: "user-1",
    engineVersion: "test",
    params: { ...DEFAULT_RULE_REVIEW_PARAMS, llm: { ...DEFAULT_RULE_REVIEW_PARAMS.llm, enabled: true } },
    input: {
      ruleVersionIds: [],
      referenceListVersionIds: [],
      transactionSetDigest: "digest",
      evaluationRunId: null,
    },
    progress: { stage: "llm", done: 0, total: 1 },
    coverageMatrix: [{ indicator: "Z11", label: "Platby za třetí osoby", ruleCodes: [] }],
    findings,
    llm: { summary: null, explanations: {}, hypotheses: [], critiques: {}, calls: [], errors: [] },
  };
}

export type RecordingAuditLog = LlmAuditLog & { calls: LlmCallAudit[]; errors: string[] };

export function createRecordingAuditLog(): RecordingAuditLog {
  const calls: LlmCallAudit[] = [];
  const errors: string[] = [];

  return {
    calls,
    errors,
    recordCall: (call) => calls.push(call),
    recordError: (message) => errors.push(message),
  };
}

export function createExplanationContext(
  report: RuleReviewReport,
  audit: LlmAuditLog = createRecordingAuditLog(),
): FindingExplanationContext {
  return {
    report,
    ruleCatalogue: [
      {
        ruleId: "rule-04",
        ruleVersionId: "version-04",
        code: "R-04",
        label: "Průtokový účet",
        alertType: "pass_through_account",
        humanText: "Průtokový účet. …",
        legalBases: [{ regulationCode: "AMLZ", ref: "§ 6 odst. 1 písm. a)" }],
      },
    ],
    clientProfilesByFindingId: {},
    budget: report.params.llm,
    audit,
  };
}

export function createBacktest(overrides: Partial<RuleBacktest> = {}): RuleBacktest {
  return {
    violation: null,
    hitCount: 40,
    clientCount: 20,
    clientShare: 20 / TOTAL_CLIENT_COUNT,
    overlapByRuleCode: { "R-11": 0.3 },
    maxOverlap: { ruleCode: "R-11", share: 0.3 },
    clientsByRiskScore: { low: 20, medium: 0, high: 0 },
    clientsByClientType: { natural_person: 20, entrepreneur: 0, legal_entity: 0 },
    sampleClientIds: ["K001", "K002", "K003"],
    discardReason: null,
    ...overrides,
  };
}
