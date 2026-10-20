import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";

import { forgetSelectedApiModeForTests } from "@/config/apiMode";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ApiModeProvider } from "@/providers/ApiModeProvider";
import { MockUsageProvider } from "@/providers/MockUsageProvider";

import { batchesService } from "../api/service";
import { BatchesScreen } from "./BatchesScreen";

// The service is mocked, so no request ever reaches the shared backend database.
jest.mock("@/config/env.client", () => ({ clientEnv: { NEXT_PUBLIC_API_MODE: "live" } }));
jest.mock("../api/service", () => {
  const capabilities = { canUploadBatch: false, canStartRun: false };
  return {
    batchesImplementations: { live: { capabilities }, mock: { capabilities } },
    batchesService: { loadBatches: jest.fn() },
  };
});
const loadBatchesMock = jest.mocked(batchesService.loadBatches);

function renderScreen(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ApiModeProvider>
        <MockUsageProvider>
          <I18nProvider initialLocale="en">
            <BatchesScreen />
          </I18nProvider>
        </MockUsageProvider>
      </ApiModeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  forgetSelectedApiModeForTests();
  loadBatchesMock.mockReset();
});

describe("BatchesScreen history", () => {
  it("shows the empty history once the batches load", async () => {
    loadBatchesMock.mockResolvedValue([]);

    renderScreen();

    expect(await screen.findByText(en.batches.empty)).toBeTruthy();
  });

  it("retries a failed load of the history", async () => {
    loadBatchesMock.mockRejectedValueOnce(new Error("Backend down")).mockResolvedValue([]);

    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: en.common.retry }));

    expect(await screen.findByText(en.batches.empty)).toBeTruthy();
    expect(loadBatchesMock).toHaveBeenCalledTimes(2);
  });
});
