import type { FauReportsService } from "@/features/fauReports/api/contract";
import { buildFauReportDraft } from "@/features/fauReports/domain/fauReportDraft";
import {
  approveFauReport,
  assertNoActiveReportForAlert,
  findActiveReportForAlert,
  FauReportTransitionError,
  markFauReportSubmitted,
  nextFauReportReferenceNumber,
  rejectFauReport,
  submitFauReportForApproval,
  updateFauReportDraft,
} from "@/features/fauReports/domain/fauReportLifecycle";
import { DEMO_REPORTING_INSTITUTION } from "@/features/fauReports/reportingInstitution";
import type { FauReport } from "@/features/fauReports/types";
import { ApiError } from "@/lib/apiError";

import { createMockId } from "../createMockId";
import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import { readMockDatabase, writeMockDatabase } from "../store/mockDatabase";

function findReport(reportId: string): FauReport {
  const report = readMockDatabase().fauReports.find((candidate) => candidate.id === reportId);
  return report ?? throwMockNotFound("FAÚ report", reportId);
}

function persistReport(updatedReport: FauReport): FauReport {
  const database = readMockDatabase();
  const fauReports = database.fauReports.map((report) =>
    report.id === updatedReport.id ? updatedReport : report,
  );
  writeMockDatabase({ ...database, fauReports });
  return updatedReport;
}

/** Runs a workflow step and maps a forbidden one to the shared API error shape. */
async function runStep<TResult>(step: (now: string) => TResult): Promise<TResult> {
  await simulateLatency();
  try {
    return step(new Date().toISOString());
  } catch (error) {
    if (error instanceof FauReportTransitionError) {
      throw new ApiError({ kind: "validation", message: error.message });
    }
    throw error;
  }
}

function transitionReport(reportId: string, transition: (report: FauReport, now: string) => FauReport) {
  return runStep((now) => persistReport(transition(findReport(reportId), now)));
}

// Stands in for the backend fau_reports API (issue #20), which prefills the draft from the AML event itself.
export const mockFauReportsService: FauReportsService = {
  capabilities: { canUseFauReports: true },

  async findReportForAlert(alert) {
    await simulateLatency({ minMs: 80, maxMs: 200 });
    const report = findActiveReportForAlert(readMockDatabase().fauReports, alert);
    return report === null ? null : { id: report.id, status: report.status };
  },

  async loadReport(reportId) {
    await simulateLatency();
    return findReport(reportId);
  },

  createReport: ({ source, actor }) =>
    runStep((now) => {
      const database = readMockDatabase();
      assertNoActiveReportForAlert(database.fauReports, source.alert);
      const report = buildFauReportDraft({
        id: createMockId("fau-report"),
        referenceNumber: nextFauReportReferenceNumber(
          database.fauReports.map(({ referenceNumber }) => referenceNumber),
          now,
        ),
        source,
        reportingInstitution: DEMO_REPORTING_INSTITUTION,
        author: actor,
        now,
      });
      writeMockDatabase({ ...database, fauReports: [...database.fauReports, report] });
      return report;
    }),

  updateDraft: ({ reportId, changes, actor }) =>
    transitionReport(reportId, (report, now) => updateFauReportDraft(report, { changes, actor, now })),
  submitForApproval: ({ reportId, actor }) =>
    transitionReport(reportId, (report, now) => submitFauReportForApproval(report, { actor, now })),
  approve: ({ reportId, actor }) =>
    transitionReport(reportId, (report, now) => approveFauReport(report, { actor, now })),
  reject: ({ reportId, actor, reason }) =>
    transitionReport(reportId, (report, now) => rejectFauReport(report, { actor, now, reason })),
  markSubmitted: ({ reportId, actor, channel, fauReferenceNumber }) =>
    transitionReport(reportId, (report, now) =>
      markFauReportSubmitted(report, { actor, now, channel, fauReferenceNumber }),
    ),
};
