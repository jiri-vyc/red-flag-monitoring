import type { EvaluationRunReadRepository } from "../evaluationRuns/evaluationRunReadRepository";
import { NotFoundError } from "../errors";
import type { Page, PageRequest } from "../pagination";
import { formatAmlEventsCsv } from "./amlEventCsv";
import type { AmlEventDetail, AmlEventFilter, AmlEventListItem } from "./amlEventReadModels";
import type { AmlEventReadRepository } from "./amlEventReadRepository";

export class AmlEventQueries {
  constructor(
    private readonly dependencies: {
      amlEventReadRepository: AmlEventReadRepository;
      evaluationRunReadRepository: EvaluationRunReadRepository;
    },
  ) {}

  async listRunAmlEvents(filter: AmlEventFilter, page: PageRequest): Promise<Page<AmlEventListItem>> {
    if (!(await this.dependencies.evaluationRunReadRepository.hasRun(filter.runId))) {
      throw new NotFoundError("Evaluation run", filter.runId);
    }

    return this.dependencies.amlEventReadRepository.listAmlEvents(filter, page);
  }

  async exportRunAmlEventsCsv(runId: string): Promise<string> {
    if (!(await this.dependencies.evaluationRunReadRepository.hasRun(runId))) {
      throw new NotFoundError("Evaluation run", runId);
    }

    return formatAmlEventsCsv(await this.dependencies.amlEventReadRepository.listRunCsvRows(runId));
  }

  async getAmlEventDetail(amlEventId: string): Promise<AmlEventDetail> {
    const detail = await this.dependencies.amlEventReadRepository.findAmlEventDetail(amlEventId);

    if (!detail) {
      throw new NotFoundError("AML event", amlEventId);
    }

    return detail;
  }
}
