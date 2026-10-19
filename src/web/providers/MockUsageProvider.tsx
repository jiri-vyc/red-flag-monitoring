"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getServiceMode, SERVICE_NAMES, type ServiceName } from "@/config/apiMode";

type MockUsageContextValue = {
  mockedServicesInUse: ServiceName[];
  registerMockUsage: (serviceName: ServiceName) => () => void;
};

const MockUsageContext = createContext<MockUsageContextValue | null>(null);

/** Tracks which mocked services the mounted screen uses, so the sidebar can say the data is not from the API. */
export function MockUsageProvider({ children }: { children: ReactNode }) {
  const [usageCounts, setUsageCounts] = useState<Partial<Record<ServiceName, number>>>({});

  const changeUsageCount = useCallback((serviceName: ServiceName, delta: number) => {
    setUsageCounts((currentCounts) => ({
      ...currentCounts,
      [serviceName]: Math.max(0, (currentCounts[serviceName] ?? 0) + delta),
    }));
  }, []);

  const registerMockUsage = useCallback(
    (serviceName: ServiceName) => {
      changeUsageCount(serviceName, 1);
      return () => changeUsageCount(serviceName, -1);
    },
    [changeUsageCount],
  );

  const contextValue = useMemo(() => {
    const mockedServicesInUse = SERVICE_NAMES.filter((serviceName) => (usageCounts[serviceName] ?? 0) > 0);
    return { mockedServicesInUse, registerMockUsage };
  }, [usageCounts, registerMockUsage]);

  return <MockUsageContext.Provider value={contextValue}>{children}</MockUsageContext.Provider>;
}

function useMockUsageContext(): MockUsageContextValue {
  const contextValue = useContext(MockUsageContext);
  if (!contextValue) {
    throw new Error("Mock usage hooks must be used inside MockUsageProvider.");
  }
  return contextValue;
}

/** Called by every feature hook. Registers the service while mounted if it resolves to the mock implementation. */
export function useServiceUsage(serviceName: ServiceName): void {
  const { registerMockUsage } = useMockUsageContext();
  useEffect(() => {
    if (getServiceMode(serviceName) !== "mock") {
      return;
    }
    return registerMockUsage(serviceName);
  }, [serviceName, registerMockUsage]);
}

export function useMockedServicesInUse(): ServiceName[] {
  return useMockUsageContext().mockedServicesInUse;
}
