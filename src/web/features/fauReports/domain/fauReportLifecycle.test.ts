import { APPROVER, AUTHOR, buildTestReport } from "../testing/fauReportFixtures";
import {
  approveFauReport,
  assertNoActiveReportForAlert,
  canEditFauReport,
  FauReportTransitionError,
  findActiveReportForAlert,
  findApprovalBlocker,
  markFauReportSubmitted,
  nextFauReportReferenceNumber,
  rejectFauReport,
  submitFauReportForApproval,
  updateFauReportDraft,
} from "./fauReportLifecycle";

const NOW = "2026-10-16T09:00:00.000Z";

const pendingReport = () => submitFauReportForApproval(buildTestReport(), { actor: AUTHOR, now: NOW });
const approvedReport = () => approveFauReport(pendingReport(), { actor: APPROVER, now: NOW });

describe("FAÚ report workflow (issue #20)", () => {
  it("goes draft → pending_approval → approved → submitted and records each step", () => {
    const submittedReport = markFauReportSubmitted(approvedReport(), {
      actor: AUTHOR,
      now: NOW,
      channel: "data_box",
      fauReferenceNumber: "  FAU-123/2026  ",
    });

    expect(submittedReport).toMatchObject({
      status: "submitted",
      approvedBy: APPROVER,
      approvedAt: NOW,
      submission: {
        channel: "data_box",
        fauReferenceNumber: "FAU-123/2026",
        submittedAt: NOW,
        submittedBy: AUTHOR,
      },
    });
    expect(submittedReport.history.map(({ action }) => action)).toEqual([
      "created",
      "submitted_for_approval",
      "approved",
      "marked_submitted",
    ]);
  });

  it("edits only a draft", () => {
    const changes = {
      subjectType: "natural_person" as const,
      reportType: "terrorist_financing" as const,
      description: "Upravený popis",
      execution: { status: "postponed" as const, note: "Odloženo o 24 h." },
    };
    const updatedReport = updateFauReportDraft(buildTestReport(), { changes, actor: AUTHOR, now: NOW });

    expect(updatedReport).toMatchObject({
      subject: { subjectType: "natural_person" },
      reportType: "terrorist_financing",
      description: "Upravený popis",
      execution: changes.execution,
    });
    expect(updatedReport.history.at(-1)).toMatchObject({ action: "updated", actor: AUTHOR, at: NOW });
    expect(canEditFauReport(pendingReport())).toBe(false);
    expect(() => updateFauReportDraft(pendingReport(), { changes, actor: AUTHOR, now: NOW })).toThrow(
      FauReportTransitionError,
    );
  });

  it("needs a description before approval", () => {
    expect(() =>
      submitFauReportForApproval(buildTestReport({ description: "  " }), { actor: AUTHOR, now: NOW }),
    ).toThrow("needs a description");
  });

  it("returns a rejected report to draft with the reason, and refuses a rejection without one", () => {
    const rejectedReport = rejectFauReport(pendingReport(), {
      actor: APPROVER,
      now: NOW,
      reason: " Doplnit V. ",
    });

    expect(rejectedReport.status).toBe("draft");
    expect(rejectedReport.history.at(-1)).toMatchObject({ action: "rejected", reason: "Doplnit V." });
    expect(() => rejectFauReport(pendingReport(), { actor: APPROVER, now: NOW, reason: "   " })).toThrow(
      "needs a reason",
    );
  });

  it("refuses a self-approval (conflict of interest)", () => {
    expect(findApprovalBlocker(pendingReport(), AUTHOR.id)).toBe("self_approval");
    expect(findApprovalBlocker(pendingReport(), APPROVER.id)).toBeNull();
    expect(() => approveFauReport(pendingReport(), { actor: AUTHOR, now: NOW })).toThrow("cannot approve");
  });

  it("allows only the next step of the workflow", () => {
    expect(() => approveFauReport(buildTestReport(), { actor: APPROVER, now: NOW })).toThrow(
      'must be "pending_approval"',
    );
    expect(() =>
      markFauReportSubmitted(pendingReport(), {
        actor: AUTHOR,
        now: NOW,
        channel: "moneyweb",
        fauReferenceNumber: "FAU-1",
      }),
    ).toThrow('must be "approved"');
  });

  it("needs the FAÚ reference number to mark a report as submitted", () => {
    expect(() =>
      markFauReportSubmitted(approvedReport(), {
        actor: AUTHOR,
        now: NOW,
        channel: "moneyweb",
        fauReferenceNumber: " ",
      }),
    ).toThrow("reference number");
  });
});

describe("one active report per alert", () => {
  it("finds the alert's report and refuses a second one", () => {
    const report = buildTestReport();
    const otherAlert = { batchId: "batch-1", transactionId: "TX000000002" };

    expect(findActiveReportForAlert([report], report.alert)).toBe(report);
    expect(findActiveReportForAlert([report], otherAlert)).toBeNull();
    expect(() => assertNoActiveReportForAlert([report], report.alert)).toThrow(
      "already has the active report",
    );
    expect(() => assertNoActiveReportForAlert([report], otherAlert)).not.toThrow();
  });
});

describe("nextFauReportReferenceNumber", () => {
  it("increments the sequence within a year and restarts it in a new one", () => {
    expect(nextFauReportReferenceNumber([], NOW)).toBe("OPO-2026-0001");
    expect(nextFauReportReferenceNumber(["OPO-2026-0001", "OPO-2026-0007", "OPO-2025-0042"], NOW)).toBe(
      "OPO-2026-0008",
    );
    expect(nextFauReportReferenceNumber(["OPO-2026-0008"], "2027-01-02T10:00:00.000Z")).toBe("OPO-2027-0001");
  });
});
