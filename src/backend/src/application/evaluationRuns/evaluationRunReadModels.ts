import type { Client } from "../../domain/client";
import type { EvaluationRun, RuleEvaluation, TransactionEvaluation, Verdict } from "../../domain/evaluation";
import type { RuleKind } from "../../domain/rule";
import type { Transaction } from "../../domain/transaction";

// import_errors can hold up to 1000 rows, so the run list leaves it out.
export type EvaluationRunListItem = Omit<EvaluationRun, "importErrors">;

export type RunRuleVersionSummary = {
  ruleVersionId: string;
  ruleId: string;
  ruleCode: string;
  alertType: string;
  versionNo: number;
  hitCount: number;
};

export type RunReferenceListVersionSummary = {
  listVersionId: string;
  listId: string;
  listCode: string;
  versionNo: number;
};

export type EvaluationRunSummary = {
  run: EvaluationRun;
  verdictCounts: Record<Verdict, number>;
  ruleVersions: RunRuleVersionSummary[];
  referenceListVersions: RunReferenceListVersionSummary[];
};

export type TransactionEvaluationFilter = {
  runId: string;
  verdict: Verdict | null;
  // Keeps transactions where this rule version hit.
  hitRuleVersionId: string | null;
};

export type TransactionEvaluationListItem = TransactionEvaluation & { transaction: Transaction };

export type LegalBasisDetail = {
  regulationId: string;
  regulationCode: string;
  regulationTitle: string;
  regulationVersionId: string;
  regulationVersionLabel: string;
  ref: string;
};

export type PolicyVersionReference = {
  policyId: string;
  policyCode: string;
  policyVersionId: string;
  policyVersionNo: number;
};

// "Cesta k regulaci" in spec/datovy-model.md: rule evaluation → rule version → legal basis → regulation
// version, and on to the internal policy version the rule was derived from.
export type RuleEvaluationDetail = RuleEvaluation & {
  rule: { id: string; code: string; alertType: string; kind: RuleKind };
  ruleVersion: { versionNo: number; humanText: string; baseScore: number | null; sensitivity: number };
  legalBases: LegalBasisDetail[];
  derivedFromPolicyVersion: PolicyVersionReference | null;
};

export type TransactionEvaluationDetail = {
  evaluation: TransactionEvaluation;
  transaction: Transaction;
  client: Client;
  ruleEvaluations: RuleEvaluationDetail[];
};
