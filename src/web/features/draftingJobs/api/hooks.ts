"use client";

import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { selectServiceImplementation } from "@/config/apiMode";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import { isDraftingJobInFlight, type DraftingJob, type DraftingJobFilter } from "../types";
import { draftingJobsImplementations, draftingJobsService } from "./service";

export const draftingJobQueryKeys = {
  all: ["drafting-jobs"] as const,
  list: (filter: DraftingJobFilter) => ["drafting-jobs", "list", filter] as const,
  detail: (jobId: string) => ["drafting-jobs", "detail", jobId] as const,
};

export function findDraftingJobsRefetchInterval(
  jobs: readonly DraftingJob[] | undefined,
  pollIntervalMs: number,
): number | false {
  return jobs?.some(isDraftingJobInFlight) ? pollIntervalMs : false;
}

/** Follows the data source selected in the sidebar. */
export function useDraftingJobPollIntervalMs(): number {
  const { apiMode } = useApiMode();
  return selectServiceImplementation("wizard", draftingJobsImplementations, apiMode).pollIntervalMs;
}

export function invalidateDraftingJobs(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: draftingJobQueryKeys.all });
}

export function useDraftingJobs(filter: DraftingJobFilter) {
  useServiceUsage("wizard");
  return useQuery({
    queryKey: draftingJobQueryKeys.list(filter),
    queryFn: () => draftingJobsService.loadJobs(filter),
    refetchInterval: (query) =>
      findDraftingJobsRefetchInterval(query.state.data?.items, draftingJobsService.pollIntervalMs),
    refetchOnWindowFocus: true,
  });
}

function draftingJobQueryOptions(jobId: string) {
  return {
    queryKey: draftingJobQueryKeys.detail(jobId),
    queryFn: () => draftingJobsService.loadJob(jobId),
    refetchInterval: (query: { state: { data: DraftingJob | undefined } }) =>
      findDraftingJobsRefetchInterval(
        query.state.data ? [query.state.data] : undefined,
        draftingJobsService.pollIntervalMs,
      ),
    refetchOnWindowFocus: true,
  };
}

export function useDraftingJob(jobId: string) {
  useServiceUsage("wizard");
  return useQuery(draftingJobQueryOptions(jobId));
}

export function useDraftingJobGroup(jobIds: readonly string[]) {
  useServiceUsage("wizard");
  return useQueries({
    queries: jobIds.map(draftingJobQueryOptions),
    combine: (results) => ({
      jobs: results.flatMap((result) => (result.data ? [result.data] : [])),
      isPending: results.some((result) => result.isPending),
      isFetching: results.some((result) => result.isFetching),
      error: results.find((result) => result.error)?.error ?? null,
      refetch: () => Promise.all(results.map((result) => result.refetch())),
    }),
  });
}

export function useRetryDraftingJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => draftingJobsService.retryJob(jobId),
    onSuccess: () => invalidateDraftingJobs(queryClient),
  });
}

const DRAFTED_ARTIFACT_QUERY_KEYS = [["rules"], ["policies"], ["regulations"], ["dashboard"]];

export function useRefreshDraftedArtifacts(job: DraftingJob | undefined) {
  const queryClient = useQueryClient();
  const succeededJobId = job?.status === "succeeded" ? job.id : null;
  useEffect(() => {
    if (succeededJobId) {
      void Promise.all(
        DRAFTED_ARTIFACT_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    }
  }, [succeededJobId, queryClient]);
}
