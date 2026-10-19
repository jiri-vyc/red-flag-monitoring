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
  findTransactionEvaluationDetail(
    runId: string,
    transactionId: string,
  ): Promise<TransactionEvaluationDetail | null>;
}
