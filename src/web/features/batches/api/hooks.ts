"use client";

import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { getServiceMode, selectServiceImplementation, type ApiMode } from "@/config/apiMode";
import { getCurrentUser } from "@/config/currentUser";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import {
  advanceProgressMark,
  findLastPolledAtMs,
  findStalledSinceMs,
  restartProgressWatch,
  type ProgressMark,
} from "../domain/runProgress";
import type { Batch, Bucket, RunScope } from "../types";
import type { BatchesCapabilities } from "./contract";
import { batchesImplementations, batchesService } from "./service";
import { useCurrentUser } from "@/features/users/api/hooks";
import { USER_ROLES, type UserRole } from "@/features/users/types";

// The mock's simulated run lasts a few seconds, so it is polled often for a smooth progress; a live run over
// the database takes minutes and is polled every 2 s.
const PROCESSING_POLL_INTERVAL_MS: Record<ApiMode, number> = { mock: 400, live: 2000 };
const FIRST_PAGE_CURSOR: string | null = null;

export const batchQueryKeys = {
  all: ["batches"] as const,
  detail: (batchId: string) => ["batches", batchId] as const,
  transactions: (batchId: string, bucket: Bucket, role: UserRole) =>
    ["batches", batchId, "transactions", bucket, role] as const,
  roleAccess: (batchId: string, bucket: Bucket, role: UserRole) =>
    ["batches", batchId, "roleAccess", bucket, role] as const,
  evaluation: (batchId: string, transactionId: string, role: UserRole) =>
    ["batches", batchId, "evaluation", transactionId, role] as const,
};

/** The data source batches use: the sidebar choice, unless the env pins batches to a mode. */
export function useBatchesMode(): ApiMode {
  const { apiMode } = useApiMode();
  return getServiceMode("batches", apiMode);
}

/** Follows the data source selected in the sidebar. */
export function useBatchesCapabilities(): BatchesCapabilities {
  const { apiMode } = useApiMode();
  return selectServiceImplementation("batches", batchesImplementations, apiMode).capabilities;
}

/**
 * Polls while any of the batches is still processing and stops once all of them are completed or failed, or
 * once their progress has stalled (the backend may have interrupted the run; it still owns the status).
 */
export function findProcessingPollInterval(
  batches: Batch[] | undefined,
  apiMode: ApiMode,
  isStalled = false,
): number | false {
  const isAnyProcessing = batches?.some((batch) => batch.status === "processing") ?? false;
  return isAnyProcessing && !isStalled ? PROCESSING_POLL_INTERVAL_MS[apiMode] : false;
}

/** A processing run whose progress has not changed for STALLED_RUN_LIMIT_MS. */
export type RunStall = {
  /** When the progress last changed (client time); null while the run progresses or nothing processes. */
  stalledSinceMs: number | null;
  /** Refetches and resumes polling for another STALLED_RUN_LIMIT_MS from now. */
  checkAgain: () => void;
};

type QueryProgress<TData> = { data: TData | undefined; dataUpdatedAt: number; errorUpdatedAt: number };

/**
 * Tracks when the processing runs in the query last changed. The state lives in the hook, so the limit
 * starts again whenever a screen mounts.
 */
function useProcessingPolling<TData>({
  toBatches,
  apiMode,
}: {
  toBatches: (data: TData | undefined) => Batch[] | undefined;
  apiMode: ApiMode;
}) {
  const [progressMark, setProgressMark] = useState<ProgressMark | null>(null);

  // Runs outside render on every query update, so it derives the mark from the query state itself.
  const refetchInterval = ({ state }: { state: QueryProgress<TData> }) => {
    const batches = toBatches(state.data);
    const nextMark = advanceProgressMark(progressMark, batches, state.dataUpdatedAt);
    return findProcessingPollInterval(
      batches,
      apiMode,
      findStalledSinceMs(nextMark, findLastPolledAtMs(state)) !== null,
    );
  };

  const watchProgress = (query: QueryProgress<TData>, refetch: () => Promise<unknown>): RunStall => {
    const nextMark = advanceProgressMark(progressMark, toBatches(query.data), query.dataUpdatedAt);
    if (nextMark !== progressMark) {
      // Adjusting state during render: React re-renders right away with the new mark.
      setProgressMark(nextMark);
    }
    return {
      stalledSinceMs: findStalledSinceMs(nextMark, findLastPolledAtMs(query)),
      checkAgain: () => {
        setProgressMark((mark) => restartProgressWatch(mark, Date.now()));
        void refetch();
      },
    };
  };

  return { refetchInterval, watchProgress };
}

export function useBatches() {
  useServiceUsage("batches");
  const batchesMode = useBatchesMode();
  const { refetchInterval, watchProgress } = useProcessingPolling<Batch[]>({
    toBatches: (batches) => batches,
    apiMode: batchesMode,
  });
  const batchesQuery = useQuery({
    queryKey: batchQueryKeys.all,
    queryFn: () => batchesService.loadBatches(),
    refetchInterval,
  });
  return { batchesQuery, runStall: watchProgress(batchesQuery, batchesQuery.refetch) };
}

export function useBatch(batchId: string) {
  useServiceUsage("batches");
  const batchesMode = useBatchesMode();
  const { refetchInterval, watchProgress } = useProcessingPolling<Batch>({
    toBatches: (batch) => batch && [batch],
    apiMode: batchesMode,
  });
  const batchQuery = useQuery({
    queryKey: batchQueryKeys.detail(batchId),
    queryFn: () => batchesService.loadBatch(batchId),
    refetchInterval,
  });
  return { batchQuery, runStall: watchProgress(batchQuery, batchQuery.refetch) };
}

export function useUploadBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => batchesService.uploadBatch({ file, uploadedBy: getCurrentUser().name }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: batchQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export function useStartEvaluationRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scope: RunScope) => batchesService.startRun({ startedBy: getCurrentUser().name, scope }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: batchQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export function useBatchTransactions({ batchId, bucket }: { batchId: string; bucket: Bucket }) {
  useServiceUsage("batches");
  // Issue #6: results follow the role picked in the sidebar; the role is part of the key, so a switch refetches.
  const { activeRole: role } = useCurrentUser();
  return useInfiniteQuery({
    queryKey: batchQueryKeys.transactions(batchId, bucket, role),
    queryFn: ({ pageParam }) =>
      batchesService.loadBatchTransactions({ batchId, bucket, cursor: pageParam, role }),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export type BucketRoleAccess = {
  isPending: boolean;
  isError: boolean;
  /** The other roles that see at least one transaction of the bucket, in USER_ROLES order. */
  rolesWithAccess: UserRole[];
};

/**
 * Issue #6: the bucket counts are not filtered by role, so a bucket can look full while the active role sees
 * nothing. Asks for the first page as each other role and keeps the roles with a non-zero total.
 * Mount it only when the active role's list is empty and the bucket count is positive, so it costs no requests
 * otherwise.
 */
export function useBucketRoleAccess({
  batchId,
  bucket,
}: {
  batchId: string;
  bucket: Bucket;
}): BucketRoleAccess {
  useServiceUsage("batches");
  const { activeRole } = useCurrentUser();
  const otherRoles = USER_ROLES.filter((role) => role !== activeRole);
  return useQueries({
    queries: otherRoles.map((role) => ({
      queryKey: batchQueryKeys.roleAccess(batchId, bucket, role),
      queryFn: async (): Promise<{ role: UserRole; hasAccess: boolean }> => {
        const firstPage = await batchesService.loadBatchTransactions({
          batchId,
          bucket,
          cursor: FIRST_PAGE_CURSOR,
          role,
        });
        return { role, hasAccess: firstPage.totalCount > 0 };
      },
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
      rolesWithAccess: results.flatMap((result) => (result.data?.hasAccess ? [result.data.role] : [])),
    }),
  });
}

export function useTransactionEvaluation({
  batchId,
  transactionId,
}: {
  batchId: string;
  transactionId: string;
}) {
  useServiceUsage("batches");
  const { activeRole: role } = useCurrentUser();
  return useQuery({
    queryKey: batchQueryKeys.evaluation(batchId, transactionId, role),
    queryFn: () => batchesService.loadTransactionEvaluation({ batchId, transactionId, role }),
  });
}
