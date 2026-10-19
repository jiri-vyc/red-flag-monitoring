"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getServiceMode, selectServiceImplementation, type ApiMode } from "@/config/apiMode";
import { getCurrentUser } from "@/config/currentUser";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import { MIN_ETA_ELAPSED_MS } from "../domain/runDuration";
import type { Batch, Bucket, RunScope } from "../types";
import type { BatchesCapabilities } from "./contract";
import { batchesImplementations, batchesService } from "./service";
import { useCurrentUser } from "@/features/users/api/hooks";
import type { UserRole } from "@/features/users/types";

// The mock's simulated run lasts a few seconds, so it is polled often for a smooth progress; a live run over
// the database takes minutes and is polled every 2 s.
const PROCESSING_POLL_INTERVAL_MS: Record<ApiMode, number> = { mock: 400, live: 2000 };
// A mock run lasts 3 to 8 s, so it would end before the live 5 s minimum for a remaining-time estimate.
export const ETA_MIN_ELAPSED_MS: Record<ApiMode, number> = { mock: 1000, live: MIN_ETA_ELAPSED_MS };
const FIRST_PAGE_CURSOR: string | null = null;

export const batchQueryKeys = {
  all: ["batches"] as const,
  detail: (batchId: string) => ["batches", batchId] as const,
  transactions: (batchId: string, bucket: Bucket, role: UserRole) =>
    ["batches", batchId, "transactions", bucket, role] as const,
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

/** Polls while any of the batches is still processing and stops once all of them are completed or failed. */
export function findProcessingPollInterval(batches: Batch[] | undefined, apiMode: ApiMode): number | false {
  const isAnyProcessing = batches?.some((batch) => batch.status === "processing") ?? false;
  return isAnyProcessing ? PROCESSING_POLL_INTERVAL_MS[apiMode] : false;
}

export function useBatches() {
  useServiceUsage("batches");
  const batchesMode = useBatchesMode();
  return useQuery({
    queryKey: batchQueryKeys.all,
    queryFn: () => batchesService.loadBatches(),
    refetchInterval: (query) => findProcessingPollInterval(query.state.data, batchesMode),
  });
}

export function useBatch(batchId: string) {
  useServiceUsage("batches");
  const batchesMode = useBatchesMode();
  return useQuery({
    queryKey: batchQueryKeys.detail(batchId),
    queryFn: () => batchesService.loadBatch(batchId),
    refetchInterval: (query) =>
      findProcessingPollInterval(query.state.data && [query.state.data], batchesMode),
  });
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
