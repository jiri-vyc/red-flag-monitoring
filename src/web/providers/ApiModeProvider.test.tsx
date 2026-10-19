import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { forgetSelectedApiModeForTests } from "@/config/apiMode";
import { useBatchesCapabilities } from "@/features/batches/api/hooks";
import { useRulesCapabilities } from "@/features/rules/api/hooks";
import { useWizardCapabilities } from "@/features/wizard/api/hooks";

import { ApiModeProvider, useApiMode } from "./ApiModeProvider";

// The recommended live setup: no per-service override, the wizard shares the live data source.
jest.mock("@/config/env.client", () => ({ clientEnv: { NEXT_PUBLIC_API_MODE: "live" } }));

function useCapabilitiesAndMode() {
  return {
    ...useApiMode(),
    batches: useBatchesCapabilities(),
    rules: useRulesCapabilities(),
    wizard: useWizardCapabilities(),
  };
}

function renderWithProviders(queryClient = new QueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiModeProvider>{children}</ApiModeProvider>
    </QueryClientProvider>
  );
  return renderHook(useCapabilitiesAndMode, { wrapper });
}

beforeEach(() => {
  window.localStorage.clear();
  forgetSelectedApiModeForTests();
});

describe("ApiModeProvider", () => {
  it("starts in the env default with live capabilities", () => {
    const { result } = renderWithProviders();

    expect(result.current.apiMode).toBe("live");
    expect(result.current.batches.canUploadBatch).toBe(false);
    expect(result.current.batches.canStartRun).toBe(true);
    expect(result.current.rules.canCreateDeterministicRule).toBe(false);
    expect(result.current.wizard).toEqual({ isAvailable: true, canFetchUrl: true });
  });

  it("switches every capability to the mock implementation and back", () => {
    const { result } = renderWithProviders();

    act(() => result.current.changeApiMode("mock"));
    expect(result.current.apiMode).toBe("mock");
    expect(result.current.batches.canUploadBatch).toBe(true);
    expect(result.current.batches.canStartRun).toBe(true);
    expect(result.current.rules.canCreateDeterministicRule).toBe(true);
    expect(result.current.wizard).toEqual({ isAvailable: true, canFetchUrl: true });

    act(() => result.current.changeApiMode("live"));
    expect(result.current.batches.canUploadBatch).toBe(false);
    expect(result.current.rules.canCreateDeterministicRule).toBe(false);
  });

  it("drops cached data of the previous source on switch", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["rules"], ["live rule"]);
    const { result } = renderWithProviders(queryClient);

    act(() => result.current.changeApiMode("mock"));

    expect(queryClient.getQueryData(["rules"])).toBeUndefined();
  });

  it("restores the stored choice", () => {
    window.localStorage.setItem("redflag.apiMode", "mock");
    const { result } = renderWithProviders();

    expect(result.current.apiMode).toBe("mock");
    expect(result.current.batches.canUploadBatch).toBe(true);
  });
});
