import { fireEvent, render, screen } from "@testing-library/react";

import type { TransactionEvaluation } from "@/features/batches/types";
import { useRolePermissions } from "@/features/users/api/hooks";
import { getRolePermissions } from "@/features/users/permissions";
import type { UserRole } from "@/features/users/types";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { useCreateFauReport, useFauReportForAlert, useFauReportsCapabilities } from "../api/hooks";
import type { FauReportSummary } from "../types";
import { FauReportAlertAction } from "./FauReportAlertAction";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: jest.fn() }));
jest.mock("../api/hooks", () => ({
  useCreateFauReport: jest.fn(),
  useFauReportForAlert: jest.fn(),
  useFauReportsCapabilities: jest.fn(),
}));

const mutate = jest.fn();

const EVALUATION = {
  batchId: "batch-1",
  transaction: { transactionId: "TX000000001" },
  bucket: "alert",
} as unknown as TransactionEvaluation;

function renderAction({
  role = "contact_person",
  canUseFauReports = true,
  existingReport = null,
  evaluation = EVALUATION,
}: {
  role?: UserRole;
  canUseFauReports?: boolean;
  existingReport?: FauReportSummary | null;
  evaluation?: TransactionEvaluation;
} = {}) {
  jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions(role));
  jest.mocked(useFauReportsCapabilities).mockReturnValue({ canUseFauReports });
  jest.mocked(useFauReportForAlert).mockReturnValue({
    data: existingReport,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useFauReportForAlert>);
  jest.mocked(useCreateFauReport).mockReturnValue({
    mutate,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateFauReport>);
  return render(
    <I18nProvider initialLocale="en">
      <FauReportAlertAction evaluation={evaluation} />
    </I18nProvider>,
  );
}

beforeEach(() => mutate.mockReset());

describe("FauReportAlertAction (issue #20)", () => {
  it("renders nothing when the API does not support FAÚ reports", () => {
    const { container } = renderAction({ canUseFauReports: false });

    expect(container.textContent).toBe("");
  });

  it("renders nothing for a transaction that is not an alert", () => {
    const { container } = renderAction({ evaluation: { ...EVALUATION, bucket: "to_check" } });

    expect(container.textContent).toBe("");
  });

  it("lets the contact person prepare the report from the alert", () => {
    renderAction();

    fireEvent.click(screen.getByRole("button", { name: en.fauReports.prepare }));

    expect(mutate).toHaveBeenCalledWith(EVALUATION, expect.any(Object));
  });

  it("disables preparing for another role and names the role it needs", () => {
    renderAction({ role: "compliance_officer" });

    expect((screen.getByRole("button", { name: en.fauReports.prepare }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(`Requires the ${en.roles.contact_person} role`)).toBeTruthy();
  });

  it("links to the existing report with its status instead of preparing another one", () => {
    renderAction({ existingReport: { id: "fau-report-1", status: "pending_approval" } });

    expect(screen.getByRole("link", { name: en.fauReports.openReport }).getAttribute("href")).toBe(
      "/fau-reports/fau-report-1",
    );
    expect(screen.getByText(en.fauReports.status.pending_approval)).toBeTruthy();
    expect(screen.queryByRole("button", { name: en.fauReports.prepare })).toBeNull();
  });

  it("tells other roles only that a report exists, without a link (§ 38)", () => {
    renderAction({ role: "lawyer", existingReport: { id: "fau-report-1", status: "submitted" } });

    expect(screen.getByText(en.fauReports.reportExists)).toBeTruthy();
    expect(screen.getByText(en.fauReports.status.submitted)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
