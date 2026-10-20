import { fireEvent, render, screen } from "@testing-library/react";

import { useCurrentUser, useRolePermissions } from "@/features/users/api/hooks";
import { getRolePermissions } from "@/features/users/permissions";
import type { UserRole } from "@/features/users/types";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";
import { downloadTextFile } from "@/lib/downloadTextFile";

import {
  useApproveFauReport,
  useFauReport,
  useFauReportsCapabilities,
  useMarkFauReportSubmitted,
  useRejectFauReport,
  useSaveFauReportDraft,
} from "../api/hooks";
import { APPROVER, AUTHOR, buildTestReport } from "../testing/fauReportFixtures";
import type { FauReport } from "../types";
import { FauReportScreen } from "./FauReportScreen";

jest.mock("@/features/users/api/hooks", () => ({ useCurrentUser: jest.fn(), useRolePermissions: jest.fn() }));
jest.mock("@/lib/downloadTextFile", () => ({ downloadTextFile: jest.fn() }));
jest.mock("../api/hooks", () => ({
  useApproveFauReport: jest.fn(),
  useFauReport: jest.fn(),
  useFauReportsCapabilities: jest.fn(),
  useMarkFauReportSubmitted: jest.fn(),
  useRejectFauReport: jest.fn(),
  useSaveFauReportDraft: jest.fn(),
}));

const mutate = jest.fn();
const IDLE_MUTATION = { mutate, isPending: false, error: null };

function renderScreen({
  report = buildTestReport(),
  role = "contact_person",
  userId = AUTHOR.id,
  canUseFauReports = true,
}: { report?: FauReport; role?: UserRole; userId?: string; canUseFauReports?: boolean } = {}) {
  jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions(role));
  jest.mocked(useCurrentUser).mockReturnValue({ id: userId } as ReturnType<typeof useCurrentUser>);
  jest.mocked(useFauReportsCapabilities).mockReturnValue({ canUseFauReports });
  jest.mocked(useFauReport).mockReturnValue({
    data: report,
    error: null,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useFauReport>);
  for (const useMutationHook of [
    useApproveFauReport,
    useMarkFauReportSubmitted,
    useRejectFauReport,
    useSaveFauReportDraft,
  ]) {
    jest.mocked(useMutationHook).mockReturnValue(IDLE_MUTATION as never);
  }
  render(
    <I18nProvider initialLocale="en">
      <FauReportScreen reportId={report.id} />
    </I18nProvider>,
  );
}

const pendingReport = () => buildTestReport({ status: "pending_approval" });

beforeEach(() => {
  mutate.mockReset();
  jest.mocked(downloadTextFile).mockReset();
  jest.mocked(useFauReport).mockReset();
});

describe("FauReportScreen access (issue #20)", () => {
  it("shows a notice when the API does not support FAÚ reports", () => {
    renderScreen({ canUseFauReports: false });

    expect(screen.getByText(en.fauReports.unsupported)).toBeTruthy();
  });

  it("shows only the role gate to a role that may not view reports, and loads nothing (§ 38)", () => {
    renderScreen({ role: "lawyer" });

    expect(screen.getByText(/Only the .* role can do this/)).toBeTruthy();
    expect(useFauReport).not.toHaveBeenCalled();
  });
});

describe("FauReportScreen draft", () => {
  it("prefills section V with the template and marks it as a draft to review", () => {
    const report = buildTestReport();
    renderScreen({ report });

    const description = screen.getByLabelText(en.fauReports.sections.description, { selector: "textarea" });

    expect((description as HTMLTextAreaElement).value).toBe(report.description);
    expect(screen.getByText(en.fauReports.descriptionDraftNotice)).toBeTruthy();
    expect(screen.getByText(en.fauReports.complianceNotice)).toBeTruthy();
  });

  it("keeps the KYC identification fields empty, disabled and marked", () => {
    renderScreen();

    for (const label of Object.values(en.fauReports.kycFields)) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.value).toBe("");
      expect(input.disabled).toBe(true);
      expect(input.placeholder).toBe(en.fauReports.kycMarker);
    }
    expect(screen.getAllByText(en.fauReports.kycMarker).length).toBeGreaterThan(0);
  });

  it("is read only for the compliance officer while it is a draft", () => {
    renderScreen({ role: "compliance_officer", userId: APPROVER.id });

    expect(screen.queryByRole("button", { name: en.fauReports.saveDraft })).toBeNull();
    expect(screen.getByText(/Only the .* role can do this/)).toBeTruthy();
  });

  it("downloads the draft as Markdown structured by sections I to VI", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: en.fauReports.download }));

    const [[download]] = jest.mocked(downloadTextFile).mock.calls as [
      [Parameters<typeof downloadTextFile>[0]],
    ];
    expect(download.fileName).toBe("OPO-2026-0001-koncept.md");
    expect(download.mimeType).toMatch(/^text\/markdown/);
    expect(download.content).toContain("## I. Referenční údaje");
    expect(download.content).toContain("## VI. Provedení, neuskutečnění či odložení obchodu");
  });
});

describe("FauReportScreen approval", () => {
  it("disables a self-approval with the reason", () => {
    renderScreen({ report: pendingReport(), role: "compliance_officer", userId: AUTHOR.id });

    const approveButton = screen.getByRole("button", { name: en.fauReports.approve }) as HTMLButtonElement;
    expect(approveButton.disabled).toBe(true);
    expect(screen.getByText(en.fauReports.selfApprovalBlocked)).toBeTruthy();
  });

  it("lets another compliance officer approve", () => {
    renderScreen({ report: pendingReport(), role: "compliance_officer", userId: APPROVER.id });

    fireEvent.click(screen.getByRole("button", { name: en.fauReports.approve }));

    expect(mutate).toHaveBeenCalledWith("fau-report-1");
  });

  it("requires a reason to return the draft", () => {
    renderScreen({ report: pendingReport(), role: "compliance_officer", userId: APPROVER.id });

    fireEvent.click(screen.getByRole("button", { name: en.fauReports.reject }));
    fireEvent.click(screen.getByRole("button", { name: en.fauReports.confirmReject }));

    expect(screen.getByText(en.fauReports.rejectReasonRequired)).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("FauReportScreen filing", () => {
  it("requires the FAÚ reference number to mark the report as submitted", () => {
    renderScreen({ report: buildTestReport({ status: "approved", approvedBy: APPROVER }) });

    fireEvent.click(screen.getByRole("button", { name: en.fauReports.markSubmitted }));
    fireEvent.click(screen.getByRole("button", { name: en.fauReports.confirmMarkSubmitted }));

    expect(screen.getByText(en.fauReports.fauReferenceNumberRequired)).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(en.fauReports.fauReferenceNumber), {
      target: { value: "FAU-1/2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.fauReports.confirmMarkSubmitted }));

    expect(mutate).toHaveBeenCalledWith(
      { reportId: "fau-report-1", channel: "moneyweb", fauReferenceNumber: "FAU-1/2026" },
      expect.any(Object),
    );
  });
});
