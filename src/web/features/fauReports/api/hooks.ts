"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { selectServiceImplementation } from "@/config/apiMode";
import { getCurrentUser } from "@/config/currentUser";
import { batchQueryKeys } from "@/features/batches/api/hooks";
import { batchesService } from "@/features/batches/api/service";
import type { TransactionEvaluation } from "@/features/batches/types";
import { regulationQueryKeys } from "@/features/regulations/api/hooks";
import { regulationsService } from "@/features/regulations/api/service";
import { ruleQueryKeys } from "@/features/rules/api/hooks";
import { rulesService } from "@/features/rules/api/service";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import { toFauReportSource } from "../domain/fauReportDraft";
import type {
  FauReport,
  FauReportActor,
  FauReportAlert,
  FauReportDraftChanges,
  MarkFauReportSubmittedInput,
} from "../types";
import type { FauReportsCapabilities } from "./contract";
import { fauReportsImplementations, fauReportsService } from "./service";

export const fauReportQueryKeys = {
  all: ["fauReports"] as const,
  detail: (reportId: string) => ["fauReports", reportId] as const,
  // An object segment cannot collide with a report id; the `all` prefix still invalidates it.
  forAlert: ({ batchId, transactionId }: FauReportAlert) =>
    ["fauReports", { batchId, transactionId }] as const,
};

function getActor(): FauReportActor {
  const { id, name } = getCurrentUser();
  return { id, name };
}

function invalidateFauReportQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: fauReportQueryKeys.all });
}

/** Follows the data source selected in the sidebar. */
export function useFauReportsCapabilities(): FauReportsCapabilities {
  const { apiMode } = useApiMode();
  return selectServiceImplementation("fauReports", fauReportsImplementations, apiMode).capabilities;
}

export function useFauReportForAlert(alert: FauReportAlert) {
  useServiceUsage("fauReports");
  return useQuery({
    queryKey: fauReportQueryKeys.forAlert(alert),
    queryFn: () => fauReportsService.findReportForAlert(alert),
  });
}

/** Mount it only for a role that may view the content (§ 38 AML zákona), so the content is never fetched otherwise. */
export function useFauReport(reportId: string) {
  useServiceUsage("fauReports");
  return useQuery({
    queryKey: fauReportQueryKeys.detail(reportId),
    queryFn: () => fauReportsService.loadReport(reportId),
  });
}

/**
 * The prefill needs the alert time (the run's finish, the mock's stand-in for the AML event time) and the
 * failed rules' legal bases, which the transaction evaluation does not carry.
 */
async function loadAlertContext(queryClient: QueryClient, batchId: string) {
  const [batch, rules, regulationNames] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: batchQueryKeys.detail(batchId),
      queryFn: () => batchesService.loadBatch(batchId),
    }),
    queryClient.fetchQuery({ queryKey: ruleQueryKeys.all, queryFn: () => rulesService.loadRules() }),
    queryClient.fetchQuery({
      queryKey: regulationQueryKeys.names,
      queryFn: () => regulationsService.loadRegulationNames(),
    }),
  ]);
  return { alertRaisedAt: batch.finishedAt ?? batch.uploadedAt, rules, regulationNames };
}

export function useCreateFauReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (evaluation: TransactionEvaluation) => {
      const alertContext = await loadAlertContext(queryClient, evaluation.batchId);
      const source = toFauReportSource({ evaluation, ...alertContext });
      return fauReportsService.createReport({ source, actor: getActor() });
    },
    onSuccess: () => invalidateFauReportQueries(queryClient),
  });
}

/** Saves the draft and, with `submit`, sends it for approval right after. */
export function useSaveFauReportDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      changes,
      submit,
    }: {
      reportId: string;
      changes: FauReportDraftChanges;
      submit: boolean;
    }): Promise<FauReport> => {
      const actor = getActor();
      const savedReport = await fauReportsService.updateDraft({ reportId, changes, actor });
      return submit ? fauReportsService.submitForApproval({ reportId, actor }) : savedReport;
    },
    onSettled: () => invalidateFauReportQueries(queryClient),
  });
}

export function useApproveFauReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => fauReportsService.approve({ reportId, actor: getActor() }),
    onSuccess: () => invalidateFauReportQueries(queryClient),
  });
}

export function useRejectFauReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string }) =>
      fauReportsService.reject({ reportId, reason, actor: getActor() }),
    onSuccess: () => invalidateFauReportQueries(queryClient),
  });
}

export function useMarkFauReportSubmitted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, ...submission }: MarkFauReportSubmittedInput & { reportId: string }) =>
      fauReportsService.markSubmitted({ reportId, ...submission, actor: getActor() }),
    onSuccess: () => invalidateFauReportQueries(queryClient),
  });
}
