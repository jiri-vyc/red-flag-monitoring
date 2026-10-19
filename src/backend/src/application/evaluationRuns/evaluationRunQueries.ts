import { NotFoundError } from "../errors";
import type { Page, PageRequest } from "../pagination";
import type {
  EvaluationRunListItem,
  EvaluationRunSummary,
  TransactionEvaluationDetail,
  TransactionEvaluationFilter,
  TransactionEvaluationListItem,
} from "./evaluationRunReadModels";
import type { EvaluationRunReadRepository } from "./evaluationRunReadRepository";

// V14: runs and their results are read-only, there are no write use cases here.
export class EvaluationRunQueries {
  constructor(private readonly evaluationRunReadRepository: EvaluationRunReadRepository) {}

  listRuns(page: PageRequest): Promise<Page<EvaluationRunListItem>> {
    return this.evaluationRunReadRepository.listRuns(page);
  }

  async getRunSummary(runId: string): Promise<EvaluationRunSummary> {
    const summary = await this.evaluationRunReadRepository.findRunSummary(runId);

    if (!summary) {
      throw new NotFoundError("Evaluation run", runId);
    }

    return summary;
  }

  async listTransactionEvaluations(
    filter: TransactionEvaluationFilter,
    page: PageRequest,
  ): Promise<Page<TransactionEvaluationListItem>> {
    if (!(await this.evaluationRunReadRepository.hasRun(filter.runId))) {
      throw new NotFoundError("Evaluation run", filter.runId);
    }

    return this.evaluationRunReadRepository.listTransactionEvaluations(filter, page);
  }

  async getTransactionEvaluationDetail(
    runId: string,
    transactionId: string,
  ): Promise<TransactionEvaluationDetail> {
    const detail = await this.evaluationRunReadRepository.findTransactionEvaluationDetail(
      runId,
      transactionId,
    );

    if (!detail) {
      throw new NotFoundError("Transaction evaluation", `${runId}/${transactionId}`);
    }

    return detail;
  }
}
