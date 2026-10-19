import type { EntityManager } from "typeorm";

import type { NewDraftingJob } from "../../../application/drafting/draftingJobPorts";
import { DraftingJobEntity } from "../entities/DraftingJobEntity";

export function insertDraftingJob(manager: EntityManager, job: NewDraftingJob): Promise<DraftingJobEntity> {
  return manager.save(manager.create(DraftingJobEntity, { ...job, status: "pending" }));
}
