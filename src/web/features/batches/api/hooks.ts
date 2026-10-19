"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { selectServiceImplementation } from "@/config/apiMode";
import { CURRENT_USER } from "@/config/currentUser";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { Bucket } from "../types";
import type { BatchesCapabilities } from "./contract";
import { batchesImplementations, batchesService } from "./service";

const PROCESSING_POLL_INTERVAL_MS = 400;
const FIRST_PAGE_CURSOR: string | null = null;

export const batchQueryKeys = {
  all: ["batches"] as const,
  detail: (batchId: string) => ["batches", batchId] as const,
  transactions: (batchId: string, bucket: Bucket) => ["batches", batchId, "transactions", bucket] as const,
  evaluation: (batchId: string, transactionId: string) =>
    ["batches", batchId, "evaluation", transactionId] as const,
};

/** Follows the data source selected in the sidebar. */
export function useBatchesCapabilities(): BatchesCapabilities {
  const { apiMode } = useApiMode();
  return selectServiceImplementation("batches", batchesImplementations, apiMode).capabilities;
}

export function useBatches() {
  useServiceUsage("batches");
  return useQuery({ queryKey: batchQueryKeys.all, queryFn: () => batchesService.loadBatches() });
}

export function useBatch(batchId: string) {
  useServiceUsage("batches");
  return useQuery({
    queryKey: batchQueryKeys.detail(batchId),
    queryFn: () => batchesService.loadBatch(batchId),
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? PROCESSING_POLL_INTERVAL_MS : false,
  });
}

export function useUploadBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => batchesService.uploadBatch({ file, uploadedBy: CURRENT_USER.name }),
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
    mutationFn: () => batchesService.startRun({ startedBy: CURRENT_USER.name }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: batchQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export function useBatchTransactions({ batchId, bucket }: { batchId: string; bucket: Bucket }) {
  useServiceUsage("batches");
  return useInfiniteQuery({
    queryKey: batchQueryKeys.transactions(batchId, bucket),
    queryFn: ({ pageParam }) => batchesService.loadBatchTransactions({ batchId, bucket, cursor: pageParam }),
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
  return useQuery({
    queryKey: batchQueryKeys.evaluation(batchId, transactionId),
    queryFn: () => batchesService.loadTransactionEvaluation({ batchId, transactionId }),
  });
}
