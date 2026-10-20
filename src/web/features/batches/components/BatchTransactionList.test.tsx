import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { forgetSelectedApiModeForTests } from "@/config/apiMode";
import { DEMO_ADMIN_USER, forgetCurrentUserForTests } from "@/config/currentUser";
import { USER_ROLES, type UserRole } from "@/features/users/types";
import { formatMessage } from "@/i18n/dictionaries";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ApiModeProvider } from "@/providers/ApiModeProvider";
import { MockUsageProvider } from "@/providers/MockUsageProvider";

import { batchesService } from "../api/service";
import type { BatchTransaction, BatchTransactionPage } from "../types";
import { BatchTransactionList } from "./BatchTransactionList";

// The service is mocked, so no request ever reaches the shared backend database.
jest.mock("@/config/env.client", () => ({ clientEnv: { NEXT_PUBLIC_API_MODE: "live" } }));
jest.mock("../api/service", () => ({
  batchesImplementations: {},
  batchesService: { loadBatchTransactions: jest.fn() },
}));
const loadBatchTransactionsMock = jest.mocked(batchesService.loadBatchTransactions);

const CURRENT_USER_STORAGE_KEY = "redflag.currentUser";
const CONTACT_PERSON_COUNT = 335;
const LAWYER_COUNT = 2;

const TRANSACTION_ITEM: BatchTransaction = {
  transaction: {
    transactionId: "TX000000001",
    clientId: "K000001",
    bookedAt: "2026-07-01T10:00:00.000Z",
    amount: 1000,
    currency: "CZK",
    amountCzk: null,
    payerCountry: "CZ",
    payeeCountry: "SK",
    payerAccount: "",
    payeeAccount: "",
    transactionType: "incoming payment",
  },
  bucket: "alert",
  failedRuleCount: 1,
  maxAdjustedScore: 80,
};

/** Only the contact person and the lawyer see transactions of the bucket. */
function pageForRole(role: UserRole): BatchTransactionPage {
  const totalCountByRole: Partial<Record<UserRole, number>> = {
    contact_person: CONTACT_PERSON_COUNT,
    lawyer: LAWYER_COUNT,
  };
  const totalCount = totalCountByRole[role] ?? 0;
  return { items: totalCount > 0 ? [TRANSACTION_ITEM] : [], nextCursor: null, totalCount };
}

function actAsUser(roles: UserRole[], activeRole: UserRole): void {
  window.localStorage.setItem(
    CURRENT_USER_STORAGE_KEY,
    JSON.stringify({ ...DEMO_ADMIN_USER, roles, activeRole }),
  );
  forgetCurrentUserForTests();
}

function renderList(bucketCount: number): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ApiModeProvider>
        <MockUsageProvider>
          <I18nProvider initialLocale="en">
            <BatchTransactionList batchId="run-1" bucket="alert" bucketCount={bucketCount} />
          </I18nProvider>
        </MockUsageProvider>
      </ApiModeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  forgetSelectedApiModeForTests();
  forgetCurrentUserForTests();
  loadBatchTransactionsMock.mockReset();
  loadBatchTransactionsMock.mockImplementation(async ({ role }) => pageForRole(role));
});

describe("BatchTransactionList empty state for the active role", () => {
  it("names the roles that see the transactions when the active role sees none", async () => {
    actAsUser(["compliance_officer"], "compliance_officer");

    renderList(CONTACT_PERSON_COUNT);

    const expectedMessage = formatMessage(en.batches.roleNoAccess, {
      role: en.roles.compliance_officer,
      roles: `${en.roles.lawyer}, ${en.roles.contact_person}`,
    });
    expect(await screen.findByText(expectedMessage)).toBeTruthy();
  });

  it("keeps the generic text and asks no other role when the bucket is empty", async () => {
    renderList(0);

    expect(await screen.findByText(en.batches.noTransactions)).toBeTruthy();
    expect(loadBatchTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the generic text when no other role sees the transactions", async () => {
    loadBatchTransactionsMock.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });

    renderList(CONTACT_PERSON_COUNT);

    expect(await screen.findByText(en.batches.noTransactions)).toBeTruthy();
    expect(loadBatchTransactionsMock).toHaveBeenCalledTimes(USER_ROLES.length);
  });
});
