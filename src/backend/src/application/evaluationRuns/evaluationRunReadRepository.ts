import type { EscalationRole } from "../../domain/rule";
import type { Page, PageRequest } from "../pagination";
import type {
  EvaluationRunListItem,
  EvaluationRunSummary,
  TransactionEvaluationDetail,
  TransactionEvaluationFilter,
  TransactionEvaluationListItem,
} from "./evaluationRunReadModels";

export interface EvaluationRunReadRepository {
  hasRun(runId: string): Promise<boolean>;
  listRuns(page: PageRequest): Promise<Page<EvaluationRunListItem>>;
  findRunSummary(runId: string): Promise<EvaluationRunSummary | null>;
  // Sorted by max_score, highest first.
  listTransactionEvaluations(
    filter: TransactionEvaluationFilter,
    page: PageRequest,
  ): Promise<Page<TransactionEvaluationListItem>>;
  // With an escalation role, hits of rule versions escalated to other roles are left out (E3).
  findTransactionEvaluationDetail(
    runId: string,
    transactionId: string,
    escalationRole: EscalationRole | null,
  ): Promise<TransactionEvaluationDetail | null>;
}
