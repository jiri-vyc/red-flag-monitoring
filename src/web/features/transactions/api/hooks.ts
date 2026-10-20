"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { useServiceUsage } from "@/providers/MockUsageProvider";

import { transactionsService } from "./service";

const FIRST_PAGE_CURSOR: string | null = null;

export function useTransactions({ clientId }: { clientId: string | null }) {
  useServiceUsage("transactions");
  return useInfiniteQuery({
    queryKey: ["transactions", clientId],
    queryFn: ({ pageParam }) => transactionsService.loadTransactions({ clientId, cursor: pageParam }),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
