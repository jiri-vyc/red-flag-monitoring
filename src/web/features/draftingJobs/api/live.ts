import { requestJson } from "@/lib/httpClient";

import type { DraftingJobFilter } from "../types";
import type { DraftingJobsService } from "./contract";
import { draftingJobDtoSchema, draftingJobPageDtoSchema, draftingJobPath, toDraftingJob } from "./dto";

const LIVE_POLL_INTERVAL_MS = 30_000;

function buildListQuery({ statuses, kinds, limit }: DraftingJobFilter): string {
  const params = new URLSearchParams();
  if (statuses && statuses.length > 0) {
    params.set("status", statuses.join(","));
  }
  if (kinds && kinds.length > 0) {
    params.set("kind", kinds.join(","));
  }
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

export const liveDraftingJobsService: DraftingJobsService = {
  pollIntervalMs: LIVE_POLL_INTERVAL_MS,

  async loadJobs(filter) {
    const page = await requestJson({
      path: `/drafting-jobs${buildListQuery(filter)}`,
      schema: draftingJobPageDtoSchema,
    });
    return { items: page.items.map(toDraftingJob), total: page.total };
  },

  async loadJob(jobId) {
    return toDraftingJob(await requestJson({ path: draftingJobPath(jobId), schema: draftingJobDtoSchema }));
  },

  async retryJob(jobId) {
    const job = await requestJson({
      path: `${draftingJobPath(jobId)}/retry`,
      method: "POST",
      schema: draftingJobDtoSchema,
    });
    return toDraftingJob(job);
  },
};
