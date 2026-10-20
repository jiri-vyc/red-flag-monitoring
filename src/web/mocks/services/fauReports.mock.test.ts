import { APPROVER, AUTHOR, SOURCE } from "@/features/fauReports/testing/fauReportFixtures";
import { ApiError } from "@/lib/apiError";

import { buildSeedDatabase } from "../seed/buildSeedDatabase";
import { readMockDatabase, resetMockDatabase } from "../store/mockDatabase";
import { mockFauReportsService } from "./fauReports.mock";

jest.mock("../latency", () => ({ simulateLatency: () => Promise.resolve() }));

const OTHER_SOURCE = { ...SOURCE, alert: { ...SOURCE.alert, transactionId: "TX000000002" } };

describe("mock FAÚ reports (issue #20)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("seeds no reports", () => {
    expect(buildSeedDatabase().database.fauReports).toEqual([]);
  });

  it("creates a prefilled draft with an incrementing OPO number and finds it by alert", async () => {
    const firstReport = await mockFauReportsService.createReport({ source: SOURCE, actor: AUTHOR });
    const secondReport = await mockFauReportsService.createReport({ source: OTHER_SOURCE, actor: AUTHOR });
    const year = new Date().getUTCFullYear();

    expect(firstReport).toMatchObject({ status: "draft", author: AUTHOR, alert: SOURCE.alert });
    expect(firstReport.referenceNumber).toBe(`OPO-${year}-0001`);
    expect(secondReport.referenceNumber).toBe(`OPO-${year}-0002`);
    await expect(mockFauReportsService.findReportForAlert(SOURCE.alert)).resolves.toEqual({
      id: firstReport.id,
      status: "draft",
    });
    await expect(
      mockFauReportsService.findReportForAlert({ batchId: "batch-1", transactionId: "TX-none" }),
    ).resolves.toBeNull();
  });

  it("refuses a second active report for the same alert", async () => {
    await mockFauReportsService.createReport({ source: SOURCE, actor: AUTHOR });

    await expect(mockFauReportsService.createReport({ source: SOURCE, actor: AUTHOR })).rejects.toMatchObject(
      {
        kind: "validation",
      },
    );
  });

  it("persists the workflow and refuses the author's own approval", async () => {
    const { id: reportId } = await mockFauReportsService.createReport({ source: SOURCE, actor: AUTHOR });
    await mockFauReportsService.submitForApproval({ reportId, actor: AUTHOR });

    await expect(mockFauReportsService.approve({ reportId, actor: AUTHOR })).rejects.toBeInstanceOf(ApiError);
    await mockFauReportsService.approve({ reportId, actor: APPROVER });
    await mockFauReportsService.markSubmitted({
      reportId,
      actor: AUTHOR,
      channel: "fau_online_form",
      fauReferenceNumber: "FAU-1/2026",
    });

    expect(readMockDatabase().fauReports[0]).toMatchObject({
      status: "submitted",
      approvedBy: APPROVER,
      submission: { channel: "fau_online_form", fauReferenceNumber: "FAU-1/2026" },
    });
  });

  it("returns a rejected report to draft and edits only drafts", async () => {
    const report = await mockFauReportsService.createReport({ source: SOURCE, actor: AUTHOR });
    const reportId = report.id;
    const changes = {
      subjectType: null,
      reportType: report.reportType,
      description: "Nový popis",
      execution: report.execution,
    };
    await mockFauReportsService.submitForApproval({ reportId, actor: AUTHOR });

    await expect(
      mockFauReportsService.updateDraft({ reportId, changes, actor: AUTHOR }),
    ).rejects.toMatchObject({
      kind: "validation",
    });
    await expect(
      mockFauReportsService.reject({ reportId, actor: APPROVER, reason: "" }),
    ).rejects.toMatchObject({
      kind: "validation",
    });
    await mockFauReportsService.reject({ reportId, actor: APPROVER, reason: "Doplnit popis" });
    const updatedReport = await mockFauReportsService.updateDraft({ reportId, changes, actor: AUTHOR });

    expect(updatedReport).toMatchObject({ status: "draft", description: "Nový popis" });
  });

  it("clears reports on demo reset", async () => {
    await mockFauReportsService.createReport({ source: SOURCE, actor: AUTHOR });
    resetMockDatabase();

    expect(readMockDatabase().fauReports).toEqual([]);
  });

  it("answers not found for an unknown report", async () => {
    await expect(mockFauReportsService.loadReport("fau-report-missing")).rejects.toMatchObject({
      kind: "not_found",
    });
  });
});
