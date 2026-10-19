import type { DraftingJob, DraftingJobFilter, DraftingJobPage } from "../types";

export interface DraftingJobsService {
  /** How often the web refetches while a job is pending or running. */
  readonly pollIntervalMs: number;
  /** Newest first. */
  loadJobs(filter: DraftingJobFilter): Promise<DraftingJobPage>;
  loadJob(jobId: string): Promise<DraftingJob>;
  /** Starts a new job with the inputs of a failed one. The failed job keeps its error. */
  retryJob(jobId: string): Promise<DraftingJob>;
}
