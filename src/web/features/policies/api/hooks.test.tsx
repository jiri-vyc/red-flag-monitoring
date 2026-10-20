import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/config/currentUser";

import type { Policy } from "../types";
import { useRejectPolicy } from "./hooks";
import { policiesService } from "./service";

jest.mock("./service", () => ({
  policiesImplementations: {},
  policiesService: { rejectPolicy: jest.fn() },
}));
const rejectPolicyMock = jest.mocked(policiesService.rejectPolicy);

function renderRejectHook() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useRejectPolicy(), { wrapper }), invalidateQueries };
}

describe("useRejectPolicy", () => {
  it("rejects as the current user and invalidates the same caches as an approval", async () => {
    rejectPolicyMock.mockResolvedValue({ id: "policy-1" } as Policy);
    const { result, invalidateQueries } = renderRejectHook();

    await act(() => result.current.mutateAsync({ policyId: "policy-1", reason: "Chybí částkový práh" }));

    expect(rejectPolicyMock).toHaveBeenCalledWith({
      policyId: "policy-1",
      rejectedBy: getCurrentUser().name,
      reason: "Chybí částkový práh",
    });
    expect(invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["policies"],
      ["rules"],
      ["dashboard"],
      ["regulations"],
      ["drafting-jobs"],
    ]);
  });
});
